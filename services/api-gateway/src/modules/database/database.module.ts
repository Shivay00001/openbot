/**
 * Database Module — Prisma Client Provider
 * Shared across all API Gateway modules.
 */

import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@openbot/database';

@Global()
@Module({
  providers: [
    {
      provide: 'PRISMA',
      useFactory: () => {
        const prisma = new PrismaClient({
          log: process.env.NODE_ENV === 'development'
            ? ['warn', 'error']
            : ['error'],
        });
        return prisma;
      },
    },
  ],
  exports: ['PRISMA'],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  async onModuleInit() {
    // Prisma connects lazily, but we can trigger it here
    try {
      await (this as any).prisma?.$connect?.();
    } catch {
      // Connection will be established on first query
    }
  }

  async onModuleDestroy() {
    try {
      await (this as any).prisma?.$disconnect?.();
    } catch {
      // Ignore disconnect errors
    }
  }
}
