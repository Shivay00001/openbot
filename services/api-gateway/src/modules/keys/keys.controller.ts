import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { KeysService } from './keys.service';

@ApiTags('keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('keys')
export class KeysController {
  constructor(private readonly service: KeysService) {}

  @Get()
  @ApiOperation({ summary: 'List user API keys (masked)' })
  async list(@Req() req: any) {
    const data = await this.service.list(req.user.id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Save or update an API key' })
  async save(@Req() req: any, @Body() body: { provider: string; apiKey: string; label?: string; baseUrl?: string }) {
    await this.service.save(req.user.id, body);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an API key' })
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.service.delete(req.user.id, id);
    return { success: true };
  }
}
