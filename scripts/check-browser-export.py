import hashlib,io,json,pathlib,struct,wave,zipfile
from fractions import Fraction
root=pathlib.Path(__file__).resolve().parents[1]; art=root/'docs/ci'; source=root/'examples/synthetic-four-strikes.wav'; review=json.loads((art/'browser-review.json').read_text()); pack=art/'browser-pack.zip'
with wave.open(str(source),'rb') as w:
 assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(2,2,24000,96000)
 source_words=struct.unpack('<'+'h'*(w.getnframes()*2),w.readframes(w.getnframes()))
source_hash=hashlib.sha256(source.read_bytes()).hexdigest();assert source_hash==review['sourceSha256']
included=[h for h in review['hits'] if h['included']]; peak=max(abs(v) for h in included for v in source_words[h['start']*2:h['end']*2]);gain=Fraction(29203,peak)
def rounded(x):
 a=abs(x);n=(2*a.numerator+a.denominator)//(2*a.denominator);return -n if x<0 else n
count=0
with zipfile.ZipFile(pack) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={'README.txt','instrument.sfz','manifest.json',*[f'samples/hit-{i:03}.wav' for i in range(1,4)]}
 assert all(i.compress_type==zipfile.ZIP_STORED and i.date_time==(1980,1,1,0,0,0) for i in z.infolist())
 manifest=json.loads(z.read('manifest.json'));sfz=z.read('instrument.sfz').decode();assert manifest['sourceSha256']==source_hash and manifest['reviewed'];assert manifest['settings']['inputPeak']==peak
 assert '<group> key=60 seq_length=3 loop_mode=one_shot' in sfz
 for i,(hit,rec) in enumerate(zip(included,manifest['hits']),1):
  assert (hit['id'],hit['start'],hit['end'])==(rec['id'],rec['start'],rec['end'])
  raw=z.read(rec['path']); assert hashlib.sha256(raw).hexdigest()==rec['sha256'];assert f'<region> seq_position={i} sample={rec["path"]}' in sfz
  with wave.open(io.BytesIO(raw),'rb') as w:
   frames=hit['end']-hit['start'];assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(2,2,24000,frames)
   actual=struct.unpack('<'+'h'*(frames*2),w.readframes(frames));expected=[]
   for f in range(frames):
    fade=Fraction(f,7) if f<8 else Fraction(frames-1-f,11) if f>=frames-12 else 1
    expected.extend(rounded(source_words[(hit['start']+f)*2+c]*gain*fade) for c in (0,1))
   assert actual==tuple(expected);count+=len(actual)
result={'status':'passed','sourceCommit':'495500031b74bd965a90bd81a628dafd4eff7353','runId':37145506490,'zipSha256':hashlib.sha256(pack.read_bytes()).hexdigest(),'sourceSha256':source_hash,'hits':3,'pcmWordsCompared':count,'checks':['ZIP CRC and safe exact paths','fixed timestamps and STORE compression','source SHA-256','WAV headers and frame counts','all PCM words match independent rational shared gain and fades','per-WAV SHA-256','review ordering and structural SFZ mapping'],'sfzPlayerPlayback':'not tested','humanListening':'not performed'}
(art/'independent-readback.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
