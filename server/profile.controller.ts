import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Database } from './database.js';
import { publicUser } from './auth.service.js';
import { SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';

const language = z.enum(['ru', 'kk', 'en']);
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  uiLanguage: language, explanationLanguage: language,
  timezone: z.string().min(1).max(80).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }),
  dailyGoalMinutes: z.number().int().min(5).max(60).multipleOf(5),
  experience: z.enum(['beginner', 'some', 'experienced']),
  goal: z.enum(['communication', 'study', 'work', 'exam']),
  startLevel: z.number().int().min(1).max(6),
  remindersEnabled: z.boolean(),
  completeOnboarding: z.boolean().optional(),
}).strict();

@Controller('profile') @UseGuards(SessionGuard)
export class ProfileController {
  constructor(private db: Database) {}
  @Patch()
  async update(@Req() req: AuthRequest, @Body() body: unknown) {
    const { name, completeOnboarding, ...settings } = parse(schema, body, 'Проверьте настройки профиля.');
    const onboardingCompletedAt = completeOnboarding ? req.session!.user.settings?.onboardingCompletedAt ?? new Date() : undefined;
    const user = await this.db.user.update({
      where: { id: req.session!.userId },
      data: { name, settings: { upsert: {
        create: { ...settings, onboardingCompletedAt },
        update: { ...settings, onboardingCompletedAt },
      } } }, select: publicUser,
    });
    return { user };
  }
}
