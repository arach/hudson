export interface HudPushSwPayload {
  generic?: string;
  itemId?: string;
  kind?: string;
}

export interface HudPushNotificationOptions extends NotificationOptions {
  title?: string;
}

export interface HudPushSwHandlerOptions {
  format?: (payload: HudPushSwPayload) => HudPushNotificationOptions;
}

export interface HudPushEvent {
  data?: { json?: () => unknown; text?: () => string };
  waitUntil: (promise: Promise<void>) => void;
}

interface HudPushServiceWorkerGlobal {
  registration: {
    showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  };
}

export function hudPushSwHandler(options: HudPushSwHandlerOptions = {}) {
  return (event: HudPushEvent): void => {
    event.waitUntil((async () => {
      const payload = readPayload(event);
      const formatted = options.format?.(payload) ?? defaultFormat(payload);
      const title = formatted.title ?? payload.generic ?? 'Hudson update';
      const { title: _title, ...notificationOptions } = formatted;
      const registration = (self as unknown as HudPushServiceWorkerGlobal).registration;
      await registration.showNotification(title, {
        tag: payload.itemId ? `hudson:${payload.kind ?? 'item'}:${payload.itemId}` : undefined,
        data: { itemId: payload.itemId, kind: payload.kind },
        ...notificationOptions,
      });
    })());
  };
}

function readPayload(event: HudPushEvent): HudPushSwPayload {
  try {
    const readJson = event.data?.json;
    return readJson ? readJson.call(event.data) as HudPushSwPayload : {};
  } catch {
    const readText = event.data?.text;
    return { generic: readText ? readText.call(event.data) : undefined };
  }
}

function defaultFormat(payload: HudPushSwPayload): HudPushNotificationOptions {
  return {
    title: payload.generic ?? 'An item needs attention',
    body: payload.kind ? `New ${payload.kind} update` : 'Open the app to view the latest update.',
  };
}
