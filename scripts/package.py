"""Make a reproducible source ZIP and file SHA-256 manifest, without generated/dependency/private data."""
import hashlib,json,pathlib,zipfile
root=pathlib.Path(__file__).resolve().parents[1];out=root.parent/'take-kit-output';out.mkdir(exist_ok=True)
exclude={'node_modules','dist','output','artifacts','__pycache__','.git'}
files=sorted(p for p in root.rglob('*') if p.is_file() and not any(x in exclude for x in p.relative_to(root).parts) and p.suffix not in {'.tmp','.pyc'})
manifest={'project':'TakeKit','version':'0.1.0','files':[]}
for p in files:
    data=p.read_bytes();manifest['files'].append({'path':p.relative_to(root).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
archive=out/'take-kit-source.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in files:
        info=zipfile.ZipInfo('take-kit/'+p.relative_to(root).as_posix(),(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes())
manifest['archive']={'name':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(out/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(archive) as z: assert z.testzip() is None
print(json.dumps({'files':len(files),**manifest['archive']}))
