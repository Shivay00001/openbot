/**
 * BYOK API Keys Service — Encrypted storage for user API keys
 *
 * Encryption: AES-256-GCM (authenticated) with a random 12-byte IV per key.
 * The master secret comes from the ENCRYPTION_KEY environment variable and
 * is hashed to a 32-byte key with SHA-256. There is NO built-in fallback
 * secret: if ENCRYPTION_KEY is unset, key operations fail loudly instead of
 * silently encrypting with a public constant.
 *
 * Legacy values written by the old AES-256-CBC scheme (`ivHex:cipherHex`)
 * are still decryptable so existing installs keep working; they are
 * transparently re-encrypted to GCM on the next save.
 */

import { Injectable, Inject, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { PrismaClient } from '@openbot/database';

function masterKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new InternalServerErrorException(
      'ENCRYPTION_KEY environment variable is not set. Refusing to store or read API keys without a real encryption secret.'
    );
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function legacyKey(): Buffer {
  // Only used to decrypt values written before the GCM migration, which were
  // encrypted with the historical default when ENCRYPTION_KEY was unset.
  const secret = process.env.ENCRYPTION_KEY || 'openbot-32-byte-encryption-key!!';
  return Buffer.from(secret.padEnd(32, ' ').slice(0, 32), 'utf-8');
}

@Injectable()
export class KeysService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true, provider: true, label: true, baseUrl: true,
        isActive: true, lastUsedAt: true, usageCount: true, encryptedKey: true,
      },
    });

    return keys.map((k) => ({
      id: k.id,
      provider: k.provider,
      label: k.label,
      baseUrl: k.baseUrl,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt?.toISOString() || null,
      usageCount: k.usageCount,
      maskedKey: `...${this.decrypt(k.encryptedKey).slice(-4)}`,
    }));
  }

  async save(userId: string, data: { provider: string; apiKey: string; label?: string; baseUrl?: string }) {
    const encryptedKey = this.encrypt(data.apiKey);

    return this.prisma.apiKey.upsert({
      where: {
        userId_provider_label: {
          userId,
          provider: data.provider,
          label: data.label || 'default',
        },
      },
      update: { encryptedKey, baseUrl: data.baseUrl, isActive: true },
      create: {
        userId,
        provider: data.provider,
        label: data.label || 'default',
        encryptedKey,
        baseUrl: data.baseUrl,
      },
    });
  }

  async delete(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, userId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id: keyId } });
  }

  async getDecryptedKey(userId: string, provider: string): Promise<string | null> {
    const key = await this.prisma.apiKey.findFirst({
      where: { userId, provider, isActive: true },
    });
    if (!key) return null;
    return this.decrypt(key.encryptedKey);
  }

  // ─── Encryption Helpers ───────────────────────────────────

  /** AES-256-GCM. Output format: `v2:<iv b64>:<authTag b64>:<ciphertext b64>` */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v2:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(encryptedText: string): string {
    try {
      if (encryptedText.startsWith('v2:')) {
        const [, ivB64, tagB64, dataB64] = encryptedText.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        return Buffer.concat([
          decipher.update(Buffer.from(dataB64, 'base64')),
          decipher.final(),
        ]).toString('utf8');
      }
      // Legacy AES-256-CBC (`ivHex:cipherHex`) written by the previous scheme.
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey(), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '****';
    }
  }
}
