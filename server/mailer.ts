import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { getConfig } from './config.js';

@Injectable()
export class Mailer {
  private config = getConfig();
  private transport = nodemailer.createTransport({
    host: this.config.SMTP_HOST, port: this.config.SMTP_PORT,
    secure: this.config.SMTP_SECURE === 'true',
    requireTLS: this.config.NODE_ENV === 'production',
    auth: this.config.SMTP_USER ? { user: this.config.SMTP_USER, pass: this.config.SMTP_PASSWORD } : undefined,
    connectionTimeout: 5000, socketTimeout: 10000,
  });

  async send(email: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD', token: string) {
    const page = purpose === 'VERIFY_EMAIL' ? 'verify-email' : 'reset-password';
    const action = purpose === 'VERIFY_EMAIL' ? 'Подтвердить email' : 'Изменить пароль';
    const link = `${this.config.APP_ORIGIN}/#/${page}?token=${token}`;
    await this.transport.sendMail({ from: this.config.MAIL_FROM, to: email,
      subject: `${action} — ZhPath`,
      text: `${action}: ${link}\n\nСсылка одноразовая. Если вы не запрашивали это действие, проигнорируйте письмо.`,
    });
  }
}
