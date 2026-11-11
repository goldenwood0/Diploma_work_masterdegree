const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code=fs.readFileSync('public/theme.js','utf8');
function setup(saved, dark, blocked=false) {
 const events={},mediaEvents={}; const root={dataset:{},style:{}};
 const media={matches:dark,addEventListener:(n,f)=>mediaEvents[n]=f};
 const storage={getItem:()=>{if(blocked)throw Error();return saved;},setItem:(_,v)=>{if(blocked)throw Error();saved=v;}};
 const win={matchMedia:()=>media,addEventListener:(n,f)=>events[n]=f,dispatchEvent:e=>events[e.type]?.(e)};
 vm.runInNewContext(code,{window:win,document:{documentElement:root},localStorage:storage,Event:class{constructor(type){this.type=type;}}});
 return {root,events,media,mediaEvents,stored:()=>saved};
}
let s=setup(null,true);assert.equal(s.root.dataset.theme,'dark');
s.events['zhpath-theme-change']({detail:'light'});assert.equal(s.root.dataset.theme,'light');assert.equal(s.stored(),'light');
s.media.matches=false;s.mediaEvents.change();assert.equal(s.root.dataset.theme,'light');
s.events['zhpath-theme-change']({detail:'system'});assert.equal(s.root.dataset.theme,'light');s.media.matches=true;s.mediaEvents.change();assert.equal(s.root.dataset.theme,'dark');
s.events.storage({key:'zhpath-theme',newValue:'light'});assert.equal(s.root.dataset.theme,'light');
s.events.storage({key:null,newValue:null});assert.equal(s.root.dataset.theme,'dark');
s.events['zhpath-theme-change']({detail:'invalid'});assert.equal(s.root.dataset.themePreference,'system');
assert.equal(setup('light',true).root.dataset.theme,'light');assert.equal(setup('dark',false).root.dataset.theme,'dark');
s=setup(null,false,true);s.events['zhpath-theme-change']({detail:'dark'});assert.equal(s.root.dataset.theme,'dark');
function luminance(hex){const v=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
for(const [name,fg,bg] of [['light text','164934','F3F2EC'],['light secondary','4F6858','F3F2EC'],['light button','FFFDF9','226447'],['dark text','E3EBE5','121C18'],['dark secondary','A9BFAE','1C2A23'],['dark button','14291C','A2D7AE']]){const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,name);console.log(name,ratio.toFixed(2));}
console.log('PASS theme: initial/reload, explicit/system, device changes, cross-tab, invalid/storage denied; six text pairs >=4.5');

