// Independent reviewer fixtures do not use the production WAV encoder/decoder.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseWav,detect,analyze,renderHit,gainFor,exportPack,zipStore} from '../src/engine.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function riff(samples,{channels=1,rate=8000,extras=[],dataFirst=false}={}) {
  const fmt=Buffer.alloc(16);fmt.writeUInt16LE(1,0);fmt.writeUInt16LE(channels,2);fmt.writeUInt32LE(rate,4);fmt.writeUInt32LE(rate*channels*2,8);fmt.writeUInt16LE(channels*2,12);fmt.writeUInt16LE(16,14);
  const pcm=Buffer.alloc(samples.length*2);samples.forEach((s,i)=>pcm.writeInt16LE(s,i*2));
  const chunks=(dataFirst?[['data',pcm],...extras,['fmt ',fmt]]:[['fmt ',fmt],...extras,['data',pcm]]).map(([tag,data])=>{const h=Buffer.alloc(8);h.write(tag);h.writeUInt32LE(data.length,4);return Buffer.concat([h,data,...(data.length%2?[Buffer.from([0x89])]:[])]);});
  const body=Buffer.concat([Buffer.from('WAVE'),...chunks]);const header=Buffer.alloc(8);header.write('RIFF');header.writeUInt32LE(body.length,4);return Buffer.concat([header,body]);
}
const cut=(id,start,end,included=true)=>({id,start,end,included,reviewed:true});
async function reviewFor(input,hits,settings={}) {const r=(await analyze(input)).review;r.hits=hits;r.settings={...r.settings,...settings};return r;}
function zipRead(raw) {
  const b=Buffer.from(raw),e=b.length-22;assert.equal(b.readUInt32LE(e),0x06054b50);assert.equal(b.readUInt16LE(e+4),0);assert.equal(b.readUInt16LE(e+6),0);assert.equal(b.readUInt16LE(e+8),b.readUInt16LE(e+10));assert.equal(b.readUInt16LE(e+20),0);
  let p=b.readUInt32LE(e+16);const start=p,result=new Map();
  for(let i=0;i<b.readUInt16LE(e+10);i++) {
    assert.equal(b.readUInt32LE(p),0x02014b50);assert.equal(b.readUInt16LE(p+8),0);assert.equal(b.readUInt16LE(p+10),0);assert.equal(b.readUInt16LE(p+12),0);assert.equal(b.readUInt16LE(p+14),33);
    const size=b.readUInt32LE(p+24),nameLength=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nameLength).toString('ascii');
    assert.equal(b.readUInt32LE(offset),0x04034b50);assert.equal(b.readUInt16LE(offset+6),0);assert.equal(b.readUInt16LE(offset+8),0);assert.equal(b.readUInt32LE(offset+18),size);assert.equal(b.readUInt32LE(offset+22),size);assert.equal(b.readUInt16LE(offset+26),nameLength);assert.equal(b.readUInt16LE(offset+28),0);assert.equal(b.subarray(offset+30,offset+30+nameLength).toString('ascii'),name);
    const payload=b.subarray(offset+30+nameLength,offset+30+nameLength+size);assert.ok(payload.length===size);
    // Independent lookup-table CRC; production uses bit-by-bit CRC.
    const table=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});let crc=0xffffffff;for(const x of payload)crc=table[(crc^x)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
    assert.equal(b.readUInt32LE(p+16),crc);assert.equal(b.readUInt32LE(offset+14),crc);assert.ok(!result.has(name));result.set(name,payload);p+=46+nameLength+extra+comment;
  }
  assert.equal(p,e);assert.equal(p-start,b.readUInt32LE(e+12));return result;
}
function pcmRead(raw) {const b=Buffer.from(raw);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(4)+8,b.length);assert.equal(b.toString('ascii',8,16),'WAVEfmt ');assert.equal(b.readUInt32LE(16),16);assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(34),16);assert.equal(b.toString('ascii',36,40),'data');assert.equal(b.readUInt32LE(40)+44,b.length);return {channels:b.readUInt16LE(22),rate:b.readUInt32LE(24),samples:Array.from({length:(b.length-44)/2},(_,i)=>b.readInt16LE(44+i*2))};}

