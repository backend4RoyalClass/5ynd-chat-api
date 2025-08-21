import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messageDummy')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Body() body: any, @Req() req: any) {
    return await this.chatService.sendMessage(body, req.user);
  }
}