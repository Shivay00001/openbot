import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@openbot/database';
import { SkillEngine } from '@openbot/core/skills';
import { ToolRegistry } from '@openbot/core/tools';

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

  /**
   * Execute a skill for real: the stored definition is loaded into the core
   * SkillEngine and replayed step-by-step through the core ToolRegistry.
   * The SkillExecution row tracks running → completed/failed with the real
   * per-step output.
   */
  async execute(skillId: string, input?: Record<string, unknown>) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('Skill not found');

    const startedAt = Date.now();
    const execution = await this.prisma.skillExecution.create({
      data: {
        skillId,
        status: 'running',
        input: (input || {}) as any,
      },
    });

    await this.prisma.skill.update({
      where: { id: skillId },
      data: { usageCount: { increment: 1 } },
    });

    try {
      const definition = (skill.definition || {}) as any;
      const engine = new SkillEngine({ persist: false });
      const registered = engine.createSkill({
        name: skill.name,
        description: skill.description || '',
        userId: skill.userId,
        definition: {
          steps: Array.isArray(definition.steps) ? definition.steps : [],
          triggers: Array.isArray(definition.triggers) ? definition.triggers : [],
        },
        tags: skill.tags || [],
      });

      const result = await engine.executeSkill(registered.id, new ToolRegistry(), (input || {}) as Record<string, any>);

      return this.prisma.skillExecution.update({
        where: { id: execution.id },
        data: {
          status: result.success ? 'completed' : 'failed',
          output: result as any,
          error: result.error || null,
          duration: Date.now() - startedAt,
        },
      });
    } catch (err: any) {
      return this.prisma.skillExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: err.message || 'Skill execution failed',
          duration: Date.now() - startedAt,
        },
      });
    }
  }
}
