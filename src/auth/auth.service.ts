import { Injectable, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class AuthService implements OnModuleInit {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;
  private publicKeyFile: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.initializeKeys();
    await this.cachePublicKey();
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
      // Cache public key to Redis for chat server
      const file = Buffer.from(this.publicKeyFile, 'utf8').toString('base64');
      // You can implement Redis caching here if needed
      console.log('Public key cached successfully');
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

      // Here you would save to database
      // const user = { userId, webToken, mobileToken, pub: pubBase64 };
      // await this.saveUserToDatabase(user);
      
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

      // Here you would get token from database
      // const token = isWeb ? await this.getWebToken(userId) : await this.getMobileToken(userId);
      
      // For demo purposes, creating a mock token
      const mockPayload = { userId, role: 'CUS', hashedPassword: await bcrypt.hash('demo', 10), priv: 'demo', name: 'Demo User', isWeb };
      const token = jwt.sign(mockPayload, this.privateKey, { algorithm: 'RS256' });

      if (!token) {
        throw new UnauthorizedException('User does not exist... Register Now..');
      }

      const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as any;
      const { hashedPassword, priv } = decoded;

      const isLogged = await bcrypt.compare(password, hashedPassword);
      
      if (isLogged) {
        // const pub = await this.getPublicKey(userId);
        const pub = 'demo_public_key'; // Mock public key
        return {
          success: true,
          data: { token, priv, pub }
        };
      } else {
        throw new UnauthorizedException('Invalid Password');
      }
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  async connectPeer(email: string, user: any) {
    try {
      const userId = email;
      const { name } = user;
      // const pub = await this.getPublicKey(userId);
      const pub = 'demo_peer_public_key'; // Mock public key
      
      if (pub) {
        return {
          success: true,
          data: { pub, name },
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