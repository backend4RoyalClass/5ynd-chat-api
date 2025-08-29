import { Module } from '@nestjs/common';
import { EventManagementService } from './event-management.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule], // Import ChatModule to access MessageDbService
  providers: [EventManagementService],
})
export class EventModule {}