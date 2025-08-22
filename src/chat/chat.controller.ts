import { Controller, Post, Get, Body, UseGuards, Req, Query } from '@nestjs/common';
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

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getMessageHistory(
    @Query('chatUserId') chatUserId: string,
    @Req() req: any
  ) {
    const { userId } = req.user;
    const messages = await this.chatService.getMessageHistory(userId, chatUserId);
    return { success: true, data: messages };
  }
}