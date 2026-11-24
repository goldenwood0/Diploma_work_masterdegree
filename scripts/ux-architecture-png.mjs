// Renders docs/ux-architecture/svg/*.svg to PNG with headless Microsoft Edge (Windows).
// Uses Inter from .homework_qa when present; otherwise the system sans-serif.
// Usage: node scripts/ux-architecture-png.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!edge) throw new Error('Microsoft Edge not found');
const svgDir = resolve('docs/ux-architecture/svg'), pngDir = resolve('docs/ux-architecture/png');
const fontDir = resolve('.homework_qa');
const fontCss = existsSync(join(fontDir, 'Inter-Regular.ttf'))
  ? `@font-face{font-family:Inter;src:url(${pathToFileURL(join(fontDir, 'Inter-Regular.ttf'))});font-weight:400}@font-face{font-family:Inter;src:url(${pathToFileURL(join(fontDir, 'Inter-Bold.ttf'))});font-weight:700}` : '';
await mkdir(pngDir, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'zhpath-ux-'));
try {
  for (const file of (await readdir(svgDir)).filter(f => f.endsWith('.svg'))) {
    const svg = await readFile(join(svgDir, file), 'utf8');
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
    const page = join(temp, file.replace(/\.svg$/, '.html'));
    await writeFile(page, `<!doctype html><meta charset="utf-8"><style>${fontCss}html,body{margin:0}</style>${svg}`);
    const out = join(pngDir, file.replace(/\.svg$/, '.png'));
    execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${out}`, pathToFileURL(page).href], { stdio: 'ignore' });
    console.log(out);
  }
} finally { await rm(temp, { recursive: true, force: true }); }
