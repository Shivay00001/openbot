/**
 * OpenBot API Gateway — Entry Point
 * NestJS application bootstrap with Swagger, CORS, Helmet, and WebSocket.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Security
  app.use(helmet());
  app.enableCors({
    origin: [
      'http://localhost:3000',       // Web app
      'http://localhost:4002',       // Realtime server
      'tauri://localhost',           // Tauri desktop app
      'capacitor://localhost',       // Mobile app
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger API docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('OpenBot API')
    .setDescription('Universal Autonomous AI Agent Platform — REST & WebSocket API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & user registration')
    .addTag('users', 'User profile & settings management')
    .addTag('conversations', 'Conversation CRUD & message history')
    .addTag('chat', 'AI inference & agent execution')
    .addTag('skills', 'Skill studio & teach-a-task')
    .addTag('keys', 'BYOK API key vault')
    .addTag('billing', 'Usage tracking & billing')
    .addTag('models', 'Model provider registry')
    .addTag('health', 'Service health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.API_GATEWAY_PORT || 4000;
  await app.listen(port);
  console.log(`
╔══════════════════════════════════════════════════╗
║   🤖 OpenBot API Gateway                        ║
║   Running on: http://localhost:${port}              ║
║   Swagger:    http://localhost:${port}/docs           ║
║   Environment: ${process.env.NODE_ENV || 'development'}                    ║
╚══════════════════════════════════════════════════╝
  `);
}

bootstrap();
