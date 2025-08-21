import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { EventModule } from './events/event.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot('mongodb://mongo.5ynd.net:27017/chat_db'),
    AuthModule,
    ChatModule,
    EventModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}