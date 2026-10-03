// State-machine unit tests with a minimal fake DOM/Worker/audio transport.
// These do NOT claim real-browser, accessibility, visual, playback or compatibility coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {LIMITS,makeDemo,validateReview,analyze} from '../src/engine.mjs';
const source=(await readFile(new URL('../web/app.mjs',import.meta.url),'utf8')).replace(/^import .*?;\n/,'').replaceAll('import.meta.url',JSON.stringify('http://unit.invalid/app.mjs'));
const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
function harness(){
 const elements=new Map(),workers=[],timers=new Map(),events={},windowEvents={},revoked=[],downloads=[];let timerId=0,blobId=0,plays=0,pauseCount=0;
 function el(id=''){return {id,value:'',checked:false,disabled:false,hidden:false,children:[],dataset:{},attributes:{},classList:{toggle(){}},width:1000,height:160,textContent:'',innerHTML:'',append(...e){this.children.push(...e);},replaceChildren(...e){this.children=[...e];},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];if(k==='src')delete this.src;},getAttribute(k){return this.attributes[k]??null;},getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true});},remove(){},click(){downloads.push(this.download);},pause(){pauseCount++;},load(){},play(){plays++;return Promise.resolve();}};}
 for(const id of html.matchAll(/\bid="([^"]+)"/g))elements.set(id[1],el(id[1]));
 for(const id of ['workbench','editor','empty','cancel'])elements.get(id).hidden=true;
 for(const [id,value]of [['threshold','-36'],['silence','80'],['midi','60'],['gain','none'],['fade-in','0'],['fade-out','0']])elements.get(id).value=value;
 const document={hidden:false,documentElement:{},body:el(),getElementById:id=>elements.get(id),querySelectorAll:()=>[],createElement:()=>el(),addEventListener:(event,fn)=>{events[event]=fn;}};
 class FakeWorker{constructor(){workers.push(this);this.terminated=false;}postMessage(message){this.message=message;}terminate(){this.terminated=true;}reply(result){this.onmessage({data:{id:this.message.id,result}});}error(message){this.onerror({message});}}
 class FakeURL extends URL{};FakeURL.createObjectURL=()=>`blob:unit-${++blobId}`;FakeURL.revokeObjectURL=url=>revoked.push(url);
 const context=vm.createContext({LIMITS,makeDemo,validateReview,document,Worker:FakeWorker,URL:FakeURL,Blob,structuredClone,console,window:{addEventListener:(event,fn)=>{windowEvents[event]=fn;}},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context,{filename:'app.mjs (state-machine unit)'});
 return {elements,workers,timers,document,events,windowEvents,revoked,downloads,get plays(){return plays;},get pauses(){return pauseCount;},last:()=>workers.at(-1),click:id=>elements.get(id).onclick(),input:(id,value)=>{elements.get(id).value=value;elements.get(id).oninput();}};
}
async function ready(h){h.click('demo');const analyzed=await analyze(makeDemo());h.last().reply(analyzed);assert.equal(h.last().message.op,'view');h.last().reply({waveform:[[0,1]]});return analyzed;}

test('model: Stop invalidates pending audition and discards even a forcibly delivered late result',async()=>{
 const h=harness();await ready(h);h.click('audition');const pending=h.last();assert.equal(pending.message.op,'audition');h.click('stop');assert.equal(pending.terminated,true);pending.reply({bytes:new Uint8Array([1])});assert.equal(h.plays,0);assert.equal(h.elements.get('audio').src,undefined);assert.equal(h.elements.get('cancel').hidden,true);
});

test('model: backgrounding invalidates pending audition; existing audio is revoked',async()=>{
 const h=harness();await ready(h);h.click('audition');const pending=h.last();h.document.hidden=true;h.events.visibilitychange();pending.reply({bytes:new Uint8Array([1])});assert.equal(h.plays,0);h.document.hidden=false;h.click('audition');h.last().reply({bytes:new Uint8Array([1])});assert.equal(h.plays,1);const url=h.elements.get('audio').src;h.document.hidden=true;h.events.visibilitychange();assert.equal(h.elements.get('audio').src,undefined);assert.ok(h.revoked.includes(url));
});

test('model: cancelled analyze cannot resurrect a workbench or export',async()=>{
 const h=harness();h.click('demo');const pending=h.last();h.click('cancel');const status=h.elements.get('status').textContent;pending.reply(await analyze(makeDemo()));assert.equal(h.elements.get('workbench').hidden,true);assert.equal(h.elements.get('export').disabled,true);assert.equal(h.elements.get('status').textContent,status);
});

test('model: newer source supersedes older file-read completion',async()=>{
 const h=harness();let finishFirst,finishSecond;const first=new Promise(r=>finishFirst=r),second=new Promise(r=>finishSecond=r);h.elements.get('file').files=[{name:'first.wav',size:100,arrayBuffer:()=>first}];h.elements.get('file').onchange();h.elements.get('file').files=[{name:'second.wav',size:100,arrayBuffer:()=>second}];h.elements.get('file').onchange();finishSecond(makeDemo().buffer);await new Promise(r=>setImmediate(r));const current=h.last();finishFirst(makeDemo().buffer);await new Promise(r=>setImmediate(r));assert.equal(h.elements.get('source-name').textContent,'second.wav');assert.equal(h.last(),current);assert.equal(current.terminated,false);
});

test('model: pending export is cancelled by a new processing edit before download',async()=>{
 const h=harness();const analyzed=await ready(h);for(const hit of analyzed.review.hits)hit.reviewed=true; // callback receives this exact review in the local model
 h.input('midi','61');assert.equal(h.elements.get('export').disabled,false);h.click('export');const pending=h.last();h.input('fade-in','1');pending.reply({bytes:new Uint8Array([1]),manifest:{hits:[{}]}});assert.deepEqual(h.downloads,[]);assert.equal(h.elements.get('export').disabled,true);assert.equal(h.elements.get('reviewed').checked,false);
});

test('model: applied or unapplied boundary edits block stale reviewed exports',async()=>{
 const h=harness();const analyzed=await ready(h);analyzed.review.hits.forEach(hit=>hit.reviewed=true);h.input('midi','61');assert.equal(h.elements.get('export').disabled,false);h.input('start','2.5');assert.equal(h.elements.get('export').disabled,true);assert.equal(h.elements.get('save-review').disabled,true);assert.equal(h.elements.get('reviewed').disabled,true);h.click('apply');assert.equal(h.elements.get('export').disabled,true);h.input('start','1');h.click('apply');h.last().reply({waveform:[[0,1]]});assert.equal(h.elements.get('reviewed').checked,false);assert.equal(h.elements.get('export').disabled,true);
});

test('model: timeout discards late worker success and allows a new operation',async()=>{
 const h=harness();h.click('demo');const pending=h.last(),timeout=[...h.timers.values()][0];timeout();assert.equal(pending.terminated,true);pending.reply(await analyze(makeDemo()));assert.equal(h.elements.get('workbench').hidden,true);h.click('demo');assert.equal(h.last().terminated,false);assert.equal(h.elements.get('cancel').hidden,false);
});

test('model: a late audio.play rejection cannot overwrite a newer Stop status',async()=>{
 const h=harness();await ready(h);let rejectPlay;h.elements.get('audio').play=()=>new Promise((resolve,reject)=>{rejectPlay=reject;});h.click('audition');h.last().reply({bytes:new Uint8Array([1])});h.click('stop');const latest=h.elements.get('status').textContent;rejectPlay(Error('aborted'));await new Promise(r=>setImmediate(r));assert.equal(h.elements.get('status').textContent,latest);
});
