import { Controller, Get, Patch, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: any) {
    const data = await this.usersService.getProfile(req.user.id);
    return { success: true, data };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Req() req: any, @Body() body: { name?: string; avatarUrl?: string; settings?: Record<string, unknown> }) {
    const data = await this.usersService.updateProfile(req.user.id, body);
    return { success: true, data };
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account' })
  async deleteAccount(@Req() req: any) {
    await this.usersService.deleteAccount(req.user.id);
    return { success: true };
  }
}
