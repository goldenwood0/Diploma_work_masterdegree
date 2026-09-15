import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().startsWith('postgresql://'),
  APP_ORIGIN: z.string().url().default('http://127.0.0.1:8443'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('ZhPath <noreply@zhpath.local>'),
  REMINDERS_ENABLED: z.enum(['true', 'false']).default('false'),
});

export function getConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid server environment: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const config = result.data;
  if (new URL(config.APP_ORIGIN).origin !== config.APP_ORIGIN) throw new Error('APP_ORIGIN must be an origin without path');
  if (config.NODE_ENV === 'production' && !config.APP_ORIGIN.startsWith('https://')) throw new Error('Production requires HTTPS');
  return config;
}
