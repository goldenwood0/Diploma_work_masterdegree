import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { wavDuration, mediaMetadata } from '../dist-server/media.schema.js';
import { draftSchema } from '../dist-server/content.schema.js';
const root = 'docs/hsk1-audit/audio';
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const pack = JSON.parse(await readFile(`${root}/proposed-content-with-audio.json`, 'utf8'));
const report = [];
assert.equal(manifest.publish, false);
assert.equal(pack.publish, false);
assert.equal(manifest.assets.length, 10);
assert.equal(new Set(manifest.assets.map(a=>a.hanzi)).size, 10);
for(const a of manifest.assets){
  assert.equal(a.downloaded,true);
  mediaMetadata.parse(a.metadata);
  assert.equal(a.linguisticReview,'PENDING_HUMAN');
  const original = await readFile(`${root}/${a.originalPath}`);
  assert.equal(createHash('sha1').update(original).digest('hex'),a.sourceSha1);
  const wav = await readFile(`${root}/${a.wavPath}`);
  assert.equal(createHash('sha256').update(wav).digest('hex'),a.wavSha256);
  assert.equal(wavDuration(wav),a.duration);
  for(const lang of ['ru','kk','en']) assert.ok(a.translation[lang]);
  // Inspect the PCM data, not headers, for empty/silent output and clipping.
  let offset=12, data;
  while(offset<wav.length){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data')data=wav.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
  assert.ok(data?.length);
  let energy=0, peak=0, clipped=0;
  for(let i=0;i<data.length;i+=2){const n=data.readInt16LE(i);energy+=n*n;peak=Math.max(peak,Math.abs(n));if(Math.abs(n)>=32767)clipped++;}
  assert.ok(peak>0,'Silent file');
  const rms=Math.sqrt(energy/(data.length/2));
  report.push({hanzi:a.hanzi,duration:a.duration,bytes:wav.length,rmsDb:Math.round(20*Math.log10(rms/32768)*10)/10,peak,clippedSamples:clipped,status:'STRUCTURE_AND_CHECKSUM_PASS',linguisticReview:'PENDING_HUMAN'});
}
assert.equal(pack.lessons.length,5);
for(const lesson of pack.lessons){
  const draft=draftSchema.parse(lesson.draft);
  for(const block of draft.blocks.filter(b=>b.kind==='audio')){
    const asset=manifest.assets.find(a=>a.hanzi===block.content.hanzi);
    assert.ok(asset);
    assert.equal(block.content.audioUrl,asset.sourceAudioUrl);
    assert.equal(block.content.author,asset.metadata.author);
    assert.equal(block.content.pinyin.toLowerCase(),asset.pinyin.toLowerCase());
  }
  for(const word of draft.blocks.filter(b=>b.kind==='vocabulary').flatMap(b=>b.content.words))assert.ok(draft.blocks.some(b=>b.kind==='audio'&&b.content.hanzi===word.hanzi));
}
await writeFile(`${root}/technical-checks.json`,JSON.stringify({checkedAt:new Date().toISOString(),assets:report,draftsValidated:5,publication:false,humanAcceptance:false},null,2)+'\n');
console.log('PASS: 10 original checksums, 10 PCM WAVs, non-silence, credits and translations; all vocabulary covered in five valid offline drafts.');
