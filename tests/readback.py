"""Independent stdlib ZIP CRC, wave header/PCM and SFZ path readback."""
import hashlib,io,json,pathlib,subprocess,tempfile,wave,zipfile,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    p=pathlib.Path(temp)
    source_samples=[(i%17-8)*1100 for i in range(300)]
    with wave.open(str(p/'source.wav'),'wb') as w:
        w.setparams((2,2,8000,0,'NONE','not compressed'));w.writeframes(struct.pack('<'+'h'*len(source_samples),*source_samples))
    subprocess.run(['node','src/cli.mjs','analyze',str(p/'source.wav'),str(p/'review.json')],cwd=ROOT,check=True,capture_output=True)
    review=json.loads((p/'review.json').read_text());review['hits']=[dict(id='h0002',start=60,end=100,included=True,reviewed=True),dict(id='h0001',start=1,end=31,included=True,reviewed=True)];review['settings']['midiKey']=42
    (p/'review.json').write_text(json.dumps(review))
    subprocess.run(['node','src/cli.mjs','pack',str(p/'source.wav'),str(p/'review.json'),str(p/'pack.zip')],cwd=ROOT,check=True,capture_output=True)
    with zipfile.ZipFile(p/'pack.zip') as z:
        assert z.testzip() is None
        assert sorted(z.namelist())==['README.txt','instrument.sfz','manifest.json','samples/hit-001.wav','samples/hit-002.wav']
        manifest=json.loads(z.read('manifest.json'));sfz=z.read('instrument.sfz').decode()
        assert 'key=42 seq_length=2 loop_mode=one_shot' in sfz
        assert manifest['sourceSha256']==hashlib.sha256((p/'source.wav').read_bytes()).hexdigest()
        for i,hit in enumerate(manifest['hits'],1):
            raw=z.read(hit['path']);assert hashlib.sha256(raw).hexdigest()==hit['sha256']
            assert f'seq_position={i} sample={hit["path"]}' in sfz
            with wave.open(io.BytesIO(raw),'rb') as w:
                assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(2,2,8000,hit['end']-hit['start'])
                frames=w.readframes(w.getnframes());actual=list(struct.unpack('<'+'h'*(len(frames)//2),frames))
                assert actual==source_samples[hit['start']*2:hit['end']*2]
        assert all(i.date_time==(1980,1,1,0,0,0) for i in z.infolist())
print('PASS: independent Python wave/struct samples, ZIP CRC, safe paths, SHA-256 and SFZ mapping')
