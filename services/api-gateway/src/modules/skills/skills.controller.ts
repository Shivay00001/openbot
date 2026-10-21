import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SkillsService } from './skills.service';

@ApiTags('skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List user skills and public skills' })
  async list(@Req() req: any) {
    const data = await this.service.list(req.user.id);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get skill details' })
  async get(@Param('id') id: string) {
    const data = await this.service.get(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new skill' })
  async create(@Req() req: any, @Body() body: { name: string; description?: string; definition: Record<string, unknown>; isPublic?: boolean; tags?: string[] }) {
    const data = await this.service.create(req.user.id, body);
    return { success: true, data };
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a skill' })
  async execute(@Param('id') id: string, @Body() body: { input?: Record<string, unknown> }) {
    const data = await this.service.execute(id, body.input);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a skill' })
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.service.update(req.user.id, id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a skill' })
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.service.delete(req.user.id, id);
    return { success: true };
  }
}
