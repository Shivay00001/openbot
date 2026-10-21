/**
 * OpenBot AI Engine — Entry Point
 * Handles all LLM inference, model routing, tool execution, and agent orchestration.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api/v1');

  const port = process.env.AI_ENGINE_PORT || 4001;
  await app.listen(port);
  console.log(`
╔══════════════════════════════════════════════════╗
║   🧠 OpenBot AI Engine                          ║
║   Running on: http://localhost:${port}              ║
║   Mode: ${process.env.NODE_ENV || 'development'}                              ║
╚══════════════════════════════════════════════════╝
  `);
}

bootstrap();
