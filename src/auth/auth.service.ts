import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as fs from 'fs';
import Redis from 'ioredis';

@Injectable()
export class AuthService implements OnModuleInit {
  private publicKey: crypto.KeyObject;
  private publicKeyFile: string;
  private redisClient: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.initializeKeys();
    this.initializeRedis();
    await this.cachePublicKey();
  }

  private initializeRedis() {
    const redisConfig: any = { db: 0 };

    if (this.configService.get('NODE_ENV') === 'production') {
      redisConfig.url = this.configService.get('REDIS_URL_CHAT');
    } else {
      redisConfig.host = this.configService.get('REDIS_HOST_CHAT') || '161.97.122.119';
      redisConfig.port = this.configService.get('REDIS_PORT_CHAT') || 30769;
      redisConfig.username = this.configService.get('REDIS_USER_CHAT') || 'default';
      redisConfig.password = this.configService.get('REDIS_PASSWORD_CHAT') || 'admin';
    }

    this.redisClient = new Redis(redisConfig);
  }

  private initializeKeys() {
    try {
      const publicKeyPath = this.configService.get('PATH_PUBLIC') || './auth/public.pem';

      const filePublicKey = fs.readFileSync(publicKeyPath, 'utf8');
      this.publicKey = crypto.createPublicKey({
        key: filePublicKey,
        format: 'pem',
      });

      this.publicKeyFile = this.publicKey.export({ format: 'pem', type: 'spki' }) as string;
    } catch (error) {
      console.error('Error initializing keys:', error);
    }
  }

  private async cachePublicKey() {
    try {
      const file = Buffer.from(this.publicKeyFile, 'utf8').toString('base64');
      await this.redisClient.set('key_public', file, 'EX', 3600); // 1 hour expiry
    } catch (error) {
      console.error('Error caching public key:', error);
    }
  }


  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.publicKey, { algorithms: ['RS256'] });
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}