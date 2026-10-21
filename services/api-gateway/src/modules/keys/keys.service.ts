/**
 * BYOK API Keys Service — Encrypted storage for user API keys
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { PrismaClient } from '@openbot/database';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'openbot-32-byte-encryption-key!!'; // Must be 32 bytes

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

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '****';
    }
  }
}
