/**
 * BYOK Key Vault 🔑
 * Local, encrypted-at-rest storage for user-supplied provider API keys.
 *
 * - Cipher: AES-256-GCM (authenticated encryption) via node:crypto.
 * - Key derivation: scrypt(passphrase, random salt) when a passphrase is
 *   supplied (argument or OPENBOT_VAULT_PASSPHRASE env). Without a
 *   passphrase, a random 32-byte machine key is generated once and stored
 *   next to the vault with 0600 permissions.
 * - Storage: a single JSON file (default `.openbot_data/vault.json`).
 *   Plaintext keys are never written to disk and never logged.
 *
 * Node.js only (uses fs/crypto). In browser builds, construct with
 * `storage: 'memory'` for an in-memory vault (nothing persists).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface VaultEntry {
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
  updatedAt: number;
}

interface VaultFile {
  version: 1;
  salt: string; // hex — scrypt salt (passphrase mode) or empty (machine-key mode)
  mode: 'passphrase' | 'machine';
  entries: Record<string, VaultEntry>;
}

export interface KeyVaultOptions {
  /** Directory that holds vault.json (default: <cwd>/.openbot_data) */
  dir?: string;
  /** Passphrase for scrypt key derivation. Falls back to OPENBOT_VAULT_PASSPHRASE. */
  passphrase?: string;
  /** 'file' (default) persists to disk; 'memory' keeps entries in-process only. */
  storage?: 'file' | 'memory';
}

const ALGO = 'aes-256-gcm';

export class KeyVault {
  private readonly dir: string;
  private readonly filePath: string;
  private readonly keyFilePath: string;
  private readonly storage: 'file' | 'memory';
  private readonly passphrase?: string;
  private file: VaultFile;
  private derivedKey: Buffer | null = null;

  constructor(options: KeyVaultOptions = {}) {
    this.dir = options.dir || path.resolve(process.cwd(), '.openbot_data');
    this.filePath = path.join(this.dir, 'vault.json');
    this.keyFilePath = path.join(this.dir, 'vault.key');
    this.storage = options.storage || 'file';
    this.passphrase = options.passphrase || process.env.OPENBOT_VAULT_PASSPHRASE;
    this.file = this.load();
  }

  // ─── Public API ─────────────────────────────────────────────────

  /** Store (or replace) the API key for a provider. */
  set(provider: string, apiKey: string): void {
    const key = this.getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const data = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    this.file.entries[provider] = {
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      data: data.toString('hex'),
      updatedAt: Date.now(),
    };
    this.persist();
  }

  /** Retrieve the plaintext API key for a provider, or null if absent. */
  get(provider: string): string | null {
    const entry = this.file.entries[provider];
    if (!entry) return null;
    try {
      const key = this.getKey();
      const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(entry.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(entry.data, 'hex')),
        decipher.final(),
      ]);
      return plain.toString('utf8');
    } catch {
      // Wrong passphrase or corrupted entry — fail closed, never guess.
      return null;
    }
  }

  /** Remove a provider's key. Returns true if one existed. */
  delete(provider: string): boolean {
    if (!this.file.entries[provider]) return false;
    delete this.file.entries[provider];
    this.persist();
    return true;
  }

  has(provider: string): boolean {
    return Boolean(this.file.entries[provider]);
  }

  /** Provider names with stored keys — never the keys themselves. */
  listProviders(): string[] {
    return Object.keys(this.file.entries);
  }

  // ─── Internals ──────────────────────────────────────────────────

  private getKey(): Buffer {
    if (this.derivedKey) return this.derivedKey;

    if (this.passphrase) {
      const salt = this.file.salt
        ? Buffer.from(this.file.salt, 'hex')
        : crypto.randomBytes(16);
      if (!this.file.salt) {
        this.file.salt = salt.toString('hex');
        this.file.mode = 'passphrase';
      }
      this.derivedKey = crypto.scryptSync(this.passphrase, salt, 32);
      return this.derivedKey;
    }

    // Machine-key mode: random key persisted with owner-only permissions.
    if (this.storage === 'file') {
      fs.mkdirSync(this.dir, { recursive: true });
      if (fs.existsSync(this.keyFilePath)) {
        const raw = fs.readFileSync(this.keyFilePath);
        if (raw.length === 32) {
          this.derivedKey = raw;
          return this.derivedKey;
        }
      }
      const key = crypto.randomBytes(32);
      fs.writeFileSync(this.keyFilePath, key, { mode: 0o600 });
      this.derivedKey = key;
      return this.derivedKey;
    }

    this.derivedKey = crypto.randomBytes(32);
    return this.derivedKey;
  }

  private load(): VaultFile {
    const empty: VaultFile = { version: 1, salt: '', mode: 'machine', entries: {} };
    if (this.storage !== 'file') return empty;
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as VaultFile;
        if (parsed && parsed.version === 1 && parsed.entries) return parsed;
      }
    } catch {
      // Corrupt vault file — start empty rather than crash the host app.
    }
    return empty;
  }

  private persist(): void {
    if (this.storage !== 'file') return;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.file, null, 2), { mode: 0o600 });
  }
}
