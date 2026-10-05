import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';

const base='https://download.geonames.org/export/dump/';
const files=['cities500.zip','countryInfo.txt','admin1CodesASCII.txt','alternateNamesV2.zip'];
await fs.mkdir('data',{recursive:true});

for(const file of files){
  const res=await fetch(base+file);
  if(!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const out=`data/${file}`;
  await pipeline(res.body,createWriteStream(out));
  console.log('downloaded',file);
  if(file.endsWith('.zip')){
    await new Promise((resolve,reject)=>createReadStream(out).pipe(unzipper.Extract({path:'data'})).on('close',resolve).on('error',reject));
  }
}
console.log('GeoNames source files installed (cities500 + country/admin metadata).');
