/**
 * OpenBot API Gateway — Root Application Module
 * Orchestrates all feature modules: Auth, Users, Conversations, Skills, Billing, Keys, Health.
 */

import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { ChatModule } from './modules/chat/chat.module';
import { SkillsModule } from './modules/skills/skills.module';
import { KeysModule } from './modules/keys/keys.module';
import { BillingModule } from './modules/billing/billing.module';
import { ModelsModule } from './modules/models/models.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Core infrastructure
    DatabaseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ConversationsModule,
    ChatModule,
    SkillsModule,
    KeysModule,
    BillingModule,
    ModelsModule,
    HealthModule,
  ],
  providers: [
    // Apply rate limiting globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
