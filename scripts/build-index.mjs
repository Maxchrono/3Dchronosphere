import fs from 'node:fs';
import fsp from 'node:fs/promises';
import readline from 'node:readline';
import unzipper from 'unzipper';

const norm = s => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const cityFile='data/cities500.txt';
const countryFile='data/countryInfo.txt';
const adminFile='data/admin1CodesASCII.txt';
const altZip='data/alternateNamesV2.zip';

const countries=new Map();
const admins=new Map();
for (const line of (await fsp.readFile(countryFile,'utf8')).split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const p=line.split('\t');
  if (p.length>=18) countries.set(p[0], {name:p[4], code:p[0]});
}
for (const line of (await fsp.readFile(adminFile,'utf8')).split(/\r?\n/)) {
  if (!line) continue;
  const p=line.split('\t');
  if (p.length>=2) admins.set(p[0],p[1]);
}

await fsp.mkdir('data/index',{recursive:true});
const outPath='data/index/places.json';
const out=fs.createWriteStream(outPath,{encoding:'utf8'});
out.write('[');
let first=true, count=0;
const cityIds=new Set();

const rl=readline.createInterface({input:fs.createReadStream(cityFile),crlfDelay:Infinity});
for await (const line of rl) {
  if (!line) continue;
  const p=line.split('\t');
  if (p.length<18) continue;
  const id=p[0], name=p[1], ascii=p[2], lat=Number(p[4]), lon=Number(p[5]);
  const countryCode=p[8], admin1=p[10], pop=Number(p[14])||0, timezone=p[17];
  cityIds.add(id);
  const record={id,name,ascii,normalized:norm(name),country:countries.get(countryCode)?.name||countryCode,countryCode,region:admins.get(`${countryCode}.${admin1}`)||'',latitude:lat,longitude:lon,population:pop,timezone,aliases:[]};
  if(!first) out.write(',');
  out.write(JSON.stringify(record)); first=false; count++;
  if(count%10000===0) console.log(`Indexed ${count} places...`);
}
out.write(']');
await new Promise((resolve,reject)=>{out.end(resolve);out.on('error',reject)});

// Build a compact alternate-name index. We only keep useful human search variants
// for places already present in cities500, avoiding the previous heap-heavy approach.
const places=JSON.parse(await fsp.readFile(outPath,'utf8'));
const byId=new Map(places.map(p=>[p.id,p]));
let aliasCount=0;
const dir=await unzipper.Open.file(altZip);
const entry=dir.files.find(f=>f.path==='alternateNamesV2.txt');
if(!entry) throw new Error('alternateNamesV2.txt not found in alternateNamesV2.zip');
const input=entry.stream();
const arl=readline.createInterface({input,crlfDelay:Infinity});
for await (const line of arl) {
  if(!line) continue;
  const p=line.split('\t');
  if(p.length<4) continue;
  const geonameId=p[1];
  const place=byId.get(geonameId);
  if(!place) continue;
  const lang=p[2]||'';
  const alt=(p[3]||'').trim();
  if(!alt || alt.length<2) continue;
  // Keep names useful for user search; exclude machine identifiers, postal codes and URLs.
  const useful = lang==='en' || lang==='abbr' || lang==='fr_1793' || p[4]==='1' || p[5]==='1' || p[6]==='1' || p[7]==='1';
  if(!useful) continue;
  const n=norm(alt), main=norm(place.name), ascii=norm(place.ascii);
  if(!n || n===main || n===ascii) continue;
  if(!place.aliases.includes(alt)) { place.aliases.push(alt); aliasCount++; }
}

await fsp.writeFile(outPath,JSON.stringify(places));
await fsp.writeFile('data/index/meta.json', JSON.stringify({source:'GeoNames',dataset:'cities500 + alternateNamesV2',generatedAt:new Date().toISOString(),count,aliasCount,countryCount:countries.size},null,2));
console.log(`Indexed ${count} global populated places with ${aliasCount} search aliases.`);
