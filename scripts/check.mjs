import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const folder of ['src','web','scripts','tests'])for(const file of await readdir(folder)){if(file.endsWith('.mjs')){const p=`${folder}/${file}`,r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}}
for(const p of ['web/app.mjs','web/worker.mjs','src/engine.mjs']){const t=await readFile(p,'utf8');if(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage/.test(t))throw Error(`Unexpected network/persistent storage: ${p}`);}
console.log('Syntax and runtime no-network API scan passed');
