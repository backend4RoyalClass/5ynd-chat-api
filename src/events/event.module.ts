import { Module } from '@nestjs/common';
import { EventManagementService } from './event-management.service';

@Module({
  providers: [EventManagementService],
})
export class EventModule {}