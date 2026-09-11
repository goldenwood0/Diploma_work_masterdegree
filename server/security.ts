import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { getConfig } from './config.js';
import { digest } from './passwords.js';

export const cookieName = () => getConfig().NODE_ENV === 'production' ? '__Host-zhpath' : 'zhpath_session';
export type AuthRequest = Request & { session?: Awaited<ReturnType<AuthService['session']>> };
export type Permission = 'users:read' | 'users:manage' | 'content:edit' | 'content:publish';
export const permissions = { STUDENT: [], EDITOR: ['content:edit'], ADMIN: ['users:read', 'users:manage', 'content:edit', 'content:publish'] } satisfies Record<string, Permission[]>;
export const RequirePermission = (permission: Permission) => SetMetadata('permission', permission);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AuthService, private reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.session = await this.auth.session(req.cookies?.[cookieName()]);
    const permission = this.reflector.get<Permission>('permission', context.getHandler());
    if (permission && !(permissions[req.session.user.role] as Permission[]).includes(permission)) throw new ForbiddenException('Недостаточно прав.');
    return true;
  }
}

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.get('origin') !== getConfig().APP_ORIGIN || req.get('x-zhpath-request') !== '1') throw new ForbiddenException('Недопустимый источник запроса.');
    return true;
  }
}

// Single-instance MVP limiter. Move to a shared store before adding API replicas.
@Injectable()
export class AuthRateGuard implements CanActivate {
  private buckets = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    for (const [key, value] of this.buckets) if (value.until <= now) this.buckets.delete(key);
    const keys: Array<[string, number]> = [[`ip:${req.ip}`, 60]];
    if (typeof req.body?.email === 'string') keys.push([`email:${digest(req.body.email.trim().toLowerCase())}`, 10]);
    if (this.buckets.size > 10000) throw new HttpException('Слишком много запросов. Попробуйте позже.', 429);
    for (const [key, limit] of keys) {
      const bucket = this.buckets.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
      bucket.count++;
      this.buckets.set(key, bucket);
      if (bucket.count > limit) throw new HttpException('Слишком много попыток. Попробуйте через 15 минут.', 429);
    }
    return true;
  }
}
