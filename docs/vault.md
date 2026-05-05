---
title: "Vault"
description: "Encrypted KV — Keychain on Apple, WebCrypto + IndexedDB on web"
order: 13
section: "Storage"
---

# Vault

## Overview

`HudVault` is a service-namespaced, encrypted key/value store for opaque secrets — API keys, OAuth tokens, refresh tokens. Apple and web ship the same shape (`set` / `get` / `list` / `delete` / `clear`) so an app can pair a Swift client and a TypeScript client against the same conceptual API.

Each instance is scoped by a `service` string (reverse-DNS by convention) so unrelated apps don't collide: `HudVault(service: "com.talkie.api-keys")` is a different bucket from `HudVault(service: "com.scout.tokens")`.

No passphrase ceremony in v1 — the OS keychain (Apple) or the browser's non-extractable CryptoKey (web) is the trust anchor.

## Apple — `HudVault`

Backed by the iOS / macOS Keychain (`kSecClassGenericPassword`). Items are written with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`: encrypted at rest, available after first unlock per boot, never synced to iCloud or restored to another device.

```swift
import HudsonUI

let vault = HudVault(service: "com.talkie.api-keys")

try vault.setString("anthropic", "sk-ant-...")
let key = try vault.getString("anthropic")     // "sk-ant-..."

try vault.set("session", Data([0xAB, 0xCD]))   // raw bytes
let bytes = try vault.get("session")           // Data?

let names = try vault.list()                   // ["anthropic", "session"]
try vault.delete("session")
try vault.clear()                              // wipe this service only
```

### API

| Method | Signature | Notes |
|---|---|---|
| `set` | `(String, Data) throws` | Replaces any existing item. |
| `get` | `(String) throws -> Data?` | `nil` when not set. |
| `delete` | `(String) throws` | No-op when not set. |
| `list` | `() throws -> [String]` | Sorted alphabetically. |
| `clear` | `() throws` | Wipes this `service` only. |
| `setString` / `getString` | UTF-8 convenience | Throws `.encodingFailed` on bad bytes. |

Errors surface as `HudVaultError` (`.saveFailed`, `.loadFailed`, `.deleteFailed`, `.encodingFailed`), each carrying the underlying `OSStatus` where relevant.

### Threat model

Defends against casual device theft and cross-app snooping. Does **not** defend against local malware running with the same entitlement and bundle ID — that code can read the same items.

## Apple — `HudSecretField`

Masked SwiftUI input for credential entry. Reveal toggle plus a copy button that writes to the pasteboard and **auto-clears after 30 seconds** so secrets don't linger.

```swift
import HudsonUI

@State private var apiKey: String = ""

var body: some View {
    HudSecretField("Anthropic API key", text: $apiKey, icon: "key.fill")
}
```

Pair it with `HudVault` for the typical credentials flow:

```swift
HudSecretField("API key", text: $draft)
Button("Save") {
    try? HudVault(service: "com.talkie.api-keys").setString("anthropic", draft)
    draft = ""
}
```

The field uses mono type, disables autocorrect / autocapitalization on iOS, and renders inside `HudSurface.inset`.

## Web — `hudsonkit/vault`

Import from the `hudsonkit/vault` subpath. Storage is IndexedDB-backed; encryption is AES-GCM via `crypto.subtle` with a non-extractable 256-bit `CryptoKey` persisted in IndexedDB. The key is bound to the browser profile + origin.

```ts
import { HudVault } from 'hudsonkit/vault';

const vault = new HudVault({ service: 'com.talkie.api-keys' });

await vault.set('anthropic', 'sk-ant-...');
const key = await vault.get('anthropic');     // string | null

await vault.setBytes('session', new Uint8Array([0xAB, 0xCD]));
const bytes = await vault.getBytes('session'); // Uint8Array | null

const names = await vault.list();              // string[]
await vault.delete('session');
await vault.clear();                           // wipe this service only
```

### API

| Method | Signature |
|---|---|
| `set` | `(key: string, value: string) => Promise<void>` |
| `get` | `(key: string) => Promise<string \| null>` |
| `setBytes` / `getBytes` | `Uint8Array` variants |
| `delete` | `(key: string) => Promise<void>` |
| `list` | `() => Promise<string[]>` (sorted) |
| `clear` | `() => Promise<void>` |

Each `service` gets its own IndexedDB database (`hudvault:<service>`). Failures throw `HudVaultError` with `code` ∈ `idb_unsupported` \| `crypto_unsupported` \| `encoding_failed` \| `idb_failed` \| `crypto_failed`.

### Requirements

- `crypto.subtle` — HTTPS or `localhost`.
- `IndexedDB` — universal in modern browsers.

### Threat model

Defends against cross-origin snooping and casual inspection of `localStorage` / IDB. The encryption key is non-extractable (`exportKey` will fail). Does **not** defend against:

- the user clearing browsing data — items are gone, irrecoverable;
- malicious code running on the same origin — it can call `get` directly;
- shared OS profiles that share the browser profile.

No passphrase in v1 — to add one, derive a key with PBKDF2 / Argon2 and wrap the master key yourself.
