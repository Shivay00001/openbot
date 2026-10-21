import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@openbot/database';

@Injectable()
export class SkillsService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async list(userId: string, includePublic = true) {
    const where = includePublic
      ? { OR: [{ userId }, { isPublic: true }] }
      : { userId };

    return this.prisma.skill.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, description: true, isPublic: true,
        tags: true, usageCount: true, createdAt: true,
      },
    });
  }

  async get(skillId: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  async create(userId: string, data: { name: string; description?: string; definition: Record<string, unknown>; isPublic?: boolean; tags?: string[] }) {
    return this.prisma.skill.create({
      data: { userId, ...data, definition: data.definition as any },
    });
  }

  async update(userId: string, skillId: string, data: { name?: string; description?: string; definition?: Record<string, unknown>; isPublic?: boolean; tags?: string[] }) {
    const skill = await this.prisma.skill.findFirst({ where: { id: skillId, userId } });
    if (!skill) throw new NotFoundException('Skill not found or not owned by user');
    return this.prisma.skill.update({
      where: { id: skillId },
      data: data as any,
    });
  }

  async delete(userId: string, skillId: string) {
    const skill = await this.prisma.skill.findFirst({ where: { id: skillId, userId } });
    if (!skill) throw new NotFoundException('Skill not found or not owned by user');
    await this.prisma.skill.delete({ where: { id: skillId } });
  }

  async execute(skillId: string, input?: Record<string, unknown>) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('Skill not found');

    const execution = await this.prisma.skillExecution.create({
      data: {
        skillId,
        status: 'pending',
        input: (input || {}) as any,
      },
    });

    // Increment usage count
    await this.prisma.skill.update({
      where: { id: skillId },
      data: { usageCount: { increment: 1 } },
    });

    // TODO: Queue skill execution via task-runner
    return execution;
  }
}
