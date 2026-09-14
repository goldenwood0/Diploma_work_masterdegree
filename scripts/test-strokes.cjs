const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const manifest = require('../public/strokes/manifest.json');
const scope = { exports: {}, require: name => name === 'zod' ? require('zod') : {default:manifest} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/api/strokes.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
const { strokeSchema, hasStrokes, getStrokes } = scope.exports;
const words = [...fs.readFileSync('server/seed.ts', 'utf8').matchAll(/word\(\s*"([^"]+)"/g)].map(match => match[1]);
const characters = [...new Set([...words.join('')].filter(c => /\p{Script=Han}/u.test(c)))];
for (const char of characters) {
  assert.ok(hasStrokes(char), `Missing pilot character: ${char}`);
  const data = JSON.parse(fs.readFileSync(`public/strokes/${char.codePointAt(0).toString(16)}.json`, 'utf8'));
  assert.ok(strokeSchema.safeParse(data).success, `Invalid strokes: ${char}`);
}
assert.equal(strokeSchema.parse(JSON.parse(fs.readFileSync('public/strokes/4f60.json'))).strokes.length, 7);
assert.equal(strokeSchema.parse(JSON.parse(fs.readFileSync('public/strokes/597d.json'))).strokes.length, 6);
assert.equal(hasStrokes('../bad'), false);
assert.equal(strokeSchema.safeParse({ strokes: ['<script>'], medians: [[[0,0],[1,1]]] }).success, false);
assert.equal(strokeSchema.safeParse({ strokes: ['M0 0L1 1'], medians: [] }).success, false);
assert.ok(fs.readFileSync('public/strokes/ARPHICPL.TXT','utf8').includes('ARPHIC PUBLIC LICENSE'));
(async () => {
  assert.equal(await getStrokes('龘', new AbortController().signal), null);
  scope.fetch = async () => ({ok:false});
  await assert.rejects(() => getStrokes('你', new AbortController().signal));
  scope.fetch = async () => ({ok:true,json:async()=>({invalid:true})});
  await assert.rejects(() => getStrokes('你', new AbortController().signal));
  console.log(`${characters.length} pilot glyphs, known stroke counts, missing data and invalid responses checked.`);
})().catch(error => { console.error(error); process.exitCode=1; });
