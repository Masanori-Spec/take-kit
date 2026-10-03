#!/usr/bin/env node
import { open,writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { analyze,exportPack,makeDemo,LIMITS } from './engine.mjs';
const usage=`TakeKit\n  node src/cli.mjs demo out.wav\n  node src/cli.mjs analyze input.wav review.json [threshold-dB] [silence-ms]\n  node src/cli.mjs pack input.wav reviewed.json output.zip\nReview ranges/order/inclusion/settings and mark each included hit reviewed:true. Outputs never overwrite files. Input limit: 32 MiB / 120 s PCM16 mono/stereo.\n`;
async function readBounded(path,max){
  const file=await open(path,constants.O_RDONLY|constants.O_NONBLOCK);
  try{const info=await file.stat();if(!info.isFile()||info.size>max)throw Error('Input exceeds regular-file budget');
    const buffer=Buffer.allocUnsafe(max+1);let used=0;
    while(used<buffer.length){const {bytesRead}=await file.read(buffer,used,buffer.length-used,null);if(!bytesRead)break;used+=bytesRead;}
    if(used>max)throw Error('Input grew beyond file budget');return buffer.subarray(0,used);
  }finally{await file.close();}
}
try {
  const [cmd,...args]=process.argv.slice(2);
  if(cmd==='demo' && args.length===1){await writeFile(args[0],makeDemo(),{flag:'wx'});}
  else if(cmd==='analyze' && args.length>=2 && args.length<=4){const input=await readBounded(args[0],LIMITS.bytes);const options={...(args[2]!==undefined?{thresholdDb:Number(args[2])}:{}),...(args[3]!==undefined?{silenceMs:Number(args[3])}: {})};const result=await analyze(input,options);await writeFile(args[1],JSON.stringify(result.review,null,2)+'\n',{flag:'wx'});console.log(`${result.review.hits.length} candidates; review required`);}
  else if(cmd==='pack' && args.length===3){const input=await readBounded(args[0],LIMITS.bytes),review=JSON.parse((await readBounded(args[1],LIMITS.reviewBytes)).toString('utf8')),result=await exportPack(input,review);await writeFile(args[2],result.bytes,{flag:'wx'});console.log(`${result.manifest.hits.length} reviewed WAV files packed`);}
  else {console.log(usage);process.exitCode=cmd && cmd!=='--help'?1:0;}
} catch(e){console.error(`TakeKit: ${e.message}`);process.exitCode=1;}
