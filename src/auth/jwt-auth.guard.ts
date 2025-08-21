import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['authorization']?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Token required');
    }

    try {
      const decoded = this.authService.verifyToken(token);
      const { userId, role, name, isWeb } = decoded;
      request.user = { userId, role, isWeb, name };
      return true;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}