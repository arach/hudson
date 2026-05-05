import type { HudAuthClient, HudSignedFetch } from './auth';

export type HudPushKind = string;
export type HudPushUrgency = 'low' | 'normal' | 'high';
export type HudPushDeviceKind = 'web';
export type HudPushErrorCode = 'notSubscribed' | 'permissionDenied' | 'rateLimited' | 'payloadTooLarge' | 'network';

export interface HudPushClientOptions {
  auth: HudAuthClient | { signedFetch: () => HudSignedFetch } | HudSignedFetch;
  pushPublicKey: string;
  serviceWorkerRegistration?: ServiceWorkerRegistration;
}

export interface HudPushRegisterOptions {
  deviceId: string;
  kind: HudPushDeviceKind;
  serviceWorkerRegistration?: ServiceWorkerRegistration;
}

export interface HudPushSendOptions {
  itemId: string;
  kind: HudPushKind;
  urgency?: HudPushUrgency;
  deviceId?: string;
}

export interface HudPushDevice {
  deviceId: string;
  platform?: string;
  kind?: string;
  authorizationStatus?: NotificationPermission | string;
  revokedAt?: number | null;
  [key: string]: unknown;
}

export interface HudPushSendResult {
  ok: boolean;
  delivered?: number;
  failed?: number;
  rateLimited?: boolean | number;
  retryAfterSeconds?: number;
  rateLimitWindow?: string;
  denied?: boolean;
  error?: string;
}

export class HudPushError extends Error {
  readonly code: HudPushErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(code: HudPushErrorCode, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'HudPushError';
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export class HudPushClient {
  readonly pushPublicKey: string;
  private readonly fetcher: HudSignedFetch;
  private readonly workerUrl?: string;
  private readonly serviceWorkerRegistration?: ServiceWorkerRegistration;

  constructor(options: HudPushClientOptions) {
    this.pushPublicKey = options.pushPublicKey;
    this.fetcher = resolveSignedFetch(options.auth);
    this.workerUrl = typeof options.auth === 'object' && 'workerUrl' in options.auth ? String(options.auth.workerUrl).replace(/\/+$/, '') : undefined;
    this.serviceWorkerRegistration = options.serviceWorkerRegistration;
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined' || !Notification.requestPermission) {
      throw new HudPushError('permissionDenied', 'Notifications are not available in this environment');
    }
    return await Notification.requestPermission() === 'granted';
  }

  async register(options: HudPushRegisterOptions): Promise<HudPushDevice> {
    if (options.kind !== 'web') throw new HudPushError('notSubscribed', `Unsupported push device kind: ${options.kind}`);
    const registration = options.serviceWorkerRegistration ?? this.serviceWorkerRegistration;
    if (!registration?.pushManager) throw new HudPushError('notSubscribed', 'A ServiceWorkerRegistration with pushManager is required');
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      throw new HudPushError('permissionDenied', 'Notification permission has not been granted');
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKeyToArrayBuffer(this.pushPublicKey),
    });

    const response = await this.fetcher(this.endpoint('/v1/push/devices/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceId: options.deviceId,
        kind: options.kind,
        platform: options.kind,
        subscription: subscription.toJSON(),
        authorizationStatus: typeof Notification !== 'undefined' ? Notification.permission : 'granted',
      }),
    });
    if (!response.ok) throw await pushErrorFromResponse(response, 'network', 'Failed to register push device');
    const body = await response.json().catch(() => ({})) as { device?: HudPushDevice };
    return normalizeDevice(body.device ?? { deviceId: options.deviceId, platform: options.kind });
  }

  async unregister(deviceId: string): Promise<void> {
    const response = await this.fetcher(this.endpoint('/v1/push/devices/unregister'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!response.ok) throw await pushErrorFromResponse(response, 'network', 'Failed to unregister push device');
  }

  async send(options: HudPushSendOptions): Promise<HudPushSendResult> {
    const response = await this.fetcher(this.endpoint('/v1/push'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 429) {
      return {
        ok: false,
        rateLimited: true,
        retryAfterSeconds: numberValue(body.retryAfterSeconds),
        rateLimitWindow: typeof body.rateLimitWindow === 'string' ? body.rateLimitWindow : undefined,
        error: typeof body.error === 'string' ? body.error : 'rate_limited',
      };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, denied: true, error: typeof body.error === 'string' ? body.error : 'denied' };
    }
    if (response.status === 413) throw new HudPushError('payloadTooLarge', String(body.error ?? 'payload_too_large'), { status: response.status });
    if (!response.ok) throw new HudPushError('network', String(body.error ?? 'Failed to send push'), { status: response.status });
    return {
      ok: body.ok !== false,
      delivered: numberValue(body.delivered),
      failed: numberValue(body.failed),
      rateLimited: numberValue(body.rateLimited) ?? false,
    };
  }

  async devices(): Promise<HudPushDevice[]> {
    const response = await this.fetcher(this.endpoint('/v1/push/devices'));
    if (!response.ok) throw await pushErrorFromResponse(response, 'network', 'Failed to list push devices');
    const body = await response.json().catch(() => ({})) as { devices?: unknown[] };
    return (body.devices ?? []).map((device) => normalizeDevice(device as HudPushDevice));
  }

  async usage<T = unknown>(): Promise<T[]> {
    const response = await this.fetcher(this.endpoint('/v1/push/usage'));
    if (!response.ok) throw await pushErrorFromResponse(response, 'network', 'Failed to read push usage');
    const body = await response.json().catch(() => ({})) as { usage?: T[] };
    return body.usage ?? [];
  }

  private endpoint(path: string): string {
    return this.workerUrl ? new URL(path, `${this.workerUrl}/`).toString() : path;
  }

  async audit<T = unknown>(): Promise<T[]> {
    const response = await this.fetcher(this.endpoint('/v1/push/audit'));
    if (!response.ok) throw await pushErrorFromResponse(response, 'network', 'Failed to read push audit log');
    const body = await response.json().catch(() => ({})) as { audit?: T[] };
    return body.audit ?? [];
  }
}

function resolveSignedFetch(auth: HudPushClientOptions['auth']): HudSignedFetch {
  if (typeof auth === 'function') return auth;
  return auth.signedFetch();
}

function normalizeDevice(device: HudPushDevice): HudPushDevice {
  return {
    ...device,
    deviceId: device.deviceId ?? (device as { device_id?: string }).device_id ?? '',
    platform: device.platform ?? device.kind,
    authorizationStatus: device.authorizationStatus ?? (device as { authorization_status?: string }).authorization_status,
    revokedAt: device.revokedAt ?? (device as { revoked_at?: number | null }).revoked_at,
  };
}

function vapidPublicKeyToArrayBuffer(publicKey: string): ArrayBuffer {
  const padded = publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function pushErrorFromResponse(response: Response, fallback: HudPushErrorCode, message: string): Promise<HudPushError> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  const code = mapPushError(body.error, response.status) ?? fallback;
  return new HudPushError(code, body.error ?? message, { status: response.status });
}

function mapPushError(error: string | undefined, status: number): HudPushErrorCode | undefined {
  if (status === 429 || error === 'rate_limited' || error?.includes('rate')) return 'rateLimited';
  if (status === 413 || error === 'payload_too_large') return 'payloadTooLarge';
  if (status === 401 || status === 403) return 'permissionDenied';
  if (error?.includes('subscription') || error?.includes('device')) return 'notSubscribed';
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
