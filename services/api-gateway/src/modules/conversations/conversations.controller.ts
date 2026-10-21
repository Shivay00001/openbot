import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ConversationsService } from './conversations.service';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List user conversations' })
  async list(@Req() req: any, @Query('page') page?: number, @Query('pageSize') pageSize?: number) {
    const data = await this.service.list(req.user.id, page || 1, pageSize || 20);
    return { success: true, ...data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async get(@Req() req: any, @Param('id') id: string) {
    const data = await this.service.get(req.user.id, id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(@Req() req: any, @Body() body: { title?: string; mode?: string; modelConfig?: Record<string, unknown> }) {
    const data = await this.service.create(req.user.id, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation metadata' })
  async update(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; isPinned?: boolean; isArchived?: boolean }) {
    const data = await this.service.update(req.user.id, id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.service.delete(req.user.id, id);
    return { success: true };
  }
}
