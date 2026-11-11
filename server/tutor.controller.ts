import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';
import { tutorInput } from './tutor-provider.js';
import { TutorService } from './tutor.service.js';

@Controller('tutor')
@UseGuards(SessionGuard)
export class TutorController {
  constructor(private tutor: TutorService) {}
  @Get('status') status() { return this.tutor.status(); }
  @Post('ask') async ask(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const input = parse(tutorInput, body, 'TUTOR_INVALID_INPUT');
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    req.once('aborted', abort); res.once('close', abort);
    try { return await this.tutor.ask(req.session!.user.id, input, controller.signal); }
    finally { req.off('aborted', abort); res.off('close', abort); }
  }
}
