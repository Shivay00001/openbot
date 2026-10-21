import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { PrismaClient } from '@openbot/database';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  @Get()
  @ApiOperation({ summary: 'Service health check' })
  async check() {
    const checks: Record<string, string> = {
      api: 'healthy',
      database: 'unknown',
      redis: 'unknown',
      ollama: 'unknown',
      aiEngine: 'unknown',
    };

    // Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'healthy';
    } catch { checks.database = 'unhealthy'; }

    // Redis
    try {
      const res = await fetch('http://localhost:6379', { signal: AbortSignal.timeout(1000) }).catch(() => null);
      checks.redis = res ? 'healthy' : 'unhealthy';
    } catch { checks.redis = 'unreachable'; }

    // Ollama
    try {
      const res = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`, { signal: AbortSignal.timeout(1000) });
      checks.ollama = res.ok ? 'healthy' : 'unhealthy';
    } catch { checks.ollama = 'unreachable'; }

    // AI Engine
    try {
      const res = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:4001'}/health`, { signal: AbortSignal.timeout(1000) });
      checks.aiEngine = res.ok ? 'healthy' : 'unhealthy';
    } catch { checks.aiEngine = 'unreachable'; }

    const isHealthy = checks.api === 'healthy' && checks.database === 'healthy';

    return {
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        checks,
      },
    };
  }
}
