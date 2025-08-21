import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @Inject('CHAT_CLIENT') private readonly redisChat: Redis,
    @Inject('CHAT_PUBLISHER') private readonly redisPublisher: Redis,
  ) {}

  async getData(topic: string, id: string): Promise<any> {
    try {
      const dataString = await this.redisChat.get(`${topic}_${id}`);
      return dataString ? JSON.parse(dataString) : null;
    } catch (error) {
      console.error(`Error fetching data for key: ${topic}_${id}`, error);
      throw error;
    }
  }

  async setData(topic: string, id: string, value: any, expiryFrequency: number, inHours: boolean = true): Promise<void> {
    let expiry: number;
    const HOUR = 60 * 60;
    
    try {
      if (inHours) expiry = expiryFrequency * HOUR;
      else expiry = expiryFrequency;
      
      await this.redisChat.set(`${topic}_${id}`, JSON.stringify(value), 'EX', expiry);
    } catch (error) {
      console.error(`Error setting data for key: ${topic}_${id}`, error);
      throw error;
    }
  }

  async deleteData(topic: string, id: string): Promise<void> {
    try {
      await this.redisChat.del(`${topic}_${id}`);
    } catch (error) {
      console.error(`Error deleting data for key: ${topic}_${id}`, error);
    }
  }

  // Add the missing methods
  getPublisher(): Redis {
    return this.redisPublisher;
  }

  getClient(): Redis {
    return this.redisChat;
  }

  // Direct publish method for convenience
  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.redisPublisher.publish(channel, message);
    } catch (error) {
      console.error(`Error publishing to channel ${channel}:`, error);
      throw error;
    }
  }
}