import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  @Get('providers')
  @ApiOperation({ summary: 'List all model providers and their status' })
  async getProviders() {
    const providers = [
      { provider: 'openai', displayName: 'OpenAI', isLocal: false, models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
      { provider: 'anthropic', displayName: 'Anthropic', isLocal: false, models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'] },
      { provider: 'google', displayName: 'Google Gemini', isLocal: false, models: ['gemini-2.5-pro', 'gemini-2.0-flash'] },
      { provider: 'xai', displayName: 'xAI Grok', isLocal: false, models: ['grok-3', 'grok-3-mini'] },
      { provider: 'deepseek', displayName: 'DeepSeek', isLocal: false, models: ['deepseek-chat', 'deepseek-reasoner'] },
      { provider: 'mistral', displayName: 'Mistral AI', isLocal: false, models: ['mistral-large-latest', 'mistral-small-latest'] },
      { provider: 'ollama', displayName: 'Ollama (Local)', isLocal: true, models: [] as string[] },
    ];

    // Check Ollama for local models
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        providers.find((p) => p.provider === 'ollama')!.models = (data.models || []).map((m: any) => m.name);
      }
    } catch { /* Ollama not running */ }

    return { success: true, data: providers };
  }

  @Get('local')
  @ApiOperation({ summary: 'List locally available models (Ollama)' })
  async getLocalModels() {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        return { success: true, data: { models: data.models || [], running: true } };
      }
    } catch { /* Ollama not running */ }
    return { success: true, data: { models: [], running: false } };
  }
}
