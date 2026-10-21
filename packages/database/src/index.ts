/**
 * @openbot/database — Main Export
 * Re-exports Prisma Client and utility helpers.
 */

// Re-export the Prisma Client
export { PrismaClient } from '@prisma/client';
export type {
  User,
  OAuthAccount,
  Session,
  ApiKey,
  Conversation,
  Message,
  Skill,
  SkillExecution,
  Memory,
  Permission,
  BillingAccount,
  UsageRecord,
  TaskJob,
  UserRole,
  ConversationMode,
  MemoryCategory,
  BillingPlan,
} from '@prisma/client';

// ─── Singleton Prisma Instance ──────────────────────────────

const globalForPrisma = globalThis as unknown as { prisma?: InstanceType<typeof import('@prisma/client').PrismaClient> };

import { PrismaClient as PC } from '@prisma/client';

export const prisma = globalForPrisma.prisma ?? new PC({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
