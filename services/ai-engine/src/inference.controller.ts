import { Controller, Post, Get, Body } from '@nestjs/common';
import { InferenceService } from './inference.service';

@Controller('inference')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Post()
  async runInference(@Body() body: {
    message: string;
    messages: Array<{ role: string; content: string }>;
    model: string;
    provider: string;
    apiKey?: string;
    isZeroCloud: boolean;
    userId: string;
  }) {
    return this.inferenceService.runInference(body);
  }

  @Get('/health')
  health() {
    return { status: 'healthy', service: 'ai-engine', timestamp: new Date().toISOString() };
  }
}
