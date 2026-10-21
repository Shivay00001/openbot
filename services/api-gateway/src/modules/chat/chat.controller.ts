import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message and get AI response' })
  async sendMessage(@Req() req: any, @Body() body: {
    conversationId: string;
    message: string;
    model?: string;
    provider?: string;
    isZeroCloud?: boolean;
  }) {
    const data = await this.chatService.sendMessage(req.user.id, body);
    return { success: true, data };
  }
}
