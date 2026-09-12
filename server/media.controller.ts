import { Body, Controller, Get, Patch, Post, Param, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import { Database } from './database.js';
import { RequirePermission, SessionGuard, type AuthRequest } from './security.js';
import { parse } from './validation.js';
import { maxAudioBytes, mediaMetadata, wavDuration } from './media.schema.js';
const metadataFields = { id: true, name: true, author: true, license: true, sourceUrl: true, licenseUrl: true, size: true, duration: true, archived: true, version: true, createdAt: true, uploaderId: true } as const;
const withUrl = <T extends { id: string }>(asset: T) => ({ ...asset, audioUrl: `/api/media/${asset.id}/file` });
@Controller('media')
@UseGuards(SessionGuard)
export class MediaController {
  constructor(private db: Database) {}
  @Get() @RequirePermission('content:edit')
  async list(@Query() query: unknown) {
    const input = parse(z.object({ search: z.string().trim().max(100).default(''), archived: z.enum(['true', 'false']).default('false'), page: z.coerce.number().int().min(0).max(10000).default(0) }).strict(), query, 'Проверьте параметры поиска.');
    const assets = await this.db.mediaAsset.findMany({ where: { archived: input.archived === 'true', name: { contains: input.search, mode: 'insensitive' } }, select: metadataFields, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 50, skip: input.page * 50 });
    return assets.map(withUrl);
  }
  @Post() @RequirePermission('content:edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxAudioBytes, files: 1, fields: 5, fieldSize: 2000, parts: 7 } }))
  async upload(@Body() body: unknown, @UploadedFile() file: { buffer: Buffer } | undefined, @Req() req: AuthRequest) {
    const metadata = parse(mediaMetadata, body, 'Укажите название, автора, лицензию и HTTPS-источник.');
    if (!file) throw new BadRequestException('Выберите WAV-файл.');
    const duration = wavDuration(file.buffer);
    const asset = await this.db.mediaAsset.create({ data: { ...metadata, duration, size: file.buffer.length, data: new Uint8Array(file.buffer), uploaderId: req.session!.user.id, changes: { create: { actorId: req.session!.user.id, action: 'UPLOAD' } } }, select: metadataFields });
    return withUrl(asset);
  }
  @Get(':id/history') @RequirePermission('content:edit')
  async history(@Param('id') id: string) {
    if (!await this.db.mediaAsset.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundException('Файл недоступен.');
    return this.db.mediaChange.findMany({ where: { mediaId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30 });
  }
  @Patch(':id') @RequirePermission('content:publish')
  async archive(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(z.object({ version: z.number().int().nonnegative(), archived: z.boolean() }).strict(), body, 'Обновите медиатеку и повторите.');
    try {
      return await this.db.$transaction(async db => {
        const asset = await db.mediaAsset.findUnique({ where: { id }, select: metadataFields });
        if (!asset) throw new NotFoundException('Файл недоступен.');
        if (asset.version !== input.version) throw new ConflictException('Файл уже изменён. Обновите медиатеку.');
        if (asset.archived === input.archived) return withUrl(asset);
        const updated = await db.mediaAsset.update({ where: { id }, data: { archived: input.archived, version: { increment: 1 } }, select: metadataFields });
        await db.mediaChange.create({ data: { mediaId: id, actorId: req.session!.user.id, action: input.archived ? 'ARCHIVE' : 'RESTORE' } });
        return withUrl(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ConflictException('Файл уже изменён. Обновите медиатеку.'); throw error; }
  }
  @Get(':id/file')
  async file(@Param('id') id: string, @Req() req: AuthRequest, @Res() res: Response) {
    const audioUrl = `/api/media/${id}/file`;
    if (req.session!.user.role === 'STUDENT') {
      const published = await this.db.lesson.findFirst({ where: { published: true, OR: [{ blocks: { some: { kind: 'audio', content: { path: ['audioUrl'], equals: audioUrl } } } }, { quiz: { questions: { array_contains: [{ kind: 'dictation', audioUrl }] } } }] }, select: { id: true } });
      if (!published) throw new NotFoundException('Файл недоступен.');
    }
    const asset = await this.db.mediaAsset.findUnique({ where: { id }, select: { data: true, size: true } });
    if (!asset) throw new NotFoundException('Файл недоступен.');
    const data = Buffer.from(asset.data);
    res.set({ 'Content-Type': 'audio/wav', 'Content-Disposition': 'inline; filename="audio.wav"', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' });
    const range = req.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return res.status(416).set('Content-Range', `bytes */${asset.size}`).end();
      const start = match[1] ? Number(match[1]) : Math.max(0, asset.size - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), asset.size - 1) : asset.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= asset.size) return res.status(416).set('Content-Range', `bytes */${asset.size}`).end();
      return res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${asset.size}`, 'Content-Length': String(end - start + 1) }).send(data.subarray(start, end + 1));
    }
    return res.set('Content-Length', String(asset.size)).send(data);
  }
}
