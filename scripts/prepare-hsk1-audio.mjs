// Download explicitly selected freely licensed audio into offline review artifacts.
// Never imports, publishes or edits learner data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { wavDuration, mediaMetadata } from '../dist-server/media.schema.js';
import { draftSchema } from '../dist-server/content.schema.js';
const root = 'docs/hsk1-audit/audio';
const discovery = JSON.parse(await readFile(`${root}/commons-discovery.json`, 'utf8'));
const snapshot = JSON.parse(await readFile('docs/hsk1-audit/content-snapshot.json', 'utf8'));
const contentPack = JSON.parse(await readFile('docs/hsk1-audit/proposed-content.json', 'utf8'));
const words = [...new Map(snapshot.lessons.flatMap(l => l.blocks.filter(b => b.kind === 'vocabulary').flatMap(b => b.content.words)).map(w => [w.hanzi,w])).values()];
const titles = ['File:Zh-nǐ.ogg','File:Zh-hǎo.ogg','File:Zh nǐ hǎo.ogg','File:Zh-wǒ.ogg','File:Zh-jiào.ogg','File:Zh-míngzi.ogg','File:Zh-shénme.ogg','File:Zh-xièxie.ogg','File:LL-Q9192 (cmn)-CanonNi-不客气.wav','File:Zh-zàijiàn.ogg'];
const all = [...discovery.pages, ...discovery.searches.flatMap(s => s.pages)];
const python = spawnSync('python', ['-c', "import sys; sys.path.insert(0,'outputs/hsk1-audio-tools'); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: 'utf8' });
if (python.status !== 0) throw new Error('Install imageio-ffmpeg in outputs/hsk1-audio-tools first');
const ffmpeg = python.stdout.trim();
await mkdir(`${root}/original`, { recursive: true });
await mkdir(`${root}/wav`, { recursive: true });
const assets = [];
for (const [i, word] of words.entries()) {
  const page = all.find(p => p.title === titles[i]);
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Missing reviewed source for ${word.hanzi}`);
  const m = info.extmetadata;
  if (!['CC BY 2.0 fr','CC BY-SA 3.0','CC0'].includes(m.LicenseShortName?.value)) throw new Error(`Unreviewed license: ${page.title}`);
  if (!page.title.includes(word.hanzi) && !m.ImageDescription.value.includes(word.hanzi)) throw new Error('Transcript metadata mismatch');
  const key = [...word.hanzi].map(c => c.codePointAt(0).toString(16)).join('-');
  const extension = page.title.endsWith('.wav') ? 'wav' : 'ogg';
  const originalPath = `original/${key}.${extension}`;
  const wavPath = `wav/${key}.wav`;
  const url = new URL(info.url); url.search = '';
  if (url.hostname !== 'upload.wikimedia.org' || url.protocol !== 'https:') throw new Error('Unexpected media origin');
  let original;
  try { original = await readFile(`${root}/${originalPath}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!original && !process.argv.includes('--cached-only')) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, attempt ? 15000 : 1500));
      const response = await fetch(url, { headers: { 'User-Agent': 'ZhPathPilotAudioAudit/1.0' }, signal: AbortSignal.timeout(30000) });
      if (response.status === 429 && attempt < 3) {
        const retry = Number(response.headers.get('retry-after'));
        if (Number.isFinite(retry) && retry > 60) throw new Error(`Source requests a longer pause (${retry}s); rerun later`);
        if (retry > 15) await new Promise(resolve => setTimeout(resolve, (retry - 15) * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`Audio HTTP ${response.status}: ${word.hanzi}`);
      original = Buffer.from(await response.arrayBuffer());
      break;
    }
  }
  let wav = null;
  let duration = info.duration;
  if (original) {
  if (original.length !== info.size || createHash('sha1').update(original).digest('hex') !== info.sha1) throw new Error(`Source changed: ${word.hanzi}`);
  await writeFile(`${root}/${originalPath}`, original);
  // Only container/codec conversion. No trimming, speed, pitch or volume filters.
  const converted = spawnSync(ffmpeg, ['-nostdin','-v','error','-y','-i',resolve(root, originalPath),'-map_metadata','-1','-c:a','pcm_s16le',resolve(root, wavPath)], { encoding: 'utf8' });
  if (converted.status !== 0) throw new Error(converted.stderr);
  wav = await readFile(`${root}/${wavPath}`);
  duration = wavDuration(wav);
  }
  const licenseUrl = m.LicenseUrl.value.replace(/^http:/, 'https:');
  const author = word.hanzi === '不客气' ? 'CanonNi (speaker and recorder)' : m.Artist.value;
  const metadata = mediaMetadata.parse({ name: `HSK 1 · ${word.hanzi} · ${word.pinyin}`, author, license: m.LicenseShortName.value, sourceUrl: info.descriptionurl, licenseUrl });
  assets.push({ key, ...word, metadata, sourceFile: page.title, sourceRevision: page.revisions[0].revid,
    sourceRevisionUrl: `https://commons.wikimedia.org/w/index.php?oldid=${page.revisions[0].revid}`, sourceAudioUrl: url.href,
    originalPath, wavPath, downloaded: !!wav, sourceSha1: info.sha1, wavSha256: wav ? createHash('sha256').update(wav).digest('hex') : null, bytes: wav?.length ?? null, duration,
    transformation: 'Converted to PCM signed 16-bit WAV; metadata removed. No speech edits, trimming, speed, pitch or volume changes.',
    linguisticReview: 'PENDING_HUMAN', sourceEvidence: word.hanzi === '不客气' ? 'cmn (Mandarin) in source title; exact term in source title' : m.ImageDescription.value });
}
// Audio blocks fit the existing editor; vocabulary words currently have no audio field.
// Each source word gets one block, not a fabricated dialogue or a vocabulary schema change.
const l = (ru,kk,en) => ({ ru,kk,en });
const lessons = contentPack.lessons.map(item => {
  const draft = structuredClone(item.draft);
  const lessonWords = draft.blocks.filter(b => b.kind === 'vocabulary').flatMap(b => b.content.words);
  const alreadyPresent = new Set(draft.blocks.filter(b => b.kind === 'audio').map(b => b.content.hanzi));
  const additions = lessonWords.filter(w => !alreadyPresent.has(w.hanzi)).map(word => {
    const asset = assets.find(a => a.hanzi === word.hanzi);
    const { name, ...attribution } = asset.metadata;
    return { kind: 'audio', content: { title: l(`Послушайте: ${word.hanzi}`,`Тыңдаңыз: ${word.hanzi}`,`Listen: ${word.hanzi}`), ...word, ...attribution, audioUrl: asset.sourceAudioUrl } };
  });
  const vocabularyIndex = draft.blocks.findIndex(b => b.kind === 'vocabulary');
  if (vocabularyIndex >= 0) draft.blocks.splice(vocabularyIndex + 1, 0, ...additions);
  return { ...item, draft: draftSchema.parse(draft) };
});
const manifest = { status: 'DRAFT_REQUIRES_HUMAN_REVIEW', checkedAt: new Date().toISOString(), publish: false,
  assets, missingDialogues: ['hsk1-greetings','hsk1-my-name','hsk1-your-name','hsk1-courtesy'],
  integration: 'Offline drafts reference unchanged Commons originals. WAV files are prepared for media-library upload; replace URLs only after successful authenticated upload.' };
