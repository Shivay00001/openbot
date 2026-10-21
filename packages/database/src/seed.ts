/**
 * @openbot/database — Seed Script
 * Populates the database with initial data for development.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OpenBot database...');

  // Create default admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@openbot.dev' },
    update: {},
    create: {
      email: 'admin@openbot.dev',
      name: 'OpenBot Admin',
      passwordHash: crypto.createHash('sha256').update('admin123').digest('hex'),
      role: 'ADMIN',
      emailVerified: true,
      settings: {
        defaultModel: {
          provider: 'ollama',
          model: 'deepseek-r1-distill-qwen-1.5b-q4',
        },
        theme: 'dark',
        privacy: {
          saveConversations: true,
          saveMemory: true,
          analyticsEnabled: false,
        },
      },
    },
  });

  console.log(`  ✓ Admin user: ${admin.email}`);

  // Create demo user
  const demo = await prisma.user.upsert({
    where: { email: 'demo@openbot.dev' },
    update: {},
    create: {
      email: 'demo@openbot.dev',
      name: 'Demo User',
      passwordHash: crypto.createHash('sha256').update('demo123').digest('hex'),
      role: 'USER',
      emailVerified: true,
      settings: {
        defaultModel: {
          provider: 'ollama',
          model: 'qwen2.5-coder-1.5b-q4',
        },
        theme: 'dark',
        privacy: {
          saveConversations: true,
          saveMemory: true,
          analyticsEnabled: false,
        },
      },
    },
  });

  console.log(`  ✓ Demo user: ${demo.email}`);

  // Create billing accounts
  for (const user of [admin, demo]) {
    await prisma.billingAccount.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        plan: user.role === 'ADMIN' ? 'ENTERPRISE' : 'FREE',
        monthlyTokenLimit: user.role === 'ADMIN' ? BigInt(100_000_000) : BigInt(1_000_000),
      },
    });
  }
  console.log('  ✓ Billing accounts created');

  // Create a sample conversation
  const conv = await prisma.conversation.create({
    data: {
      userId: demo.id,
      title: 'Welcome to OpenBot',
      mode: 'CHAT',
      modelConfig: { provider: 'ollama', model: 'deepseek-r1-distill-qwen-1.5b-q4' },
      messages: {
        create: [
          {
            role: 'assistant',
            content: '👋 Hello! I am OpenBot, your universal autonomous AI agent. How can I help you today?',
            metadata: { source: 'seed' },
          },
        ],
      },
    },
  });
  console.log(`  ✓ Sample conversation: ${conv.title}`);

  // Create built-in skills
  const skills = [
    {
      name: 'Web Research',
      description: 'Search the web, read pages, and compile a research summary on any topic.',
      definition: {
        triggers: [{ type: 'keyword', value: 'research' }],
        steps: [
          { type: 'tool', toolName: 'web_search', content: 'Search for the topic' },
          { type: 'tool', toolName: 'read_url', content: 'Read top results' },
          { type: 'prompt', content: 'Compile research summary' },
        ],
      },
      tags: ['research', 'web', 'search'],
      isPublic: true,
    },
    {
      name: 'Daily Digest',
      description: 'Scheduled skill that compiles news, weather, and calendar events every morning.',
      definition: {
        triggers: [{ type: 'cron', value: '0 8 * * *' }],
        steps: [
          { type: 'tool', toolName: 'web_search', content: 'Get top news' },
          { type: 'prompt', content: 'Compile daily digest' },
        ],
      },
      tags: ['scheduled', 'daily', 'news'],
      isPublic: true,
    },
    {
      name: 'Code Review',
      description: 'Analyze a code file or diff and provide detailed review with suggestions.',
      definition: {
        triggers: [{ type: 'keyword', value: 'review' }],
        steps: [
          { type: 'tool', toolName: 'read_file', content: 'Read the code file' },
          { type: 'prompt', content: 'Analyze code quality, bugs, and improvements' },
        ],
      },
      tags: ['code', 'review', 'development'],
      isPublic: true,
    },
  ];

  for (const skill of skills) {
    await prisma.skill.create({
      data: {
        userId: admin.id,
        ...skill,
        definition: skill.definition as any,
      },
    });
  }
  console.log(`  ✓ ${skills.length} built-in skills created`);

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
