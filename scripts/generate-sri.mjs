import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
// HARDEN: pin SRI hashes for CDN fallback scripts. Hashes are computed from the
// npm-verified local copies (npm already validates them against package-lock),
// so the CDN payload must match our own supply chain or the browser refuses it.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const targets=[
{key:'three.min.js',pkg:'three',file:['three','build','three.min.js'],url:v=>`https://cdn.jsdelivr.net/npm/three@${v}/build/three.min.js`},
{key:'topojson-client.min.js',pkg:'topojson-client',file:['topojson-client','dist','topojson-client.min.js'],url:v=>`https://cdn.jsdelivr.net/npm/topojson-client@${v}/dist/topojson-client.min.js`}
];
const sri={};
for(const t of targets){
const buf=await fs.readFile(path.join(root,'node_modules',...t.file)).catch(()=>null);
if(!buf){console.error('[sri] Missing node_modules/'+t.file.join('/')+' — run `npm install` first.');process.exit(1);}
const pkg=JSON.parse(await fs.readFile(path.join(root,'node_modules',t.pkg,'package.json'),'utf8'));
sri[t.key]={url:t.url(pkg.version),integrity:'sha384-'+crypto.createHash('sha384').update(buf).digest('base64')};
}
await fs.mkdir(path.join(root,'public','vendor'),{recursive:true});
await fs.writeFile(path.join(root,'public','vendor','sri.json'),JSON.stringify(sri,null,2));
console.log('[sri] Manifest written to public/vendor/sri.json');
console.log(sri);