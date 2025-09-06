import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { EventModule } from './events/event.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: process.env.MONGO_URI || 'mongodb://localhost:27017/chat',
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary',
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }),
    }),
    ChatModule, // Import ChatModule first (contains RedisService)
    AuthModule, // Then AuthModule
    EventModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }