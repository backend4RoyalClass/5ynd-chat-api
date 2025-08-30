import { Injectable, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import Redis from 'ioredis';

// Add User Schema for storing tokens
interface User {
  userId: string;
  webToken: string;
  mobileToken: string;
  publicKey: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;
  private publicKeyFile: string;
  private users: Map<string, User> = new Map(); // Temporary storage - replace with DB
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
      const privateKeyPath = this.configService.get('PATH_PRIVATE') || './auth/private.pem';
      const publicKeyPath = this.configService.get('PATH_PUBLIC') || './auth/public.pem';
      const passphrase = this.configService.get('PRIVATE_KEY_PASS_PHRASE');

      const encryptedPrivateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.privateKey = crypto.createPrivateKey({
        key: encryptedPrivateKey,
        format: 'pem',
        passphrase: passphrase,
      });

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

  async registerUser(body: any) {
    try {
      const { userId, password, name, role = 'CUS' } = body;
      
      if (!userId || !password || !name) {
        throw new BadRequestException('Invalid body');
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      });

      const pubBase64 = Buffer.from(pub, 'utf8').toString('base64');
      const privBase64 = Buffer.from(priv, 'utf8').toString('base64');

      const validRole = ['BIS', 'CUS', 'ADM'].includes(role) ? role : 'CUS';

      const payloadWeb = { userId, role: validRole, hashedPassword, priv: privBase64, name, isWeb: true };
      const payloadMobile = { userId, role: validRole, hashedPassword, priv: privBase64, name, isWeb: false };

      const webToken = jwt.sign(payloadWeb, this.privateKey, { algorithm: 'RS256' });
      const mobileToken = jwt.sign(payloadMobile, this.privateKey, { algorithm: 'RS256' });

      // Store user tokens (replace with actual DB storage)
      const user: User = { userId, webToken, mobileToken, publicKey: pubBase64 };
      this.users.set(userId, user);
      
      return {
        success: true,
        data: { webToken, mobileToken, priv: privBase64, pub: pubBase64 }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async loginUser(body: any) {
    try {
      const { userId, password, isWeb } = body;
      
      if (!userId || !password || typeof isWeb !== 'boolean') {
        throw new BadRequestException('Invalid body');
      }

      // Get stored user (replace with DB query)
      const user = this.users.get(userId);
      if (!user) {
        throw new UnauthorizedException('User does not exist... Register Now..');
      }

      const token = isWeb ? user.webToken : user.mobileToken;

      const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as any;
      const { hashedPassword, priv } = decoded;

      const isLogged = await bcrypt.compare(password, hashedPassword);
      
      if (isLogged) {
        return {
          success: true,
          data: { token, priv, pub: user.publicKey }
        };
      } else {
        throw new UnauthorizedException('Invalid Password');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(error.message);
    }
  }

  async connectPeer(email: string, user: any) {
    try {
      const userId = email;
      const { name } = user;
      
      // Get peer's public key (replace with DB query)
      const peer = this.users.get(userId);
      
      if (peer) {
        return {
          success: true,
          data: { pub: peer.publicKey, name },
          message: 'Peer Connected....'
        };
      } else {
        throw new BadRequestException('Peer does not exist..');
      }
    } catch (error) {
      throw new BadRequestException(error.message);
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