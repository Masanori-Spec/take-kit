import {performance} from 'node:perf_hooks';
import {writeFile,mkdir} from 'node:fs/promises';
import {LIMITS,encodeWav,analyze,exportPack} from '../src/engine.mjs';
const frames=Math.floor((LIMITS.bytes-44)/4),samples=new Int16Array(frames*2);
for(let i=0;i<samples.length;i++)samples[i]=i%2?12000:-6000;
const source=encodeWav(samples,2,96000),start=performance.now(),{review}=await analyze(source);const analyzeMs=performance.now()-start;
review.hits.forEach(h=>h.reviewed=true);const exportStart=performance.now(),pack=await exportPack(source,review),exportMs=performance.now()-exportStart;
const report={node:process.version,inputBytes:source.length,frames,sampleRate:96000,seconds:frames/96000,candidates:review.hits.length,exportBytes:pack.bytes.length,analyzeMs:Math.round(analyzeMs),exportMs:Math.round(exportMs),note:'Local engine benchmark only; not a browser latency or memory guarantee'};
await mkdir('../take-kit-output',{recursive:true});await writeFile('../take-kit-output/benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
