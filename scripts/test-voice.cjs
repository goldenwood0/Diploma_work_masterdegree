const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {}, Blob };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/voiceRecorder.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const VoiceRecorder = scope.exports.default;

function fixture() {
  let now = 0, tick, created = 0;
  const revoked = [], states = [];
  const track = { stops: 0, onended: null, stop() { this.stops++; } };
  const stream = { getTracks: () => [track] };
  const media = {
    state: 'inactive', mimeType: 'audio/webm', data: 'sound',
    start() { this.state = 'recording'; },
    stop() {
      assert.notEqual(this.state, 'inactive');
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob([this.data], { type: this.mimeType }) });
        this.onstop?.();
      });
    },
  };
  const env = {
    supported: true, open: async () => stream, create: () => media,
    createUrl: blob => { assert.ok(blob.size); return `blob:test-${++created}`; },
    revokeUrl: url => revoked.push(url), now: () => now,
    every: callback => { tick = callback; return 1; }, cancel: () => { tick = undefined; },
  };
  const recorder = new VoiceRecorder(env, state => states.push(state));
  return { recorder, env, media, stream, track, states, revoked, advance: seconds => { now += seconds * 1000; tick?.(); }, hasTimer: () => !!tick };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('recording is opt-in, stops tracks promptly and revokes playback URLs on replacement and disposal', async () => {
  const f = fixture();
  assert.equal(f.recorder.state.status, 'idle'); assert.equal(f.media.state, 'inactive');
  await f.recorder.start(); f.advance(3); f.recorder.stop();
  assert.ok(f.track.stops > 0); assert.equal(f.recorder.state.status, 'stopping');
  await flush(); assert.equal(f.recorder.state.status, 'ready'); assert.equal(f.recorder.state.seconds, 3);
  assert.equal(f.hasTimer(), false);
  await f.recorder.start(); assert.deepEqual(f.revoked, ['blob:test-1']);
  f.recorder.stop(); await flush(); f.recorder.dispose();
  assert.deepEqual(f.revoked, ['blob:test-1', 'blob:test-2']);
});

test('cancelled permission requests and unmount release late streams without starting capture', async () => {
  for (const action of ['clear', 'dispose']) {
    const f = fixture(); let allow;
    f.env.open = () => new Promise(resolve => { allow = resolve; });
    const pending = f.recorder.start();
    assert.equal(f.recorder.state.status, 'requesting');
    f.recorder[action](); const count = f.states.length;
    allow(f.stream); await pending;
    assert.equal(f.track.stops, 1); assert.equal(f.media.state, 'inactive'); assert.equal(f.states.length, count);
  }
});

test('double start requests permission once and cancellation through stop is safe', async () => {
  const f = fixture(); let calls = 0, allow;
  f.env.open = () => { calls++; return new Promise(resolve => { allow = resolve; }); };
  const pending = f.recorder.start(); await f.recorder.start(); assert.equal(calls, 1);
  f.recorder.stop(); allow(f.stream); await pending;
  assert.equal(f.recorder.state.status, 'idle'); assert.equal(f.track.stops, 1);
});

test('sixty second limit automatically stops recording and closes the microphone', async () => {
  const f = fixture(); await f.recorder.start(); f.advance(61); await flush();
  assert.equal(f.recorder.state.status, 'ready'); assert.equal(f.recorder.state.seconds, 60);
  assert.ok(f.track.stops); assert.equal(f.hasTimer(), false);
});

test('oversized audio is discarded and recorder errors release tracks', async () => {
  const f = fixture(); await f.recorder.start();
  f.media.ondataavailable({ data: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]) });
  await flush(); assert.equal(f.recorder.state.error, 'size'); assert.equal(f.recorder.state.url, null); assert.ok(f.track.stops);
  const g = fixture(); await g.recorder.start(); g.media.onerror(); await flush();
  assert.equal(g.recorder.state.error, 'recording'); assert.ok(g.track.stops); assert.equal(g.hasTimer(), false);
});

test('unsupported browsers, denied permission and missing microphones give distinct errors', async () => {
  const f = fixture(); f.env.supported = false;
  f.env.open = () => { throw new Error('Must not request microphone'); };
  await f.recorder.start(); assert.equal(f.recorder.state.error, 'unsupported');
  for (const [name, expected] of [['NotAllowedError', 'permission'], ['NotFoundError', 'device'], ['NotReadableError', 'device']]) {
    const g = fixture(); g.env.open = async () => { throw { name }; };
    await g.recorder.start(); assert.equal(g.recorder.state.error, expected);
  }
});

test('empty recordings and encoder startup failures are recoverable', async () => {
  const f = fixture(); f.media.data = ''; await f.recorder.start(); f.recorder.stop(); await flush();
  assert.equal(f.recorder.state.error, 'empty'); assert.equal(f.recorder.state.url, null);
  f.media.data = 'retry'; await f.recorder.start(); f.recorder.stop(); await flush(); assert.equal(f.recorder.state.status, 'ready');
  const g = fixture(); g.env.create = () => { throw new Error('codec unavailable'); };
  await g.recorder.start(); assert.equal(g.recorder.state.error, 'recording'); assert.ok(g.track.stops);
});

test('device disconnect finalizes audio, while disposal suppresses queued audio callbacks', async () => {
  const f = fixture(); await f.recorder.start(); f.track.onended(); await flush(); assert.equal(f.recorder.state.status, 'ready');
  const g = fixture(); await g.recorder.start(); g.recorder.stop(); g.recorder.dispose(); const count = g.states.length;
  await flush(); assert.equal(g.states.length, count); assert.equal(g.recorder.state.url, null); assert.equal(g.hasTimer(), false);
});
