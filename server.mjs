import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
// --- HARDEN: crash guards — the server logs and survives stray errors ---
process.on('unhandledRejection',err=>{console.error('[Chronosphere] unhandled rejection:',err?.stack||err);});
process.on('uncaughtException',err=>{console.error('[Chronosphere] uncaught exception:',err?.stack||err);});
const root=path.dirname(fileURLToPath(import.meta.url));
let places=[];
try{
places=JSON.parse(await fs.readFile(path.join(root,'data/index/places.json'),'utf8'));
if(!Array.isArray(places)) throw new Error('places.json must contain an array');
}catch(err){
console.warn('[Chronosphere] No generated GeoNames index. Run: npm run download:data && npm run build:index');
}
// --- SPECIAL GEOGRAPHIC LOCATIONS (ANTARCTICA & ARCTIC) ---
const specialLocations=[
{id:'amundsen-scott',name:'Amundsen-Scott South Pole Station',ascii:'Amundsen-Scott South Pole Station',region:'Antarctica',country:'Antarctica',countryCode:'AQ',latitude:-90,longitude:0,population:50,timezone:'Antarctica/South_Pole',aliases:['South Pole','Antarctica']},
{id:'mcmurdo',name:'McMurdo Station',ascii:'McMurdo Station',region:'Ross Dependency',country:'Antarctica',countryCode:'AQ',latitude:-77.8419,longitude:166.6863,population:200,timezone:'Antarctica/McMurdo',aliases:['McMurdo']},
{id:'palmer',name:'Palmer Station',ascii:'Palmer Station',region:'Antarctic Peninsula',country:'Antarctica',countryCode:'AQ',latitude:-64.7744,longitude:-64.0536,population:40,timezone:'Antarctica/Palmer',aliases:['Palmer']},
{id:'troll',name:'Troll Station',ascii:'Troll Station',region:'Queen Maud Land',country:'Antarctica',countryCode:'AQ',latitude:-72.0114,longitude:2.5350,population:35,timezone:'Antarctica/Troll',aliases:['Troll']},
{id:'north-pole',name:'North Pole',ascii:'North Pole',region:'Arctic Ocean',country:'International Waters',countryCode:'AQ',latitude:90,longitude:0,population:0,timezone:'UTC',aliases:['Arctic','North Pole']},
{id:'longyearbyen',name:'Longyearbyen',ascii:'Longyearbyen',region:'Svalbard',country:'Norway',countryCode:'NO',latitude:78.2232,longitude:15.6267,population:2400,timezone:'Arctic/Longyearbyen',aliases:['Svalbard','Spitsbergen']}
];
places.push(...specialLocations);
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const fields=x=>[x.name,x.ascii,x.region,x.country,...(x.aliases||[])].filter(Boolean);
function toLocation(x,extra={}){
return {
id:String(x.id),
name:String(x.name||''),
type:x.type||'city',
region:x.region||'',
country:x.country||'',
countryCode:x.countryCode||'',
latitude:Number(x.latitude),
longitude:Number(x.longitude),
timezone:String(x.timezone||''),
population:Number(x.population||0),
aliases:Array.isArray(x.aliases)?x.aliases:[],
...extra
};
}
const rank=(x,q)=>{
const n=norm(q), a=fields(x).map(norm);
let s=0;
if(norm(x.name)===n)s+=1200;
if(norm(x.ascii)===n)s+=1100;
if(norm(x.region)===n)s+=550;
if(norm(x.country)===n)s+=450;
if(a.some(v=>v.startsWith(n)))s+=280;
if(a.some(v=>v.includes(n)))s+=100;
const tokens=n.split(' ').filter(Boolean);
for(const token of tokens){if(a.some(v=>v===token))s+=55;else if(a.some(v=>v.startsWith(token)))s+=30;else if(a.some(v=>v.includes(token)))s+=12;}
return s+Math.min(Number(x.population||0)/100000,50);
};
const searchIndex=new Map();
const timezoneRepresentatives=new Map();
const CELL_DEGREES=2;
const geoCells=new Map();
const cellKey=(lat,lon)=>`${Math.floor((lat+90)/CELL_DEGREES)}:${Math.floor((lon+180)/CELL_DEGREES)}`;
for(const place of places){
const values=new Set(fields(place).map(norm).filter(Boolean));
for(const value of values){
const first=value.slice(0,2);
if(!searchIndex.has(first)) searchIndex.set(first,[]);
searchIndex.get(first).push(place);
}
const tz=String(place.timezone||'');
if(tz && (!timezoneRepresentatives.has(tz) || Number(place.population||0)>Number(timezoneRepresentatives.get(tz).population||0))){
timezoneRepresentatives.set(tz,place);
}
const lat=Number(place.latitude),lon=Number(place.longitude);
if(Number.isFinite(lat)&&Number.isFinite(lon)){
const k=cellKey(lat,lon);
if(!geoCells.has(k)) geoCells.set(k,[]);
geoCells.get(k).push(place);
}
}
function validTimezone(tz){
try{new Intl.DateTimeFormat('en-US',{timeZone:tz}).format();return true;}catch{return false;}
}
function canonicalTimezone(tz){
try{return new Intl.DateTimeFormat('en-US',{timeZone:tz}).resolvedOptions().timeZone||tz}catch{return tz}
}
function haversineKm(lat1,lon1,lat2,lon2){
const r=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
return 2*r*Math.asin(Math.min(1,Math.sqrt(a)));
}
function nearestPlace(lat,lon,timezone){
const tz=validTimezone(timezone||'')?canonicalTimezone(timezone):null;
const baseX=Math.floor((lat+90)/CELL_DEGREES),baseY=Math.floor((lon+180)/CELL_DEGREES);
let best=null,bestKm=Infinity,bestPreferred=null,bestPreferredKm=Infinity;
for(let radius=0;radius<=4;radius++){
for(let dx=-radius;dx<=radius;dx++){
for(let dy=-radius;dy<=radius;dy++){
if(Math.max(Math.abs(dx),Math.abs(dy))!==radius) continue;
const list=geoCells.get(`${baseX+dx}:${baseY+dy}`)||[];
for(const p of list){
const pLat=Number(p.latitude),pLon=Number(p.longitude);
const km=haversineKm(lat,lon,pLat,pLon);
if(km<bestKm){best=p;bestKm=km;}
if(tz && (p.timezone===tz||canonicalTimezone(p.timezone)===tz) && km<bestPreferredKm){bestPreferred=p;bestPreferredKm=km;}
}
}
}
}
if(bestPreferred) return {place:bestPreferred,distanceKm:bestPreferredKm,match:'geolocation'};
return best?{place:best,distanceKm:bestKm,match:'geolocation'}:null;
}
const rate=new Map();
const RATE_WINDOW=60_000;
const RATE_LIMIT=90;
function allowed(ip){
const now=Date.now();
let r=rate.get(ip);
if(!r||now-r.start>RATE_WINDOW){r={start:now,count:0};rate.set(ip,r);}
r.count++;
if(rate.size>2000){for(const [k,v] of rate)if(now-v.start>RATE_WINDOW)rate.delete(k);}
return r.count<=RATE_LIMIT;
}
const MIME={
'.html':'text/html; charset=utf-8',
'.js':'text/javascript; charset=utf-8',
'.css':'text/css; charset=utf-8',
'.json':'application/json; charset=utf-8',
'.topojson':'application/json; charset=utf-8',
'.svg':'image/svg+xml',
'.ico':'image/x-icon',
'.xml':'application/xml; charset=utf-8',
'.txt':'text/plain; charset=utf-8'
};
// --- HARDEN: HSTS + isolation headers added to the existing security set ---
const security={
'strict-transport-security':'max-age=63072000; includeSubDomains',
'cross-origin-resource-policy':'same-origin',
'cross-origin-opener-policy':'same-origin',
'x-content-type-options':'nosniff',
'x-frame-options':'DENY',
'referrer-policy':'strict-origin-when-cross-origin',
'permissions-policy':'geolocation=(self), camera=(), microphone=()',
'content-security-policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net https://raw.githubusercontent.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'"
};
const PAGES={'/privacy':'/privacy.html','/terms':'/terms.html','/about':'/about.html','/contact':'/contact.html'};
function sendJson(res,data,status=200,cache='no-store'){
const body=JSON.stringify(data);
res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':cache,...security,'vary':'Accept-Encoding'});
if(res.req?.method==='HEAD'){res.end();return;}
res.end(body);
}
async function sendFile(req,res,file){
try{
const stat=await fs.stat(file);
if(!stat.isFile())return sendJson(res,{error:'not found'},404);
const ext=path.extname(file).toLowerCase();
const type=MIME[ext]||'application/octet-stream';
const headers={'content-type':type,'content-length':String(stat.size),...security,'vary':'Accept-Encoding'};
if(file.includes(`${path.sep}geo${path.sep}`)||file.includes(`${path.sep}vendor${path.sep}`)){
headers['cache-control']='public, max-age=31536000, immutable';
}else headers['cache-control']='no-cache';
if(req.method==='HEAD'){res.writeHead(200,headers);res.end();return;}
if(/gzip/i.test(req.headers['accept-encoding']||'') && /^(text\/|application\/json)/.test(type)){
delete headers['content-length'];
headers['content-encoding']='gzip';
res.writeHead(200,headers);
await pipeline((await import('node:fs')).createReadStream(file),createGzip(),res);
}else{
res.writeHead(200,headers);
(await import('node:fs')).createReadStream(file).pipe(res);
}
}catch{sendJson(res,{error:'not found'},404);}
}
async function handleRequest(req,res){
const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0].trim();
const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
if(req.method!=='GET'&&req.method!=='HEAD')return sendJson(res,{error:'method not allowed'},405);
if(u.pathname==='/api/search'){
if(!allowed(ip))return sendJson(res,{error:'rate limit exceeded'},429,'public, max-age=10');
const query=u.searchParams.get('q')?.trim()||'';
if(query.length<2||query.length>80)return sendJson(res,{results:[]});
const n=norm(query),tokens=n.split(' ').filter(Boolean),bucket=tokens[0]?.slice(0,2)||'';
const candidates=searchIndex.get(bucket)||[];
const results=candidates.filter(x=>tokens.every(token=>fields(x).some(v=>norm(v).includes(token))))
.map(x=>({...x,score:rank(x,query)+tokens.length*25}))
.sort((a,b)=>b.score-a.score)
.slice(0,12)
.map(({score,...x})=>toLocation(x));
return sendJson(res,{results,source:'GeoNames indexed'},200,'public, max-age=30');
}
if(u.pathname==='/api/localize'){
if(!allowed(ip))return sendJson(res,{error:'rate limit exceeded'},429,'public, max-age=10');
const tzRaw=u.searchParams.get('timezone')?.trim()||'';
const tz=tzRaw?canonicalTimezone(tzRaw):'';
const lat=Number(u.searchParams.get('lat'));
const lon=Number(u.searchParams.get('lon'));
if(tzRaw && !validTimezone(tzRaw)) return sendJson(res,{error:'invalid timezone'},400);
let resolved=null;
if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180){
resolved=nearestPlace(lat,lon,tzRaw);
}
if(!resolved && tz){
const rep=timezoneRepresentatives.get(tz)||timezoneRepresentatives.get(tzRaw);
if(rep) resolved={place:rep,distanceKm:null,match:'timezone-reference'};
}
if(!resolved)return sendJson(res,{error:'location unavailable'},404);
const location=toLocation(resolved.place,{match:resolved.match,distanceKm:resolved.distanceKm});
return sendJson(res,{location,source:'GeoNames indexed'},200,'private, max-age=300');
}
if(u.pathname==='/api/health')return sendJson(res,{ok:true,places:places.length,version:'4.0.0'},200,'no-store');
let file=decodeURIComponent(u.pathname==='/'?'/index.html':(PAGES[u.pathname]||u.pathname));
if(u.pathname==='/learn')file='/learn.html';
else if(u.pathname.startsWith('/learn/'))file='/learn/'+u.pathname.slice(7).replace(/[^a-z0-9-]/gi,'')+'.html';
if(file==='/favicon.ico')file='/favicon.svg';
const publicRoot=path.resolve(root,'public');
const target=path.resolve(publicRoot,'.'+file);
if(target!==publicRoot && !target.startsWith(publicRoot+path.sep))return sendJson(res,{error:'bad path'},400);
await sendFile(req,res,target);
}
// --- HARDEN: per-request error wrapper — a bad request can never kill the server ---
const server=http.createServer((req,res)=>{
handleRequest(req,res).catch(err=>{
console.error('[Chronosphere] request error:',err?.stack||err);
if(!res.headersSent)sendJson(res,{error:'internal error'},500);else res.end();
});
});
const port=Number(process.env.PORT||3000);
server.listen(port,()=>console.log(`Chronosphere V4.0.0 running on http://localhost:${port}`));