const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const scope={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/strokeMatching.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
const {matchStroke,medianPoints}=scope.exports;
const manifest=require('../public/strokes/manifest.json');
let count=0;
for(const char of manifest.characters){
 const data=JSON.parse(fs.readFileSync(`public/strokes/${char.codePointAt(0).toString(16)}.json`));
 for(const median of data.medians){
  const expected=medianPoints(median);
  assert.equal(matchStroke(expected,expected),'accepted',`${char}: exact`);
  const densified=expected.flatMap((p,i)=>i ? [{x:(expected[i-1].x+p.x)/2,y:(expected[i-1].y+p.y)/2},p] : [p]);
  assert.equal(matchStroke(densified,expected),'accepted',`${char}: sampling`);
  assert.equal(matchStroke(expected.map(p=>({x:p.x+4,y:p.y-3})),expected),'accepted',`${char}: small drift`);
  assert.notEqual(matchStroke([...expected].reverse(),expected),'accepted',`${char}: reversed`);
  assert.equal(matchStroke(expected.map(p=>({x:p.x+90,y:p.y})),expected),'shape',`${char}: displaced`);
  assert.equal(matchStroke([expected[0]],expected),'shape',`${char}: dot`);
  count++;
 }
}
const line=[{x:20,y:20},{x:100,y:100}];
assert.equal(matchStroke([...line].reverse(),line),'direction');
assert.equal(matchStroke([line[0],line[1],line[0],line[1]],line),'shape');
assert.equal(matchStroke([{x:NaN,y:0},line[1]],line),'shape');
console.log(`${count} strokes: exact, variable sampling, small drift, reversed, displaced and dot checks passed; direction and scribble cases passed.`);
