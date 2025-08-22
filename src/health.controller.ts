import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  async health() {
    return 'OK';
  }

  @Get('health/simple')
  async simpleHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'chat-api',
      version: '1.0.0'
    };
  }
}