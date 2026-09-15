const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const scope = { exports: {}, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/studyTimer.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const Timer = scope.exports.default;
const ms = window => window ? Date.parse(window.endAt) - Date.parse(window.startAt) : 0;
const timer = new Timer(Date.parse('2026-09-15T10:00:00Z'), 0);
assert.equal(timer.tick(1000), null);
timer.visibility(1000, true);
assert.equal(ms(timer.tick(16000)), 15000);
assert.equal(ms(timer.visibility(20000, false)), 4000);
assert.equal(timer.tick(35000), null);
timer.visibility(35000, true);
let total = 0;
for (const now of [50000, 65000, 80000, 95000, 110000]) total += ms(timer.tick(now));
assert.equal(total, 60000);
timer.activity(115000);
assert.equal(ms(timer.tick(120000)), 5000); // No retroactive idle time.
assert.equal(timer.tick(200000), null); // Suspended browser or delayed timer.
timer.activity(201000);
assert.equal(ms(timer.tick(206000)), 5000);
assert.equal(ms(timer.visibility(207000, false)), 1000);
assert.equal(timer.tick(220000), null);
const exact = new Timer(100000, 500);
exact.visibility(500, true);
assert.equal(exact.tick(1500).startAt, new Date(100000).toISOString());
console.log('Study timer: active time, blur, hidden tab, idle, resume, suspension and server clock anchor passed.');
