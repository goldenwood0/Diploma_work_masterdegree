import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { AuthRateGuard, cookieName, SessionGuard, type AuthRequest } from './security.js';
import { credentialsSchema, emailSchema, parse, passwordSchema, registerSchema, tokenSchema } from './validation.js';
import { getConfig } from './config.js';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register') @UseGuards(AuthRateGuard)
  register(@Body() body: unknown) { return this.auth.register(parse(registerSchema, body)); }

  @Post('login') @HttpCode(200) @UseGuards(AuthRateGuard)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { email, password } = parse(credentialsSchema, body);
    const session = await this.auth.login(email, password);
    res.cookie(cookieName(), session.token, { httpOnly: true, secure: getConfig().NODE_ENV === 'production', sameSite: 'strict', path: '/', expires: session.expiresAt });
    return { user: (await this.auth.session(session.token)).user };
  }

  @Get('me') @UseGuards(SessionGuard)
  me(@Req() req: AuthRequest) { return { user: req.session!.user }; }

  @Post('logout') @HttpCode(200)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[cookieName()];
    if (typeof raw === 'string') await this.auth.logout(raw);
    res.clearCookie(cookieName(), { path: '/', httpOnly: true, secure: getConfig().NODE_ENV === 'production', sameSite: 'strict' });
    return { message: 'Вы вышли из аккаунта.' };
  }

  @Post('logout-all') @HttpCode(200) @UseGuards(SessionGuard)
  async logoutAll(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(req.session!.userId);
    res.clearCookie(cookieName(), { path: '/', httpOnly: true, secure: getConfig().NODE_ENV === 'production', sameSite: 'strict' });
    return { message: 'Все сессии завершены.' };
  }

  @Post('resend-verification') @HttpCode(200) @UseGuards(AuthRateGuard)
  resend(@Body() body: unknown) { return this.auth.requestToken(parse(z.object({ email: emailSchema }).strict(), body).email, 'VERIFY_EMAIL'); }

  @Post('forgot-password') @HttpCode(200) @UseGuards(AuthRateGuard)
  forgot(@Body() body: unknown) { return this.auth.requestToken(parse(z.object({ email: emailSchema }).strict(), body).email, 'RESET_PASSWORD'); }

  @Post('verify-email') @HttpCode(200) @UseGuards(AuthRateGuard)
  verify(@Body() body: unknown) { return this.auth.consumeToken(parse(z.object({ token: tokenSchema }).strict(), body).token, 'VERIFY_EMAIL'); }

  @Post('reset-password') @HttpCode(200) @UseGuards(AuthRateGuard)
  reset(@Body() body: unknown) {
    const { token, password } = parse(z.object({ token: tokenSchema, password: passwordSchema }).strict(), body);
    return this.auth.consumeToken(token, 'RESET_PASSWORD', password);
  }
}
