/**
 * Chat Service — Proxies inference requests to the AI Engine service.
 * Handles message persistence, usage tracking, and billing checks.
 */

import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@openbot/database';
import { KeysService } from '../keys/keys.service';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:4001';

@Injectable()
export class ChatService {
  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    private readonly keysService: KeysService,
  ) {}

  async sendMessage(userId: string, data: {
    conversationId: string;
    message: string;
    model?: string;
    provider?: string;
    isZeroCloud?: boolean;
  }) {
    // 1. Check billing quota
    const billing = await this.prisma.billingAccount.findUnique({ where: { userId } });
    if (billing && billing.tokensUsedThisMonth >= billing.monthlyTokenLimit) {
      throw new ForbiddenException('Monthly token quota exceeded. Upgrade your plan or use local models.');
    }

    // 2. Persist user message
    const userMsg = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: 'user',
        content: data.message,
      },
    });

    // 3. Fetch user's API keys for the selected provider
    let apiKey: string | undefined;
    if (data.provider && data.provider !== 'ollama' && data.provider !== 'lmstudio') {
      const key = await this.prisma.apiKey.findFirst({
        where: { userId, provider: data.provider, isActive: true },
      });
      if (key) {
        // Decrypt the stored key with KeysService (AES-256-GCM) — the raw
        // ciphertext must never be sent to the AI engine as if it were a key.
        const decrypted = await this.keysService.getDecryptedKey(userId, data.provider);
        if (decrypted && decrypted !== '****') {
          apiKey = decrypted;
        }
        await this.prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
        });
      }
    }

    // 4. Get conversation history
    const history = await this.prisma.message.findMany({
      where: { conversationId: data.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { role: true, content: true },
    });

    // 5. Call AI Engine service
    try {
      const response = await fetch(`${AI_ENGINE_URL}/api/v1/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data.message,
          messages: history.reverse(),
          model: data.model || 'deepseek-r1-distill-qwen-1.5b-q4',
          provider: data.provider || 'ollama',
          apiKey,
          isZeroCloud: data.isZeroCloud ?? true,
          userId,
        }),
        signal: AbortSignal.timeout(120000), // 2 minute timeout
      });

      const result = await response.json();

      // 6. Persist assistant message
      const assistantMsg = await this.prisma.message.create({
        data: {
          conversationId: data.conversationId,
          role: 'assistant',
          content: result.content || '',
          metadata: {
            thinking: result.thinking,
            toolCalls: result.toolCalls,
            model: result.model,
            latencyMs: result.latencyMs,
          },
          tokenCount: result.usage?.totalTokens,
          costUsd: result.usage?.costUsd,
        },
      });

      // 7. Update billing usage
      if (result.usage?.totalTokens && billing) {
        await this.prisma.billingAccount.update({
          where: { id: billing.id },
          data: { tokensUsedThisMonth: { increment: BigInt(result.usage.totalTokens) } },
        });

        await this.prisma.usageRecord.create({
          data: {
            billingAccountId: billing.id,
            provider: data.provider || 'ollama',
            model: data.model || 'local',
            promptTokens: result.usage.promptTokens || 0,
            completionTokens: result.usage.completionTokens || 0,
            totalTokens: result.usage.totalTokens,
            costUsd: result.usage.costUsd || 0,
            conversationId: data.conversationId,
          },
        });
      }

      // 8. Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
      });

      return {
        messageId: assistantMsg.id,
        role: 'assistant' as const,
        content: result.content,
        thinking: result.thinking,
        toolCalls: result.toolCalls,
        model: result.model,
        usage: result.usage,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      // Persist error message
      await this.prisma.message.create({
        data: {
          conversationId: data.conversationId,
          role: 'assistant',
          content: `⚠️ Inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: { error: true },
        },
      });

      throw error;
    }
  }
}
