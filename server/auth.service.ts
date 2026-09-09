import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Prisma, TokenPurpose } from '@prisma/client';
import { Database } from './database.js';
import { Mailer } from './mailer.js';
import { digest, hashPassword, newToken, verifyPassword } from './passwords.js';

export const publicUser = { id: true, email: true, name: true, role: true, emailVerifiedAt: true, settings: true } as const;
const genericMessage = { message: 'Если адрес подходит для этого действия, письмо отправлено. Проверьте почту.' };

@Injectable()
export class AuthService {
  constructor(private db: Database, private mail: Mailer) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.db.$transaction(work, { isolationLevel: 'Serializable' }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new BadRequestException('Состояние аккаунта изменилось. Повторите действие.');
      }
      throw error;
    }
  }

  async register(input: { email: string; password: string; name: string; uiLanguage?: string }) {
    const passwordHash = await hashPassword(input.password);
    let user;
    try {
      user = await this.db.user.create({ data: { email: input.email, name: input.name, passwordHash, settings: { create: { uiLanguage: input.uiLanguage ?? 'ru', explanationLanguage: input.uiLanguage ?? 'ru' } } } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return genericMessage;
      throw error;
    }
    await this.issueToken(user.id, user.email, 'VERIFY_EMAIL');
    return genericMessage;
  }

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    // Use the same expensive derivation for unknown addresses to reduce timing differences.
    const fallback = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    if (!await verifyPassword(password, user?.passwordHash ?? fallback) || !user) throw new UnauthorizedException('Неверный email или пароль.');
    if (!user.emailVerifiedAt) throw new UnauthorizedException('Сначала подтвердите email. Можно запросить письмо повторно.');
    const token = newToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (current?.passwordHash !== user.passwordHash) throw new UnauthorizedException('Пароль изменён. Войдите ещё раз.');
      await tx.session.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt } });
    });
    return { token, expiresAt };
  }

  async session(raw: unknown) {
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw new UnauthorizedException('Необходимо войти в аккаунт.');
    const session = await this.db.session.findUnique({ where: { tokenHash: digest(raw) }, include: { user: { select: publicUser } } });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException('Сессия завершена. Войдите ещё раз.');
    return session;
  }

  async logout(raw: string) { await this.db.session.deleteMany({ where: { tokenHash: digest(raw) } }); }
  async logoutAll(userId: string) { await this.db.session.deleteMany({ where: { userId } }); }

  async requestToken(email: string, purpose: TokenPurpose) {
    const user = await this.db.user.findUnique({ where: { email } });
    if (user && (purpose !== 'VERIFY_EMAIL' || !user.emailVerifiedAt)) await this.issueToken(user.id, email, purpose);
    return genericMessage;
  }

  private async issueToken(userId: string, email: string, purpose: TokenPurpose) {
    const raw = newToken();
    const record = await this.db.accountToken.create({ data: {
      userId, purpose, tokenHash: digest(raw),
      expiresAt: new Date(Date.now() + (purpose === 'RESET_PASSWORD' ? 30 : 24 * 60) * 60 * 1000),
    } });
    try { await this.mail.send(email, purpose, raw); }
    catch {
      await this.db.accountToken.delete({ where: { id: record.id } });
      throw new ServiceUnavailableException('Почта временно недоступна. Запросите письмо повторно позже.');
    }
  }

  async consumeToken(raw: string, purpose: TokenPurpose, password?: string) {
    const passwordHash = password ? await hashPassword(password) : undefined;
    await this.transaction(async tx => {
      const token = await tx.accountToken.findUnique({ where: { tokenHash: digest(raw) } });
      if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= new Date()) throw new BadRequestException('Ссылка недействительна или истекла. Запросите новую.');
      const claimed = await tx.accountToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException('Ссылка уже использована.');
      await tx.user.update({ where: { id: token.userId }, data: purpose === 'VERIFY_EMAIL' ? { emailVerifiedAt: new Date() } : { passwordHash } });
      // Invalidate all outstanding links of the same purpose; reset also revokes every session.
      await tx.accountToken.updateMany({ where: { userId: token.userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
      if (purpose === 'RESET_PASSWORD') await tx.session.deleteMany({ where: { userId: token.userId } });
    });
    return { message: purpose === 'VERIFY_EMAIL' ? 'Email подтверждён. Теперь можно войти.' : 'Пароль изменён. Войдите с новым паролем.' };
  }
}