await writeFile(`${root}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(`${root}/proposed-content-with-audio.json`, JSON.stringify({ ...contentPack, audioManifest: 'manifest.json', lessons }, null, 2) + '\n');
const credits = ['# Источники аудио HSK 1', '', 'ЧЕРНОВИК. Все файлы требуют прослушивания преподавателем. Исходники сохранены без изменений; WAV — конвертация в PCM 16-bit без обрезки и изменения речи. Публикация не выполнялась.', '', '| Слово | Автор | Лицензия | Источник | WAV |', '|---|---|---|---|---|'];
for (const a of assets) credits.push(`| ${a.hanzi} · ${a.pinyin} | ${a.metadata.author} | [${a.metadata.license}](${a.metadata.licenseUrl}) | [Страница файла](${a.metadata.sourceUrl}) · [версия](${a.sourceRevisionUrl}) | [${a.duration.toFixed(2)} с](${a.wavPath}) |`);
credits.push('', 'Имена и лицензии относятся к аудиозаписям. Они не означают одобрения ZhPath авторами. Для распространения сохранять авторов, источники, лицензии и сведения о конвертации. Преподаватель должен сверить каждый файл с hanzi/pinyin и переводами в manifest.json.', '', 'Не найденные точные диалоги не заменены склейкой слов или синтетической записью. Тексты для записи: RECORDING_BRIEF.md.', '');
await writeFile(`${root}/CREDITS.md`, credits.join('\n'));
console.log(`Prepared ${assets.filter(a => a.downloaded).length}/${assets.length} audio originals and validated WAV files; five offline drafts. No database writes.`);
