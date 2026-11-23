// Explicitly run only for isolated UI checks. Never imported by the production app.
import 'reflect-metadata';
import { Module, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Database } from '../dist-server/database.js';
import { AuthService } from '../dist-server/auth.service.js';
import { OriginGuard, SessionGuard } from '../dist-server/security.js';
import { TutorService } from '../dist-server/tutor.service.js';
import { TutorController } from '../dist-server/tutor.controller.js';
import { TUTOR_PROVIDER } from '../dist-server/tutor-provider.js';
if (process.env.NODE_ENV === 'production') throw new Error('Test harness only');
process.env.NODE_ENV = 'test'; process.env.REMINDERS_ENABLED = 'false';
process.env.DATABASE_URL = 'postgresql://unused'; process.env.SMTP_HOST = 'unused'; process.env.APP_ORIGIN = 'http://127.0.0.1:8443';
const sessions = new Map(); let language = 'ru'; let failed = false;
const adapter = { kind: 'test', async generate(input, signal) {
  if (input.data.text === 'FAIL_ONCE' && !failed) { failed = true; throw new Error('SIMULATED'); }
  if (['SLOW', 'TIMEOUT'].includes(input.data.text)) await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, input.data.text === 'SLOW' ? 10000 : 30000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
  });
  const labels = { ru: 'ТЕСТОВЫЙ ОТВЕТ', kk: 'ТЕСТІЛІК ЖАУАП', en: 'TEST RESPONSE' };
  return { text: `${labels[input.data.language]} — ${input.data.mode}\n你好 · nǐ hǎo\n${input.data.material.slice(0, 100)}\nNo real AI / no methodological assessment.` };
} };
const db = {
  lesson: { findFirst: async q => q.where.slug === 'draft' ? null : ({ id: 'fixture', revision: 1, prerequisiteId: q.where.slug === 'locked' ? 'prior' : null, prerequisite: { revision: 1 }, quiz: null,
    blocks: [{ kind: 'reading', content: { hanzi: '你好', pinyin: 'nǐ hǎo', translation: { ru: 'Здравствуйте', kk: 'Сәлеметсіз бе', en: 'Hello' } } }] }) },
  lessonProgress: { findUnique: async () => null }, userSettings: { findUnique: async () => ({ startLevel: 1, explanationLanguage: language }) },
};
class HarnessModule {}
Module({ controllers: [TutorController], providers: [TutorService, SessionGuard,
  { provide: Database, useValue: db }, { provide: TUTOR_PROVIDER, useValue: adapter },
  { provide: AuthService, useValue: { session: async cookie => { if (!sessions.has(cookie)) throw new UnauthorizedException(); return { user: { id: sessions.get(cookie) } }; } } },
  { provide: APP_GUARD, useClass: OriginGuard }] })(HarnessModule);
const app = await NestFactory.create(HarnessModule, { logger: false });
app.use(cookieParser());
app.use('/api/tutor-fixture', (req, res) => {
  if (req.get('x-zhpath-request') !== '1' || !['ru', 'kk', 'en'].includes(req.query.language)) return res.sendStatus(400);
  language = req.query.language; adapter.kind = req.query.state === 'unconfigured' ? 'unconfigured' : 'test'; failed = false;
  const id = `fixture-${crypto.randomUUID()}`; sessions.clear(); sessions.set(id, id);
  res.cookie('zhpath_session', id, { httpOnly: true, sameSite: 'strict' }).json({ testOnly: true });
});
app.setGlobalPrefix('api'); await app.listen(3001, '127.0.0.1');
console.log('TEST ONLY tutor harness on 127.0.0.1:3001; no DB, mail, real AI');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