test('independent stereo source, reversed order, exclusion, half-away quantization and ZIP/SFZ readback',async()=>{
  const samples=[99,-100,1,-1,2,-2,1,-1,0,0,7,-8,2,-2,1,-1];
  const input=riff(samples,{channels:2,rate:48000,dataFirst:true,extras:[['JUNK',Buffer.from([1,2,3])],['LIST',Buffer.from('metadata not exported')]]});
  const review=await reviewFor(input,[cut('h0003',6,8),cut('h0002',5,6,false),cut('h0001',1,4)],{midiKey:0,gain:'shared-peak'});
  const pack=await exportPack(input,review),files=zipRead(pack.bytes);assert.equal(files.size,5);
  assert.deepEqual(pcmRead(files.get('samples/hit-001.wav')),{channels:2,rate:48000,samples:[29203,-29203,14602,-14602]});
  assert.deepEqual(pcmRead(files.get('samples/hit-002.wav')).samples,[14602,-14602,29203,-29203,14602,-14602]);
  const manifest=JSON.parse(files.get('manifest.json'));assert.equal(manifest.sourceSha256,hash(input));assert.deepEqual(manifest.hits.map(h=>[h.id,h.start,h.end,h.sequence]),[['h0003',6,8,1],['h0001',1,4,2]]);
  for(const h of manifest.hits)assert.equal(h.sha256,hash(files.get(h.path)));
  const sfz=files.get('instrument.sfz').toString();assert.match(sfz,/^<group> key=0 seq_length=2 loop_mode=one_shot$/m);assert.deepEqual([...sfz.matchAll(/^<region> seq_position=(\d+) sample=(.*)$/gm)].map(m=>m.slice(1)),[['1','samples/hit-001.wav'],['2','samples/hit-002.wav']]);
  assert.deepEqual(pack.bytes,(await exportPack(input,structuredClone(review))).bytes);
});

test('independent negative full-scale no-gain render preserves words and channel frame boundaries',async()=>{
 const samples=[32767,-32768,123,-456,1,-1,0,0],input=riff(samples,{channels:2});const review=await reviewFor(input,[cut('h0001',0,2),cut('h0002',2,4)]);const files=zipRead((await exportPack(input,review)).bytes);assert.deepEqual(pcmRead(files.get('samples/hit-001.wav')).samples,samples.slice(0,4));assert.deepEqual(pcmRead(files.get('samples/hit-002.wav')).samples,samples.slice(4));
});

test('random segmentation matches independent active-index gap grouping oracle (300 fixtures)',()=>{
 let seed=39190;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 for(let t=0;t<300;t++){const channels=t%2+1,frames=30+rand()%90,gap=1+rand()%9,s=Array.from({length:frames*channels},()=>rand()%7===0?(rand()%2?-700:700):rand()%600-300);const active=Array.from({length:frames},(_,i)=>i).filter(i=>s.slice(i*channels,(i+1)*channels).some(x=>Math.abs(x)>=328));const expected=[];for(const f of active){const last=expected.at(-1);if(!last||f-last[1]>=gap)expected.push([f,f+1]);else last[1]=f+1;}assert.deepEqual(detect(parseWav(riff(s,{channels})),{thresholdDb:-40,silenceMs:gap/8}).hits.map(h=>[h.start,h.end]),expected);}
});

test('shared gain is calculated only across included channels/cuts; negative gain rejects',()=>{
 const w=parseWav(riff([-32768,100,1,-1,2,-2],{channels:2})),hit=cut('h0001',1,3),g=gainFor(w,[hit],'shared-peak');assert.equal(g.gain,29203/2);assert.deepEqual([...renderHit(w,hit,{fadeInFrames:0,fadeOutFrames:0},g.gain)],[14602,-14602,29203,-29203]);assert.throws(()=>renderHit(w,hit,{fadeInFrames:0,fadeOutFrames:0},-1),/Gain/);
});

