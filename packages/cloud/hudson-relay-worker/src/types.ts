export interface Env {
  HUD_DB: D1Database;
  HUD_SESSION_SECRET?: string;
  HUD_SESSION_TTL_SECONDS?: string;
  HUD_GITHUB_CLIENT_ID?: string;
  HUD_GITHUB_CLIENT_SECRET?: string;
  HUD_GITHUB_REDIRECT_URI?: string;
  /** Comma-separated extra origins allowed to make cookie-authenticated mutating requests (CSRF allow-list). The worker's own origin and the HUD_GITHUB_REDIRECT_URI origin are always allowed. */
  HUD_ALLOWED_ORIGINS?: string;
  HUD_PUSH_TOKEN_ENCRYPTION_KEY?: string;
  HUD_PUSH_PUBLIC_KEY?: string;
  HUD_PUSH_PRIVATE_KEY?: string;
  HUD_PUSH_SUBJECT?: string;
  HUD_PUSH_RATE_PER_MINUTE?: string;
  HUD_PUSH_RATE_PER_HOUR?: string;
  HUD_PUSH_RATE_PER_DAY?: string;
  HUD_PUSH_DEVICE_RATE_PER_MINUTE?: string;
  HUD_PUSH_DEVICE_CAP?: string;
  HUD_PUSH_BODY_MAX?: string;
  HUD_PUSH_PAYLOAD_MAX?: string;
}

export interface HudSession {
  provider: 'github';
  providerUserId: string;
  login: string;
  email: string;
  expiresAt: number;
}

export interface OAuthState {
  nonce: string;
  returnTo: string;
  expiresAt: number;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface PushDeviceRow {
  id: string;
  user_id: string;
  device_id: string;
  platform: string;
  endpoint: string;
  encrypted_subscription: string;
  authorization_status: string;
  revoked_at?: number | null;
}
