import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const name of ['index.html','styles.css','app.mjs','worker.mjs'])await copyFile(`web/${name}`,`dist/${name}`);
await copyFile('src/engine.mjs','dist/engine.mjs');
console.log('Built local static application: dist/');
