import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@openbot/database';

@Injectable()
export class ConversationsService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async list(userId: string, page = 1, pageSize = 20) {
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId, isArchived: false },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where: { userId, isArchived: false } }),
    ]);

    return {
      items: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        mode: c.mode,
        messageCount: c._count.messages,
        lastMessagePreview: c.messages[0]?.content?.substring(0, 100) || null,
        isPinned: c.isPinned,
        updatedAt: c.updatedAt.toISOString(),
      })),
      meta: { page, pageSize, total },
    };
  }

  async get(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async create(userId: string, data: { title?: string; mode?: string; modelConfig?: Record<string, unknown> }) {
    return this.prisma.conversation.create({
      data: {
        userId,
        title: data.title || 'New Conversation',
        mode: (data.mode as any) || 'CHAT',
        modelConfig: (data.modelConfig || {}) as any,
      },
    });
  }

  async update(userId: string, conversationId: string, data: { title?: string; isPinned?: boolean; isArchived?: boolean }) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data,
    });
  }

  async delete(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }

  async addMessage(conversationId: string, data: { role: string; content: string; metadata?: any; toolCalls?: any; toolCallId?: string; tokenCount?: number; costUsd?: number }) {
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        ...data,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  }
}
