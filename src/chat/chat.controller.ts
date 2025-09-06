import { Controller, Post, Get, Body, UseGuards, Req, Query, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Body() body: any, @Req() req: any) {
    return await this.chatService.sendMessage(body, req.user);
  }

  @Get(':chatId')
  @UseGuards(JwtAuthGuard)
  async getMessageHistory(
    @Param('chatId') chatId: string,
    @Req() req: any
  ) {
    const { userId } = req.user;
    const messages = await this.chatService.getMessageHistory(userId, chatId);
    return { success: true, data: messages };
  }
}