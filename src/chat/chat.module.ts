import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RedisService } from './redis.service';
import { MessageDbService } from './message-db.service';
import { Message, MessageSchema } from './schemas/message.schema';
import { PendingMessage, PendingMessageSchema } from './schemas/pending-message.schema';
import { Reading, ReadingSchema } from './schemas/reading.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: PendingMessage.name, schema: PendingMessageSchema },
      { name: Reading.name, schema: ReadingSchema },
    ]),
    AuthModule,
  ],
  providers: [
    {
      provide: 'CHAT_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisConfig: any = { db: 0 };

        if (configService.get('NODE_ENV') === 'production') {
          redisConfig.url = configService.get('REDIS_URL_CHAT');
        } else {
          redisConfig.host = configService.get('REDIS_HOST_CHAT') || '161.97.122.119';
          redisConfig.port = configService.get('REDIS_PORT_CHAT') || 30769;
          redisConfig.username = configService.get('REDIS_USER_CHAT') || 'default';
          redisConfig.password = configService.get('REDIS_PASSWORD_CHAT') || 'admin';
        }

        const redis = new Redis(redisConfig);
        redis.on('connect', () => {
          console.log('Connected to Redis for Chatting');
        });
        return redis;
      },
      inject: [ConfigService],
    },
    {
      provide: 'CHAT_PUBLISHER',
      useFactory: (configService: ConfigService) => {
        const redisConfig: any = { db: 0 };

        if (configService.get('NODE_ENV') === 'production') {
          redisConfig.url = configService.get('REDIS_URL_CHAT');
        } else {
          redisConfig.host = configService.get('REDIS_HOST_CHAT') || '161.97.122.119';
          redisConfig.port = configService.get('REDIS_PORT_CHAT') || 30769;
          redisConfig.username = configService.get('REDIS_USER_CHAT') || 'default';
          redisConfig.password = configService.get('REDIS_PASSWORD_CHAT') || 'admin';
        }

        return new Redis(redisConfig);
      },
      inject: [ConfigService],
    },
    ChatService,
    RedisService,
    MessageDbService,
  ],
  controllers: [ChatController],
  exports: [RedisService, MessageDbService], // Export these services
})
export class ChatModule {}