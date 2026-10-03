import {analyze,parseWav,validateReview,gainFor,renderHit,encodeWav,envelope,exportPack,sha256} from './engine.mjs';
self.onmessage=async ({data})=>{
  const {id,op,bytes,review,hitId,options}=data;
  try {
    let result;
    if(op==='analyze')result=await analyze(bytes,options);
    else if(op==='import') {const wav=parseWav(bytes);validateReview(wav,review,{requireReviewed:false,allowEmpty:true,forMapping:false});if(await sha256(bytes)!==review.sourceSha256)throw Error('Source SHA-256 mismatch');result={review};}
    else if(op==='export')result=await exportPack(bytes,review);
    else if(op==='view'||op==='audition') {
      const wav=parseWav(bytes),hit=review.hits.find(h=>h.id===hitId);
      if(!hit)throw Error('Select a hit');
      if(op==='view')result={waveform:envelope(wav,hit.start,hit.end)};
      else {if(!hit.included)throw Error('Include this hit before audition');const hits=validateReview(wav,review,{requireReviewed:false,forMapping:false}),gain=gainFor(wav,hits,review.settings.gain);result={bytes:encodeWav(renderHit(wav,hit,review.settings,gain.gain),wav.channels,wav.sampleRate)};}
    } else throw Error('Unknown operation');
    const transfer=result.bytes?[result.bytes.buffer]:[];
    self.postMessage({id,result},transfer);
  }catch(error){self.postMessage({id,error:error.message});}
};