test('gain and fades agree with rational oracle within at most one quantization unit (400 fixtures)',()=>{
 let seed=99815;const rand=()=>seed=(Math.imul(seed,1103515245)+12345)>>>0;
 for(let t=0;t<400;t++){const ch=t%2+1,frames=5+rand()%75,s=Array.from({length:frames*ch},()=>rand()%65536-32768),peak=Math.max(...s.map(Math.abs)),fi=rand()%Math.floor(frames/2),fo=rand()%Math.floor(frames/2),settings={fadeInFrames:fi,fadeOutFrames:fo};const actual=renderHit(parseWav(riff(s,{channels:ch})),{start:0,end:frames},settings,29203/peak);for(let i=0;i<s.length;i++){const f=Math.floor(i/ch);let num=BigInt(Math.abs(s[i]))*29203n,den=BigInt(peak);if(fi&&f<fi){num*=BigInt(fi===1?0:f);den*=BigInt(fi===1?1:fi-1);}if(fo&&f>=frames-fo){num*=BigInt(fo===1?0:frames-1-f);den*=BigInt(fo===1?1:fo-1);}const expected=Math.sign(s[i])*Number((2n*num+den)/(2n*den));assert.ok(Math.abs(actual[i]-expected)<=1,`trial ${t}, word ${i}`);assert.ok(Math.abs(actual[i])<=29203);}if(fi)assert.deepEqual([...actual.slice(0,ch)],Array(ch).fill(0));if(fo)assert.deepEqual([...actual.slice(-ch)],Array(ch).fill(0));}
});

test('SFZ documented seq_length maximum 100 passes; 101 included hits reject',async()=>{
 const input=riff(Array(128).fill(1000));const review=await reviewFor(input,Array.from({length:101},(_,i)=>cut(`h${String(i+1).padStart(4,'0')}`,i,i+1)));
 await assert.rejects(exportPack(input,review),/100|sequence|round.robin/i);
 review.hits[100].included=false;const files=zipRead((await exportPack(input,review)).bytes);assert.equal(files.size,103);assert.match(files.get('instrument.sfz').toString(),/seq_length=100 /);assert.match(files.get('instrument.sfz').toString(),/seq_position=100 /);
});

test('CLI guards regular-file/review budgets and preserves existing output including symlink target',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'take-kit-review-')),cli=resolve('src/cli.mjs'),run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8',timeout:5000});
 try{await writeFile(join(dir,'source.wav'),riff([1000,-1000]));assert.equal(run('analyze','source.wav','review.json').status,0);const review=JSON.parse(await readFile(join(dir,'review.json')));review.hits.forEach(h=>h.reviewed=true);await writeFile(join(dir,'valid.json'),JSON.stringify(review));await writeFile(join(dir,'sentinel'),'KEEP');await symlink('sentinel',join(dir,'pack.zip'));assert.equal(run('pack','source.wav','valid.json','pack.zip').status,1);assert.equal(await readFile(join(dir,'sentinel'),'utf8'),'KEEP');assert.equal(run('analyze','.','bad.json').status,1);await writeFile(join(dir,'large.json'),' '.repeat(128*1024+1));assert.equal(run('pack','source.wav','large.json','out.zip').status,1);assert.equal(run('analyze','source.wav','out.json','NaN').status,1);assert.equal(run('analyze','source.wav','out.json','-36','0').status,1);}
 finally{await rm(dir,{recursive:true,force:true});}
});

test('strict safe-ID and archive-path allowlists reject trailing-newline lookalikes',async()=>{
 const input=riff([1000,-1000]),review=await reviewFor(input,[cut('h0001\n',0,2)]);await assert.rejects(exportPack(input,review),/ID|safe|Invalid/);assert.throws(()=>zipStore([{name:'instrument.sfz\n',bytes:new Uint8Array(1)}]),/Unsafe/);assert.throws(()=>zipStore([{name:'samples/hit-001.wav\n',bytes:new Uint8Array(1)}]),/Unsafe/);
});
