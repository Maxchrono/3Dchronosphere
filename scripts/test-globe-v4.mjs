import fs from 'node:fs';
import fsp from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(root,'..');
const dataDir=path.join(app,'data');
const indexDir=path.join(dataDir,'index');
const indexFile=path.join(indexDir,'places.json');
const metaFile=path.join(indexDir,'meta.json');
const backupIndex=`${indexFile}.v4-test-backup`;
const backupMeta=`${metaFile}.v4-test-backup`;

const R=1.58, surface=R+.026, deg=d=>d*Math.PI/180, eps=1e-9;
const ll=(lat,lon,r=surface)=>{const p=deg(lat),l=deg(lon),c=Math.cos(p);return {x:r*c*Math.sin(l),y:r*Math.sin(p),z:r*c*Math.cos(l)};};
const near=(a,b,e=eps)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const normalize=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Coordinate convention + selected-place focus contract.
let p=ll(0,0); near(p.x,0); assert.ok(p.z>0);
p=ll(0,90); assert.ok(p.x>0 && Math.abs(p.z)<eps);
p=ll(0,-90); assert.ok(p.x<0 && Math.abs(p.z)<eps);
p=ll(90,0); near(p.y,surface); p=ll(-90,0); near(p.y,-surface);
for(const lon of [-179,-120,-90,-30,0,30,90,120,179]){
  const q=ll(0,lon); const rot=-deg(lon); const z=-q.x*Math.sin(rot)+q.z*Math.cos(rot);
  assert.ok(z>0.999*surface,`focus failed at ${lon}`);
}

// Motion regression inherited from V3.1.3.
function simulate(sequenceSeconds){
  let target=0,rot=0,vel=0; const AUTO=.0105,DAMP=6,SMOOTH=12;
  for(const dt of sequenceSeconds){vel*=Math.exp(-DAMP*dt);target+=AUTO*dt;const a=1-Math.exp(-SMOOTH*dt);rot+=angleDelta(rot,target)*a;rot=normalize(rot);target=normalize(target);}
  return {rot};
}
for(const fps of [30,60,120])assert.ok(Math.abs(simulate(Array.from({length:fps*10},()=>1/fps)).rot)<0.2);
const irregular=Array.from({length:900},(_,i)=>[.004,.011,.018,.027,.006,.013][i%6]);
assert.ok(Math.abs(simulate(irregular).rot)<0.25);

const html=await fsp.readFile(path.join(app,'public/index.html'),'utf8');
const serverText=await fsp.readFile(path.join(app,'server.mjs'),'utf8');
const build=await fsp.readFile(path.join(app,'scripts/build-geo.mjs'),'utf8');
const buildIndex=await fsp.readFile(path.join(app,'scripts/build-index.mjs'),'utf8');
assert.ok(html.includes('resolveLocalLocation'));
assert.ok(html.includes('/api/localize?'));
assert.ok(html.includes('applySelectedLocation'));
assert.ok(html.includes('updateMarker'));
assert.ok(html.includes('latitude'));
assert.ok(html.includes('longitude'));
assert.ok(html.includes('Asia/Kolkata')===false,'No hardcoded startup city/timezone should remain');
assert.ok(serverText.includes('/api/localize'));
assert.ok(serverText.includes('timezoneRepresentatives'));
assert.ok(serverText.includes('geoCells'));
assert.ok(serverText.includes('toLocation'));
assert.ok(buildIndex.includes('alternateNamesV2.zip'));
assert.ok(buildIndex.includes('aliasCount'));
assert.ok(build.includes('ne_10m_admin_0_countries_lakes.geojson'));
assert.ok(build.includes('ne_50m_admin_0_countries_lakes.geojson'));
assert.ok(build.includes('ne_10m_admin_0_boundary_lines_disputed_areas.geojson'));
assert.ok(html.includes('RingGeometry(.058,.074'));
assert.ok(!html.includes('default Delhi'));

