import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Get('check')
  @UseGuards(JwtAuthGuard)
  async check(@Req() req: any, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const message = { message: "Welcome to the protected route!" };
    const user = { user: req.user };
    
    res.write(`data: ${JSON.stringify(message)}\n\n`);
    
    setTimeout(() => {
      res.write(`data: ${JSON.stringify(user)}\n\n`);
      res.end();
    }, 2000);

    req.on('close', () => {
      res.end();
    });
  }
}