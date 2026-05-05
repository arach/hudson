export type HudAuthProvider = 'github';
export type HudAuthBearer = `${string}${string}.${string}`;
export type HudAuthBearerStorage = 'cookie' | 'localStorage';
export type HudAuthErrorCode = 'unauthorized' | 'expired' | 'verifiedEmailRequired' | 'providerError' | 'network';

export interface HudAuthSession {
  provider: HudAuthProvider;
  providerUserId: string;
  login: string;
  email: string;
  expiresAt: number;
}

export interface HudAuthClientOptions {
  workerUrl: string;
  bearerPrefix?: string;
  bearerStorage?: HudAuthBearerStorage;
}

export interface HudAuthSignInOptions {
  provider: HudAuthProvider;
  returnTo?: string;
}

export class HudAuthError extends Error {
  readonly code: HudAuthErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(code: HudAuthErrorCode, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'HudAuthError';
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export type HudSignedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_BEARER_PREFIX = 'hud_session_';
const LOCAL_STORAGE_KEY = 'hudson.auth.bearer';

export class HudAuthClient {
  readonly workerUrl: string;
  readonly bearerPrefix: string;
  readonly bearerStorage: HudAuthBearerStorage;

  constructor(options: HudAuthClientOptions) {
    if (!options.workerUrl) throw new HudAuthError('network', 'workerUrl is required');
    this.workerUrl = stripTrailingSlash(options.workerUrl);
    this.bearerPrefix = options.bearerPrefix ?? DEFAULT_BEARER_PREFIX;
    this.bearerStorage = options.bearerStorage ?? 'cookie';
  }

  signIn(options: HudAuthSignInOptions): void {
    if (options.provider !== 'github') {
      throw new HudAuthError('providerError', `Unsupported auth provider: ${options.provider}`);
    }
    const url = this.endpoint('/v1/auth/github/start');
    if (options.returnTo) url.searchParams.set('return_to', options.returnTo);

    if (typeof window === 'undefined' || !window.location?.assign) {
      throw new HudAuthError('network', 'signIn requires a browser window for the OAuth redirect');
    }
    window.location.assign(url.toString());
  }

  async getSession(): Promise<HudAuthSession | null> {
    const response = await this.signedFetch()(this.endpoint('/v1/auth/session'));
    if (response.status === 401) return null;
    if (!response.ok) throw await authErrorFromResponse(response, 'network', 'Failed to read Hudson auth session');

    const body = await response.json().catch(() => ({})) as { authenticated?: boolean; session?: HudAuthSession };
    const session = body.authenticated ? body.session : null;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      if (this.bearerStorage === 'localStorage') this.clearStoredBearer();
      return null;
    }
    return session;
  }

  async signOut(): Promise<void> {
    const response = await this.signedFetch()(this.endpoint('/v1/auth/logout'), { method: 'POST' });
    this.clearStoredBearer();
    if (!response.ok) throw await authErrorFromResponse(response, 'network', 'Failed to sign out of Hudson auth');
  }

  signedFetch(): HudSignedFetch {
    return async (input, init = {}) => {
      const headers = new Headers(init.headers ?? requestHeaders(input));
      const bearer = this.readStoredBearer();
      if (bearer && !headers.has('authorization')) headers.set('authorization', `Bearer ${bearer}`);
      return fetch(input, {
        ...init,
        headers,
        credentials: init.credentials ?? 'include',
      });
    };
  }

  /** Local-storage mode escape hatch for delegated/session bearers minted outside OAuth. */
  setBearer(bearer: string): void {
    if (this.bearerStorage !== 'localStorage') return;
    storage()?.setItem(LOCAL_STORAGE_KEY, bearer.startsWith(this.bearerPrefix) ? bearer : `${this.bearerPrefix}${bearer}`);
  }

  getBearer(): string | null {
    return this.readStoredBearer();
  }

  private endpoint(path: string): URL {
    return new URL(path, `${this.workerUrl}/`);
  }

  private readStoredBearer(): string | null {
    if (this.bearerStorage !== 'localStorage') return null;
    const bearer = storage()?.getItem(LOCAL_STORAGE_KEY) ?? null;
    return bearer?.startsWith(this.bearerPrefix) ? bearer : bearer ? `${this.bearerPrefix}${bearer}` : null;
  }

  private clearStoredBearer(): void {
    if (this.bearerStorage === 'localStorage') storage()?.removeItem(LOCAL_STORAGE_KEY);
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function requestHeaders(input: RequestInfo | URL): HeadersInit | undefined {
  return typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
}

async function authErrorFromResponse(response: Response, fallback: HudAuthErrorCode, message: string): Promise<HudAuthError> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  const code = mapAuthError(body.error) ?? fallback;
  return new HudAuthError(code, body.error ?? message, { status: response.status });
}

function mapAuthError(error: string | undefined): HudAuthErrorCode | undefined {
  if (!error) return undefined;
  if (error === 'unauthorized') return 'unauthorized';
  if (error === 'expired') return 'expired';
  if (error === 'verified_email_required' || error === 'verifiedEmailRequired') return 'verifiedEmailRequired';
  if (error.includes('github') || error.includes('oauth') || error.includes('provider')) return 'providerError';
  return undefined;
}
