import { MediaController } from './media.controller.js';
import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Database } from './database.js';
import { AuthService } from './auth.service.js';
import { Mailer } from './mailer.js';
import { AuthController } from './auth.controller.js';
import { AdminController } from './admin.controller.js';
import { AuthRateGuard, OriginGuard, SessionGuard } from './security.js';
import { getConfig } from './config.js';
import { ProfileController } from './profile.controller.js';
import { LearningController } from './learning.controller.js';
import { ReviewController } from './review.controller.js';
import { ContentController } from './content.controller.js';
import { AnalyticsController } from './analytics.controller.js';
import { StudyTimeController } from './study-time.controller.js';
import { ReminderService } from './reminder.service.js';

@Controller('health')
class HealthController {
  @Get() health() { return { status: 'ok' }; }
}

@Module({
  controllers: [StudyTimeController, AnalyticsController, MediaController, AuthController, AdminController, HealthController, ProfileController, LearningController, ReviewController, ContentController],
  providers: [Database, AuthService, Mailer, ReminderService, SessionGuard, AuthRateGuard, { provide: APP_GUARD, useClass: OriginGuard }],
})
class AppModule {}

export async function createApp() {
  getConfig();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], rawBody: false });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  app.enableShutdownHooks();
  await app.init();
  return app;
}