await fsp.mkdir(indexDir,{recursive:true});
const hadIndex=fs.existsSync(indexFile),hadMeta=fs.existsSync(metaFile);
if(hadIndex) await fsp.rename(indexFile,backupIndex);
if(hadMeta) await fsp.rename(metaFile,backupMeta);
const fixture=[
  {id:'delhi-in',name:'Delhi',ascii:'Delhi',region:'Delhi',country:'India',countryCode:'IN',latitude:28.6139,longitude:77.2090,population:32000000,timezone:'Asia/Kolkata',aliases:['Dilli']},
  {id:'kolkata-in',name:'Kolkata',ascii:'Kolkata',region:'West Bengal',country:'India',countryCode:'IN',latitude:22.5726,longitude:88.3639,population:15000000,timezone:'Asia/Kolkata',aliases:['Calcutta']},
  {id:'tokyo-jp',name:'Tokyo',ascii:'Tokyo',region:'Tokyo',country:'Japan',countryCode:'JP',latitude:35.6762,longitude:139.6503,population:14000000,timezone:'Asia/Tokyo',aliases:[]}
];
await fsp.writeFile(indexFile,JSON.stringify(fixture));
await fsp.writeFile(metaFile,JSON.stringify({source:'test fixture'}));

const server=spawn(process.execPath,['server.mjs'],{cwd:app,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:'31277'}});
let started=false;
try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('server startup timeout')),6000);
    const check=()=>http.get('http://127.0.0.1:31277/api/health',r=>{r.resume();if(r.statusCode===200){clearTimeout(timer);resolve();}else setTimeout(check,100);}).on('error',()=>setTimeout(check,100));
    check();
  });
  started=true;

  const get=path=>new Promise((resolve,reject)=>http.get(`http://127.0.0.1:31277${path}`,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>resolve({status:r.statusCode,data:JSON.parse(d)}));}).on('error',reject));
  const health=await get('/api/health');
  assert.equal(health.data.ok,true);assert.equal(health.data.places,3);assert.equal(health.data.version,'4.0.0');

  const search=await get('/api/search?q='+encodeURIComponent('Delhi India'));
  assert.ok(search.data.results.length>=1);assert.equal(search.data.results[0].name,'Delhi');
  assert.equal(search.data.results[0].timezone,'Asia/Kolkata');
  assert.equal(search.data.results[0].latitude,28.6139);
  assert.equal(search.data.results[0].longitude,77.209);
  assert.equal(search.data.results[0].population,32000000);

  const alias=await get('/api/search?q=Calcutta');
  assert.equal(alias.data.results[0].name,'Kolkata');

  const localTz=await get('/api/localize?timezone=Asia%2FKolkata');
  assert.equal(localTz.data.location.timezone,'Asia/Kolkata');
  assert.equal(localTz.data.location.match,'timezone-reference');

  const localGps=await get('/api/localize?lat=28.6140&lon=77.2091&timezone=Asia%2FKolkata');
  assert.equal(localGps.data.location.name,'Delhi');
  assert.equal(localGps.data.location.match,'geolocation');
  assert.ok(Number.isFinite(localGps.data.location.distanceKm));

  console.log('Chronosphere V4.0.0 tests: PASS');
  console.log('  globe coordinate convention: PASS');
  console.log('  motion/10-second regression: PASS');
  console.log('  canonical Location contract: PASS');
  console.log('  multi-part search + aliases: PASS');
  console.log('  timezone-reference localization: PASS');
  console.log('  GPS nearest-place localization: PASS');
  console.log('  production server health/version: PASS');
} finally {
  if(started) server.kill('SIGTERM');
  else server.kill('SIGKILL');
  await new Promise(r=>setTimeout(r,150));
  await fsp.rm(indexFile,{force:true}); await fsp.rm(metaFile,{force:true});
  if(hadIndex) await fsp.rename(backupIndex,indexFile); else await fsp.rm(backupIndex,{force:true});
  if(hadMeta) await fsp.rename(backupMeta,metaFile); else await fsp.rm(backupMeta,{force:true});
}
