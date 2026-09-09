import { randomBytes, scrypt, createHash, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, 'hex'));
}
export const newToken = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
