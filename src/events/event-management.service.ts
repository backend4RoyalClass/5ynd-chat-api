import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MessageDbService } from '../chat/message-db.service';

@Injectable()
export class EventManagementService implements OnModuleInit, OnModuleDestroy {
  private chatSubscriber: Redis;
  private chatRedisClient: Redis;

  constructor(
    private configService: ConfigService,
    private messageDbService: MessageDbService
  ) {}

  async onModuleInit() {
    // Initialize Redis connections
    const redisConfig: any = { db: 0 };

    if (this.configService.get('NODE_ENV') === 'production') {
      redisConfig.url = this.configService.get('REDIS_URL_CHAT');
    } else {
      redisConfig.host = this.configService.get('REDIS_HOST_CHAT') || '161.97.122.119';
      redisConfig.port = this.configService.get('REDIS_PORT_CHAT') || 30769;
      redisConfig.username = this.configService.get('REDIS_USER_CHAT') || 'default';
      redisConfig.password = this.configService.get('REDIS_PASSWORD_CHAT') || 'admin';
    }

    this.chatRedisClient = new Redis(redisConfig);
    this.chatSubscriber = this.chatRedisClient.duplicate();

    // Subscribe to chat-related channels
    await this.subscribeToChatChannels();
  }

  async onModuleDestroy() {
    await this.chatSubscriber.quit();
    await this.chatRedisClient.quit();
  }

  private async subscribeToChatChannels() {
    const channels = [
      'DELIVERY_CACHE_WEB', 'DELIVERY_CACHE_MOBILE', 
      'SEEN_PENDING', 'SEEN_CACHE_WEB', 'SEEN_CACHE_MOBILE',
      'PENDING_MESSAGE_DELIVERED' // New channel for delivered pending messages
    ];
    
    await this.chatSubscriber.subscribe(...channels);
    Logger.log('Subscribed to chat channels:', channels);
    
    this.chatSubscriber.on('message', async (channel, message) => {
      Logger.log(`Received message from ${channel}: ${message}`);
      const msg = JSON.parse(message);
      
      switch (channel) {
        case 'DELIVERY_CACHE_WEB':
          await this.handleDeliveryCache(msg, 'web');
          break;
        case 'DELIVERY_CACHE_MOBILE':
          await this.handleDeliveryCache(msg, 'mobile');
          break;
        case 'SEEN_PENDING':
          await this.handleSeenPendingCache(msg);
          break;
        case 'SEEN_CACHE_WEB':
          await this.handleSeenCache(msg, 'web');
          break;
        case 'SEEN_CACHE_MOBILE':
          await this.handleSeenCache(msg, 'mobile');
          break;
        case 'PENDING_MESSAGE_DELIVERED':
          await this.handlePendingMessageDelivered(msg);
          break;
        default:
          break;
      }
    });
  }

  private async handleDeliveryCache(msg: any, type: string) {
    Logger.log(`Handling delivery cache for ${type}:`, msg);
    try {
      // Mark message as delivered in MongoDB
      await this.messageDbService.markMessageAsDelivered(msg.id);
      Logger.log(`Message ${msg.id} marked as delivered in MongoDB`);
    } catch (error) {
      Logger.error(`Error handling delivery cache: ${error.message}`);
    }
  }

  private async handleSeenCache(msg: any, type: string) {
    Logger.log(`Handling seen cache for ${type}:`, msg);
    try {
      // Mark message as seen in MongoDB
      await this.messageDbService.markMessageAsSeen(msg.id);
      Logger.log(`Message ${msg.id} marked as seen in MongoDB`);
    } catch (error) {
      Logger.error(`Error handling seen cache: ${error.message}`);
    }
  }

  private async handlePendingMessageDelivered(msg: any) {
    Logger.log('Handling pending message delivered:', msg);
    try {
      const { toUserId, fromUserId, messageContent, messageBackContent, messageId } = msg;
      
      // Move pending message to conversation storage
      await this.messageDbService.deliverPendingMessage(
        toUserId, 
        fromUserId, 
        messageContent, 
        messageBackContent, 
        messageId
      );
      
      Logger.log(`Pending message ${messageId} successfully delivered and stored in MongoDB`);
    } catch (error) {
      Logger.error(`Error handling pending message delivery: ${error.message}`);
    }
  }

  private async handleSeenPendingCache(msg: any) {
    Logger.log('Handling seen pending cache:', msg);
    try {
      // Mark message as seen in MongoDB
      await this.messageDbService.markMessageAsSeen(msg.id);
      Logger.log(`Message ${msg.id} marked as seen in MongoDB`);
    } catch (error) {
      Logger.error(`Error handling seen pending cache: ${error.message}`);
    }
  }

  async publish(channel: string, message: string) {
    await this.chatRedisClient.publish(channel, message);
    Logger.log(`Published to [${channel}]:`, message);
  }
}