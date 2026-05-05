CREATE TABLE IF NOT EXISTS hud_push_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  endpoint TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  encrypted_subscription TEXT NOT NULL,
  authorization_status TEXT NOT NULL DEFAULT 'granted',
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE(user_id, device_id, platform),
  UNIQUE(token_hash)
);
CREATE INDEX IF NOT EXISTS idx_hud_push_devices_user ON hud_push_devices(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS hud_push_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  push_status INTEGER,
  push_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hud_push_attempts_user ON hud_push_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hud_push_usage_daily (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  attempted_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, day)
);

CREATE TABLE IF NOT EXISTS hud_push_rate_buckets (
  bucket_key TEXT NOT NULL,
  window_kind TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(bucket_key, window_kind, window_start)
);

CREATE TABLE IF NOT EXISTS hud_push_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hud_push_audit_user ON hud_push_audit_log(user_id, created_at DESC);
