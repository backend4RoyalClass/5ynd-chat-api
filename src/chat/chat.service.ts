import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { MessageDbService } from './message-db.service';
import { ChatMessage, MessageResponse } from './interfaces/message.interface';

@Injectable()
export class ChatService {
  constructor(
    private redisService: RedisService,
    private messageDbService: MessageDbService,
  ) {}

  async sendMessage(body: any, user: any): Promise<MessageResponse> {
    try {
      const { to, message, messageBack, type } = body;
      
      if (!to || !message || !messageBack) {
        return { success: false, error: 'Invalid Body' };
      }

      const { userId, isWeb } = user;
      const chatId = `${userId}-${to}-${new Date().getTime()}`;
      
      const msg: ChatMessage = {
        id: chatId,
        from: userId,
        to: to,
        message: message,
        messageBack: messageBack,
        type: type || 'text',
        createdAt: new Date(),
        isWeb: isWeb,
        delivered: false
      };

      // Store message in MongoDB conversation
      await this.messageDbService.addMessage(to, userId, message, messageBack, chatId);

      // Check if users are online
      const endPeerWeb = await this.redisService.getData('web', to);
      const endPeerMobile = await this.redisService.getData('mobile', to);
      
      let intoCW = false;
      let messageStatus = 0; // 0: offline, 1: seen, 2: delivered

      // Handle pending messages for web
      if (!endPeerWeb) {
        const pending = await this.redisService.getData('pending_web', to) || [];
        pending.push(msg);
        await this.redisService.setData('pending_web', to, pending, 2);
        
        // Also store in MongoDB
        await this.messageDbService.storePendingMessage(`${to}_web`, {
          id: chatId,
          from: userId,
          msg: message,
          date: new Date()
        });
      } else {
        if (endPeerWeb.into === userId) intoCW = true;
      }

      // Handle pending messages for mobile
      if (!endPeerMobile) {
        const pending = await this.redisService.getData('pending_mobile', to) || [];
        pending.push(msg);
        await this.redisService.setData('pending_mobile', to, pending, 2);
        
        // Also store in MongoDB
        await this.messageDbService.storePendingMessage(`${to}_mobile`, {
          id: chatId,
          from: userId,
          msg: message,
          date: new Date()
        });
      } else {
        if (endPeerMobile.into === userId) intoCW = true;
      }

      if (!endPeerWeb && !endPeerMobile) {
        messageStatus = 0; // offline
      } else if (intoCW) {
        messageStatus = 1; // seen
      } else {
        messageStatus = 2; // delivered
      }

      let response: MessageResponse;
      switch (messageStatus) {
        case 1:
          msg.delivered = true;
          response = {
            success: true,
            data: {
              status: 'seen',
              chatId,
              createdAt: msg.createdAt,
              deliveredAt: msg.createdAt,
              seenAt: msg.createdAt
            }
          };
          break;
        case 2:
          msg.delivered = true;
          response = {
            success: true,
            data: {
              status: 'delivered',
              chatId,
              createdAt: msg.createdAt,
              deliveredAt: msg.createdAt
            }
          };
          // Publish seen pending
          await this.redisService.publish('SEEN_PENDING', JSON.stringify({ from: userId, to, id: chatId }));
          break;
        default:
          msg.delivered = false;
          response = {
            success: true,
            data: {
              status: 'sent',
              chatId,
              createdAt: msg.createdAt
            }
          };
          break;
      }

      // Handle sent back messages for cross-platform
      const myPeer = isWeb ? 
        await this.redisService.getData('mobile', userId) : 
        await this.redisService.getData('web', userId);

      if (!myPeer) {
        const topic = isWeb ? 'sent_mobile' : 'sent_web';
        const sent = await this.redisService.getData(topic, userId) || [];
        sent.push(msg);
        await this.redisService.setData(topic, userId, sent, 2);
      }

      // Publish to chat channel if user is online
      if (endPeerWeb || endPeerMobile) {
        setTimeout(async () => {
          await this.redisService.publish(`CHAT-${to}`, JSON.stringify(msg));
        }, 1000);
      }

      console.log(`Message stored and processed: ${chatId}`);
      return response;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return { success: false, error: error.message };
    }
  }

  async getMessageHistory(userId: string, chatUserId: string): Promise<any[]> {
    try {
      return await this.messageDbService.getConversationMessages(userId, chatUserId);
    } catch (error) {
      console.error('Error getting message history:', error);
      return [];
    }
  }
}