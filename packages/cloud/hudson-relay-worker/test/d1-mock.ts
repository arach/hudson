type Row = Record<string, any>;

export class InMemoryD1 implements D1Database {
  devices: Row[] = [];
  attempts: Row[] = [];
  usage: Row[] = [];
  rateBuckets: Row[] = [];
  audit: Row[] = [];

  prepare(query: string): D1PreparedStatement {
    return new Statement(this, query);
  }
}

class Statement implements D1PreparedStatement {
  private values: unknown[] = [];
  constructor(private db: InMemoryD1, private query: string) {}
  bind(...values: unknown[]): D1PreparedStatement { this.values = values; return this; }
  async first<T = unknown>(): Promise<T | null> {
    const rows = await this.all<T>();
    return (rows.results?.[0] ?? null) as T | null;
  }
  async all<T = unknown>(): Promise<D1Result<T>> {
    const q = normalize(this.query);
    const v = this.values;

    if (q.startsWith('SELECT COUNT(*) AS count FROM hud_push_devices')) {
      const [userId] = v;
      return result([{ count: this.db.devices.filter(d => d.user_id === userId && d.revoked_at == null).length }] as T[]);
    }
    if (q.startsWith('SELECT user_id FROM hud_push_devices WHERE token_hash')) {
      const [tokenHash] = v;
      return result(this.db.devices.filter(d => d.token_hash === tokenHash && d.revoked_at == null).map(d => ({ user_id: d.user_id })) as T[]);
    }
    if (q.startsWith('INSERT INTO hud_push_devices')) {
      const [id,user_id,device_id,platform,endpoint,token_hash,encrypted_subscription,authorization_status,created_at,updated_at,last_seen_at] = v;
      const existing = this.db.devices.find(d => d.user_id === user_id && d.device_id === device_id && d.platform === platform);
      if (existing) Object.assign(existing, { endpoint, token_hash, encrypted_subscription, authorization_status, revoked_at: null, updated_at, last_seen_at });
      else this.db.devices.push({ id,user_id,device_id,platform,endpoint,token_hash,encrypted_subscription,authorization_status,created_at,updated_at,last_seen_at, revoked_at: null });
      return result();
    }
    if (q.startsWith('UPDATE hud_push_devices SET revoked_at')) {
      const [revoked_at, updated_at, a, b] = v;
      if (q.includes('WHERE id = ?')) this.db.devices.filter(d => d.id === a).forEach(d => Object.assign(d, { revoked_at, updated_at }));
      else this.db.devices.filter(d => d.user_id === a && d.device_id === b).forEach(d => Object.assign(d, { revoked_at, updated_at }));
      return result();
    }
    if (q.startsWith('SELECT device_id, platform, authorization_status, revoked_at FROM hud_push_devices')) {
      const [userId] = v;
      return result(this.db.devices.filter(d => d.user_id === userId).map(({ device_id, platform, authorization_status, revoked_at }) => ({ device_id, platform, authorization_status, revoked_at })) as T[]);
    }
    if (q.startsWith('SELECT * FROM hud_push_devices WHERE user_id = ? AND device_id = ?')) {
      const [userId, deviceId] = v;
      return result(this.db.devices.filter(d => d.user_id === userId && d.device_id === deviceId && d.revoked_at == null) as T[]);
    }
    if (q.startsWith('SELECT * FROM hud_push_devices WHERE user_id = ? AND revoked_at IS NULL')) {
      const [userId] = v;
      return result(this.db.devices.filter(d => d.user_id === userId && d.revoked_at == null) as T[]);
    }
    if (q.startsWith('INSERT INTO hud_push_rate_buckets')) {
      const [bucket_key, window_kind, window_start,, updated_at] = v;
      let row = this.db.rateBuckets.find(r => r.bucket_key === bucket_key && r.window_kind === window_kind && r.window_start === window_start);
      if (row) { row.count += 1; row.updated_at = updated_at; }
      else { row = { bucket_key, window_kind, window_start, count: 1, updated_at }; this.db.rateBuckets.push(row); }
      return result([{ count: row.count }] as T[]);
    }
    if (q.startsWith('UPDATE hud_push_rate_buckets SET count = count - 1')) {
      const [bucket_key, window_kind, window_start] = v;
      const row = this.db.rateBuckets.find(r => r.bucket_key === bucket_key && r.window_kind === window_kind && r.window_start === window_start);
      if (row) row.count -= 1;
      return result();
    }
    if (q.startsWith('INSERT INTO hud_push_attempts')) {
      const [id,user_id,device_id,item_id,kind,status,push_status,push_reason,created_at] = v;
      this.db.attempts.push({ id,user_id,device_id,item_id,kind,status,push_status,push_reason,created_at });
      return result();
    }
    if (q.startsWith('INSERT INTO hud_push_usage_daily')) {
      const [user_id,day,attempted_count,delivered_count,failed_count,updated_at] = v as any[];
      let row = this.db.usage.find(r => r.user_id === user_id && r.day === day);
      if (row) Object.assign(row, { attempted_count: row.attempted_count + attempted_count, delivered_count: row.delivered_count + delivered_count, failed_count: row.failed_count + failed_count, updated_at });
      else this.db.usage.push({ user_id, day, attempted_count, delivered_count, failed_count, updated_at });
      return result();
    }
    if (q.startsWith('SELECT * FROM hud_push_usage_daily')) {
      const [userId] = v;
      return result(this.db.usage.filter(r => r.user_id === userId).sort((a,b) => String(b.day).localeCompare(String(a.day))).slice(0,30) as T[]);
    }
    if (q.startsWith('INSERT INTO hud_push_audit_log')) {
      const [id,user_id,action,outcome,detail,ip,user_agent,created_at] = v;
      this.db.audit.push({ id,user_id,action,outcome,detail,ip,user_agent,created_at });
      return result();
    }
    if (q.startsWith('SELECT action,outcome,detail,created_at FROM hud_push_audit_log')) {
      const [userId] = v;
      return result(this.db.audit.filter(r => r.user_id === userId).sort((a,b) => b.created_at - a.created_at).slice(0,100).map(({ action, outcome, detail, created_at }) => ({ action, outcome, detail, created_at })) as T[]);
    }
    throw new Error(`Unhandled D1 query: ${this.query}`);
  }
  async run(): Promise<D1Result> { return this.all(); }
}

function normalize(query: string): string { return query.replace(/\s+/g, ' ').trim(); }
function result<T = unknown>(results?: T[]): D1Result<T> { return { success: true, results: results ?? [] }; }
