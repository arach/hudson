import { base64Url, base64UrlToBytes } from './util';

const enc = new TextEncoder();
const dec = new TextDecoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function signToken(payload: unknown, secret?: string): Promise<string> {
  if (!secret?.trim()) throw new Error('missing_session_secret');
  const payloadPart = base64Url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payloadPart));
  return `${payloadPart}.${base64Url(sig)}`;
}

export async function verifyToken<T>(token: string | undefined, secret?: string): Promise<T | undefined> {
  if (!token || !secret?.trim()) return undefined;
  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) return undefined;
  const expected = base64Url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payloadPart)));
  if (!constantTimeEqual(expected, sigPart)) return undefined;
  try { return JSON.parse(dec.decode(base64UrlToBytes(payloadPart))) as T; } catch { return undefined; }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function sha256Base64Url(value: string): Promise<string> {
  return base64Url(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

export async function encryptJson(value: unknown, base64Key?: string): Promise<string> {
  if (!base64Key?.trim()) throw new Error('missing_push_encryption_key');
  const key = await aesKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return `${base64Url(iv)}.${base64Url(encrypted)}`;
}

export async function decryptJson<T>(sealed: string, base64Key?: string): Promise<T> {
  if (!base64Key?.trim()) throw new Error('missing_push_encryption_key');
  const [ivPart, dataPart] = sealed.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(ivPart) as BufferSource }, await aesKey(base64Key), base64UrlToBytes(dataPart) as BufferSource);
  return JSON.parse(dec.decode(plain)) as T;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  let bytes: Uint8Array;
  try { bytes = base64UrlToBytes(secret); } catch { bytes = enc.encode(secret); }
  if (bytes.byteLength !== 32) bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function signWebPushJwt(audience: string, subject: string, privateKeyPem: string): Promise<string> {
  const header = base64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64Url(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject }));
  const key = await importPkcs8PrivateKey(privateKeyPem);
  const der = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64Url(ieeeP1363FromDer(new Uint8Array(der)))}`;
}

async function importPkcs8PrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.includes('BEGIN') ? pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '') : pem.trim();
  const binary = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', binary as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

function ieeeP1363FromDer(sig: Uint8Array): Uint8Array {
  if (sig.length === 64) return sig;
  // Workers return DER for ECDSA. Convert two ASN.1 INTEGERs to raw r||s.
  let p = 3;
  const rLen = sig[p++];
  let r = sig.slice(p, p + rLen); p += rLen + 1;
  const sLen = sig[p++];
  let s = sig.slice(p, p + sLen);
  if (r[0] === 0 && r.length > 32) r = r.slice(1);
  if (s[0] === 0 && s.length > 32) s = s.slice(1);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}
