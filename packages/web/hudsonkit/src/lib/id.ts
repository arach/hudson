export function createHudsonId(prefix = 'h', length = 12): string {
  const globalCrypto = globalThis.crypto;

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    const id = globalCrypto.randomUUID().replace(/-/g, '').slice(0, length);
    return prefix ? `${prefix}_${id}` : id;
  }

  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    globalCrypto.getRandomValues(bytes);
    const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
    return prefix ? `${prefix}_${id}` : id;
  }

  const id = Math.random().toString(36).slice(2, 2 + length);
  return prefix ? `${prefix}_${id}` : id;
}
