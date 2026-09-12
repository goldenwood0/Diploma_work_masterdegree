import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export const localAudio = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/file$/;
export const audioUrlSchema = z.union([z.string().regex(localAudio), z.url().max(2000).refine(value => new URL(value).protocol === 'https:' && !new URL(value).username && !new URL(value).password)]);
export const mediaMetadata = z.object({ name: z.string().trim().min(1).max(200), author: z.string().trim().min(1).max(200), license: z.string().trim().min(1).max(200), sourceUrl: z.url().max(2000).startsWith('https://'), licenseUrl: z.url().max(2000).startsWith('https://') }).strict();
export const maxAudioBytes = 5 * 1024 * 1024;

// Accept uncompressed PCM WAV only. Walk chunks rather than trusting a filename or MIME header.
export function wavDuration(data: Buffer) {
  const invalid = () => { throw new BadRequestException('Нужен корректный PCM WAV до 5 МБ и 5 минут.'); };
  if (data.length < 44 || data.length > maxAudioBytes || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE' || data.readUInt32LE(4) + 8 !== data.length) return invalid();
  let offset = 12, rate = 0, align = 0, samples = 0, formatSeen = false, dataSeen = false;
  while (offset < data.length) {
    if (offset + 8 > data.length) return invalid();
    const kind = data.toString('ascii', offset, offset + 4), size = data.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > data.length) return invalid();
    if (kind === 'fmt ') {
      if (formatSeen || size < 16) return invalid();
      formatSeen = true;
      const channels = data.readUInt16LE(start + 2), sampleRate = data.readUInt32LE(start + 4), bits = data.readUInt16LE(start + 14);
      rate = data.readUInt32LE(start + 8); align = data.readUInt16LE(start + 12);
      if (data.readUInt16LE(start) !== 1 || ![1, 2].includes(channels) || ![8, 16, 24, 32].includes(bits) || sampleRate < 8000 || sampleRate > 96000 || align !== channels * bits / 8 || rate !== sampleRate * align) return invalid();
    } else if (kind === 'data') { if (dataSeen) return invalid(); dataSeen = true; samples = size; }
    offset = start + size + (size % 2);
  }
  if (offset !== data.length || !formatSeen || !dataSeen || !samples || samples % align || samples / rate > 300) return invalid();
  return samples / rate;
}
