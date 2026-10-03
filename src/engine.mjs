/** TakeKit engine. All coordinates are integer frames, [start, end). No DOM or network. */
export const VERSION = '0.1.0';
export const LIMITS = Object.freeze({ bytes: 32 * 1024 * 1024, seconds: 120, hits: 128, sequence: 100, minRate: 8000, maxRate: 192000, reviewBytes: 128 * 1024, exportBytes: 34 * 1024 * 1024 });
const fail = message => { throw new Error(message); };
const integer = (n, min, max, name) => { if (!Number.isSafeInteger(n) || n < min || n > max) fail(`${name}: expected integer ${min}..${max}`); return n; };
const finite = (n, min, max, name) => { if (!Number.isFinite(n) || n < min || n > max) fail(`${name}: expected ${min}..${max}`); return n; };
const ascii = (v, p, n) => Array.from({length:n}, (_,i) => String.fromCharCode(v.getUint8(p+i))).join('');
const put = (v, p, text) => [...text].forEach((c,i) => v.setUint8(p+i,c.charCodeAt(0)));
export function bytesOf(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof Uint8Array) return input;
  fail('Input must be WAV bytes');
}
export async function sha256(input) {
  const bytes = bytesOf(input);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function parseWav(input) {
  const bytes = bytesOf(input);
  if (bytes.length < 44 || bytes.length > LIMITS.bytes) fail('WAV size must be 44 bytes..32 MiB');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(v,0,4)!=='RIFF' || ascii(v,8,4)!=='WAVE') fail('Only little-endian RIFF/WAVE is supported');
  if (v.getUint32(4,true) !== bytes.length-8) fail('RIFF length mismatch or trailing data');
  let fmt, data, chunks=0;
  for (let p=12; p<bytes.length;) {
    if (++chunks>1024) fail('Too many RIFF chunks');
    if (p+8>bytes.length) fail('Truncated chunk header');
    const tag=ascii(v,p,4), size=v.getUint32(p+4,true), start=p+8, next=start+size+(size%2);
    if (next>bytes.length) fail('Truncated chunk or missing odd-byte padding');
    if (tag==='fmt ') {
      if (fmt) fail('Duplicate fmt chunk');
      if (size!==16 && size!==18) fail('PCM fmt chunk must be 16 or 18 bytes');
      if (size===18 && v.getUint16(start+16,true)!==0) fail('PCM extension must be empty');
      fmt={format:v.getUint16(start,true),channels:v.getUint16(start+2,true),sampleRate:v.getUint32(start+4,true),byteRate:v.getUint32(start+8,true),align:v.getUint16(start+12,true),bits:v.getUint16(start+14,true)};
    } else if (tag==='data') {
      if (data) fail('Duplicate data chunk');
      data={start,size};
    }
    p=next;
  }
  if (!fmt || !data) fail('Missing fmt or data chunk');
  if (fmt.format!==1 || fmt.bits!==16 || ![1,2].includes(fmt.channels)) fail('Only PCM16 mono/stereo is supported (no float, compressed, or extensible WAV)');
  integer(fmt.sampleRate,LIMITS.minRate,LIMITS.maxRate,'Sample rate');
  if (fmt.align!==fmt.channels*2 || fmt.byteRate!==fmt.sampleRate*fmt.align) fail('Invalid block alignment or byte rate');
  if (!data.size || data.size%fmt.align!==0) fail('Empty or partial audio frames');
  const frames=data.size/fmt.align;
  if (frames/fmt.sampleRate>LIMITS.seconds) fail('Audio exceeds 120 seconds');
  const samples=new Int16Array(frames*fmt.channels);
  let peak=0, sums=Array(fmt.channels).fill(0);
  for(let i=0;i<samples.length;i++) { const s=v.getInt16(data.start+i*2,true); samples[i]=s; peak=Math.max(peak,Math.abs(s)); sums[i%fmt.channels]+=s; }
  return {samples,frames,channels:fmt.channels,sampleRate:fmt.sampleRate,peak,dc:sums.map(s=>s/frames/32768)};
}
export function encodeWav(samples,channels,sampleRate) {
  if (!(samples instanceof Int16Array)) fail('PCM16 samples required');
  integer(channels,1,2,'Channels'); integer(sampleRate,LIMITS.minRate,LIMITS.maxRate,'Sample rate');
  if (!samples.length || samples.length%channels || samples.byteLength+44>LIMITS.bytes) fail('Invalid PCM sample length');
  const out=new Uint8Array(44+samples.byteLength),v=new DataView(out.buffer);
  put(v,0,'RIFF');v.setUint32(4,out.length-8,true);put(v,8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);put(v,36,'data');v.setUint32(40,samples.byteLength,true);
  for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,samples[i],true);
  return out;
}
export function detect(wav,{thresholdDb=-36,silenceMs=80}={}) {
  finite(thresholdDb,-72,0,'Threshold dB'); finite(silenceMs,0.1,2000,'Silence ms');
  const level=Math.ceil(32768*10**(thresholdDb/20)), silenceFrames=Math.max(1,Math.ceil(silenceMs*wav.sampleRate/1000));
  const hits=[]; let start=-1,last=-1;
  const endHit=()=>{ if(hits.length>=LIMITS.hits)fail('More than 128 hits; increase minimum silence or threshold'); hits.push({id:`h${String(hits.length+1).padStart(4,'0')}`,start,end:last+1,included:true,reviewed:false}); start=-1; };
  for(let frame=0;frame<wav.frames;frame++) {
    let active=false; for(let c=0;c<wav.channels;c++) if(Math.abs(wav.samples[frame*wav.channels+c])>=level)active=true;
    if(active){if(start<0)start=frame;last=frame;}
    else if(start>=0 && frame-last>=silenceFrames)endHit();
  }
  if(start>=0)endHit();
  return {hits,thresholdDb,silenceMs,silenceFrames,level};
}
export function envelope(wav,start=0,end=wav.frames,bins=900) {
  integer(start,0,wav.frames-1,'Envelope start');integer(end,start+1,wav.frames,'Envelope end'); integer(bins,1,2000,'Bins');
  const count=Math.min(bins,end-start), result=[];
  for(let b=0;b<count;b++) {
    const a=start+Math.floor(b*(end-start)/count),z=start+Math.floor((b+1)*(end-start)/count);let min=32767,max=-32768;
    for(let f=a;f<z;f++)for(let c=0;c<wav.channels;c++){const s=wav.samples[f*wav.channels+c];min=Math.min(min,s);max=Math.max(max,s);}
    result.push([min/32768,max/32768]);
  }
  return result;
}
export async function analyze(input,options={}) {
  const wav=parseWav(input), detection=detect(wav,options);
  return {review:{schema:'take-kit-review/v1',sourceSha256:await sha256(input),source:{sampleRate:wav.sampleRate,channels:wav.channels,frames:wav.frames},detection:{thresholdDb:detection.thresholdDb,silenceMs:detection.silenceMs},settings:{midiKey:60,gain:'none',fadeInFrames:0,fadeOutFrames:0},hits:detection.hits},summary:{...wav,samples:undefined},waveform:envelope(wav)};
}
export function validateReview(wav,review,{requireReviewed=true,allowEmpty=false,forMapping=true}={}) {
  if(!review || review.schema!=='take-kit-review/v1' || typeof review.sourceSha256!=='string' || !/^[a-f0-9]{64}$(?![\s\S])/.test(review.sourceSha256))fail('Invalid review schema or source hash');
  if(!review.detection)fail('Missing detection settings');
  finite(review.detection.thresholdDb,-72,0,'Threshold dB');finite(review.detection.silenceMs,.1,2000,'Silence ms');
  const source=review.source;
  if(!source || source.sampleRate!==wav.sampleRate || source.channels!==wav.channels || source.frames!==wav.frames)fail('Review source metadata mismatch');
  if(!Array.isArray(review.hits) || review.hits.length>LIMITS.hits)fail('Review must contain at most 128 hits');
  const s=review.settings;
  if(!s || !['none','shared-peak'].includes(s.gain))fail('Gain must be none or shared-peak');
  integer(s.midiKey,0,127,'MIDI key');integer(s.fadeInFrames,0,Math.floor(wav.sampleRate*.05),'Fade in');integer(s.fadeOutFrames,0,Math.floor(wav.sampleRate*.05),'Fade out');
  const ids=new Set(),included=[];
  for(const hit of review.hits) {
    if(!hit || typeof hit.id!=='string' || !/^h\d{4}$(?![\s\S])/.test(hit.id) || ids.has(hit.id))fail('Hit IDs must be unique h0000-style safe IDs');
    ids.add(hit.id);
    integer(hit.start,0,wav.frames-1,'Start frame');integer(hit.end,hit.start+1,wav.frames,'End frame');
    if(typeof hit.included!=='boolean' || typeof hit.reviewed!=='boolean')fail('Hit inclusion and review must be booleans');
    if(hit.included) {
      if(requireReviewed && !hit.reviewed)fail('Review every included hit before export');
      if(s.fadeInFrames+s.fadeOutFrames>hit.end-hit.start)fail('Fades overlap or exceed an included hit');
      included.push(hit);
    }
  }
  if(forMapping && included.length>LIMITS.sequence)fail('SFZ round robin supports at most 100 included hits; exclude extra candidates');
  if(!included.length && !allowEmpty)fail('Include at least one hit');
  const sorted=[...included].sort((a,b)=>a.start-b.start);
  for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].end)fail('Included hit ranges overlap');
  return included;
}
export function gainFor(wav,hits,mode) {
  let peak=0;
  for(const hit of hits)for(let i=hit.start*wav.channels;i<hit.end*wav.channels;i++)peak=Math.max(peak,Math.abs(wav.samples[i]));
  const target=29203; // floor(32767 * 10^(-1/20)); one shared conservative -1 dBFS target.
  return {gain:mode==='shared-peak' && peak>0 ? target/peak : 1,inputPeak:peak,targetPeak:mode==='shared-peak'?target:null};
}
export function renderHit(wav,hit,settings,gain=1) {
  integer(hit.start,0,wav.frames-1,'Start frame');integer(hit.end,hit.start+1,wav.frames,'End frame');
  const length=hit.end-hit.start,fi=settings.fadeInFrames,fo=settings.fadeOutFrames;
  integer(fi,0,Math.floor(wav.sampleRate*.05),'Fade in');integer(fo,0,Math.floor(wav.sampleRate*.05),'Fade out');
  if(fi+fo>length)fail('Fades overlap or exceed hit');
  finite(gain,0,29203,'Gain');
  const output=new Int16Array(length*wav.channels);
  for(let f=0;f<length;f++) {
    let fade=1;
    if(fi && f<fi)fade*=fi===1?0:f/(fi-1);
    if(fo && f>=length-fo)fade*=fo===1?0:(length-1-f)/(fo-1);
    for(let c=0;c<wav.channels;c++) {
      const x=wav.samples[(hit.start+f)*wav.channels+c]*gain*fade;
      const sample=Math.sign(x)*Math.floor(Math.abs(x)+.5);
      if(sample < -32768 || sample>32767)fail('Gain would clip PCM16');
      output[f*wav.channels+c]=sample;
    }
  }
  return output;
}
export const crc32 = input => {
  let crc=0xffffffff;
  for(const byte of bytesOf(input)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
};
export function zipStore(files) {
  if(!Array.isArray(files)||files.length<1||files.length>LIMITS.hits+3)fail('Invalid ZIP file count');
  const enc=new TextEncoder(),names=new Set();let size=22;
  for(const file of files){if(typeof file.name!=='string'||!/^(?:samples\/hit-\d{3}\.wav|instrument\.sfz|manifest\.json|README\.txt)$(?![\s\S])/.test(file.name)||names.has(file.name))fail('Unsafe or duplicate ZIP path');names.add(file.name);file.bytes=bytesOf(file.bytes);size+=76+2*enc.encode(file.name).length+file.bytes.length;}
  if(size>LIMITS.exportBytes)fail('Export exceeds ZIP budget');
  const out=new Uint8Array(size),v=new DataView(out.buffer),central=[];let p=0;
  for(const file of files){const name=enc.encode(file.name),n=file.bytes.length,crc=crc32(file.bytes),offset=p;
    v.setUint32(p,0x04034b50,true);v.setUint16(p+4,20,true);v.setUint16(p+12,33,true);v.setUint32(p+14,crc,true);v.setUint32(p+18,n,true);v.setUint32(p+22,n,true);v.setUint16(p+26,name.length,true);out.set(name,p+30);out.set(file.bytes,p+30+name.length);p+=30+name.length+n;
    central.push({name,n,crc,offset});
  }
  const centralStart=p;
  for(const f of central){v.setUint32(p,0x02014b50,true);v.setUint16(p+4,20,true);v.setUint16(p+6,20,true);v.setUint16(p+14,33,true);v.setUint32(p+16,f.crc,true);v.setUint32(p+20,f.n,true);v.setUint32(p+24,f.n,true);v.setUint16(p+28,f.name.length,true);v.setUint32(p+42,f.offset,true);out.set(f.name,p+46);p+=46+f.name.length;}
  v.setUint32(p,0x06054b50,true);v.setUint16(p+8,files.length,true);v.setUint16(p+10,files.length,true);v.setUint32(p+12,p-centralStart,true);v.setUint32(p+16,centralStart,true);
  return out;
}
export async function exportPack(input,review) {
  const wav=parseWav(input),hits=validateReview(wav,review);
  if(await sha256(input)!==review.sourceSha256)fail('Source SHA-256 mismatch; analyze this WAV again');
  const settings=review.settings,gain=gainFor(wav,hits,settings.gain),files=[],records=[];
  for(let index=0;index<hits.length;index++) {
    const hit=hits[index],name=`samples/hit-${String(index+1).padStart(3,'0')}.wav`,bytes=encodeWav(renderHit(wav,hit,settings,gain.gain),wav.channels,wav.sampleRate);
    files.push({name,bytes});records.push({id:hit.id,path:name,start:hit.start,end:hit.end,frames:hit.end-hit.start,sequence:index+1,sha256:await sha256(bytes)});
  }
  const sfz=`// TakeKit ${VERSION}; one key, sequential round robin; player compatibility unverified\n<group> key=${settings.midiKey} seq_length=${hits.length} loop_mode=one_shot\n${records.map(r=>`<region> seq_position=${r.sequence} sample=${r.path}`).join('\n')}\n`;
  const manifest={schema:'take-kit-pack/v1',engineVersion:VERSION,sourceSha256:review.sourceSha256,source:{sampleRate:wav.sampleRate,channels:wav.channels,frames:wav.frames},coordinateSystem:'integer audio frames [start,end); both channels share boundaries',settings:{midiKey:settings.midiKey,gain:settings.gain,fadeInFrames:settings.fadeInFrames,fadeOutFrames:settings.fadeOutFrames,gainFactor:gain.gain,inputPeak:gain.inputPeak,targetPeak:gain.targetPeak},detection:{thresholdDb:review.detection.thresholdDb,silenceMs:review.detection.silenceMs},hits:records,reviewed:true,playerCompatibility:'not tested in an SFZ player',processing:'No resampling, per-hit normalization, pitch analysis, DC removal, or metadata copying. Linear endpoint fades are explicit; one shared gain preserves relative amplitudes away from fades, within PCM16 rounding.'};
  const enc=new TextEncoder();
  files.push({name:'instrument.sfz',bytes:enc.encode(sfz)},{name:'manifest.json',bytes:enc.encode(JSON.stringify(manifest,null,2)+'\n')},{name:'README.txt',bytes:enc.encode('TakeKit sample pack\nKeep instrument.sfz beside samples/. One MIDI key, sequential round robin. Extract the ZIP before loading the SFZ. SFZ player compatibility has not been verified.\nBoundaries are integer frames [start,end). See manifest.json for source SHA-256, order, explicit fades and shared gain.\nUse only recordings you have the right to use.\n')});
  return {bytes:zipStore(files),manifest,sfz};
}
export function makeDemo() {
  const sampleRate=24000,channels=2,frames=sampleRate*4,samples=new Int16Array(frames*channels);
  [4000,11000,18000,7500].forEach((amp,i)=>{const start=6000+i*22000;for(let j=0;j<11000;j++){const env=Math.exp(-j/1800)*Math.min(1,j/30),x=Math.sin(j*.101)+.28*Math.sin(j*.313);samples[(start+j)*2]=Math.round(amp*env*x*.7);samples[(start+j)*2+1]=Math.round(amp*env*(Math.sin(j*.101+.1)+.22*Math.sin(j*.313))*.65);}});
  return encodeWav(samples,channels,sampleRate);
}
