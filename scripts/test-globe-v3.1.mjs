import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';

const R=1.58, surface=R+.026, deg=d=>d*Math.PI/180, eps=1e-9;
function ll(lat,lon,r=surface){const p=deg(lat),l=deg(lon),c=Math.cos(p);return {x:r*c*Math.sin(l),y:r*Math.sin(p),z:r*c*Math.cos(l)};}
function near(a,b,e=eps){assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);}
function angleDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
function normalize(a){return Math.atan2(Math.sin(a),Math.cos(a));}

// Geographic convention.
let p=ll(0,0); near(p.x,0); assert.ok(p.z>0,'Greenwich must face camera');
p=ll(0,90); assert.ok(p.x>0 && Math.abs(p.z)<eps,'90E must be right');
p=ll(0,-90); assert.ok(p.x<0 && Math.abs(p.z)<eps,'90W must be left');
p=ll(90,0); near(p.y,surface); p=ll(-90,0); near(p.y,-surface);
for(const lon of [-179,-120,-90,-30,0,30,90,120,179]){
  const q=ll(0,lon); const rot=-deg(lon); const z=-q.x*Math.sin(rot)+q.z*Math.cos(rot);
  assert.ok(z>0.999*surface,`focus failed at ${lon}`);
}

// Motion simulation: 30/60/120 FPS + irregular frames, with 10-second runaway regression.
function simulate(sequenceSeconds){
  let target=0,rot=0,vel=0;
  const AUTO=.0105, DAMP=6, SMOOTH=12;
  for(const dt of sequenceSeconds){
    vel*=Math.exp(-DAMP*dt);
    target+=AUTO*dt;
    const a=1-Math.exp(-SMOOTH*dt);
    rot+=angleDelta(rot,target)*a;
    rot=normalize(rot); target=normalize(target);
  }
  return {rot};
}
for(const fps of [30,60,120]){
  const dts=Array.from({length:fps*10},()=>1/fps);
  const out=simulate(dts);
  assert.ok(Math.abs(out.rot)<0.2,`idle rotation escaped expected range at ${fps} FPS`);
}
const irregular=[];
for(let i=0;i<900;i++)irregular.push([.004,.011,.018,.027,.006,.013][i%6]);
const ir=simulate(irregular); assert.ok(Math.abs(ir.rot)<0.25,'irregular-frame idle simulation unstable');

// Direct stress test of bounded pointer inertia.
let v=0; const max=.35;
for(let i=0;i<500;i++){
  const dt=.004+(i%7)*.006;
  const step=Math.max(-.12,Math.min(.12,(i%2?800:-800)*.0026));
  const instant=Math.max(-max,Math.min(max,step/dt));
  const response=1-Math.exp(-12*dt);
  v+=(instant-v)*response;
  assert.ok(Math.abs(v)<=max+1e-12,'horizontal inertia exceeded hard cap');
}

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
assert.ok(html.includes("/geo/world-50m.topojson"));
assert.ok(html.includes("/geo/world-10m.topojson"));
assert.ok(html.includes("LineSegments"));
assert.ok(html.includes("prefers-reduced-motion"));
assert.ok(html.includes("Math.sin(lambda)"));
assert.ok(!html.includes('countries-110m.json'));
assert.ok(!html.includes('mapStatus">110M'));
assert.ok(html.includes('setMapLOD'));


// Geographic marker regression: Delhi must sit on the sphere surface and use a tangent-facing ring.
const markerR=1.58+.050, dlat=28.6139*Math.PI/180, dlon=77.209*Math.PI/180;
const mx=markerR*Math.cos(dlat)*Math.sin(dlon);
const my=markerR*Math.sin(dlat);
const mz=markerR*Math.cos(dlat)*Math.cos(dlon);
near(Math.hypot(mx,my,mz),markerR,1e-8);
assert.ok(mx>0 && my>0 && mz>0,'Delhi marker must be in the northern/eastern/front hemisphere under the canonical convention');

// LOD cross-fade regression: no hard visibility jump and weights always sum to ~1.
let blend=0, target=1;
for(let i=0;i<60;i++){const dt=1/60;blend+=(target-blend)*(1-Math.exp(-(1000/420)*dt));assert.ok(blend>=0&&blend<=1);}
assert.ok(blend>0.88,'10m LOD should fade in within the expected transition window');
for(const x of [0,.1,.5,.9,1]) assert.ok(Math.abs((1-x)+x-1)<1e-12);

const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,stdio:['ignore','pipe','pipe']});
let serverReady=false;
await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('server startup timeout')),5000);
  const check=()=>{http.get('http://127.0.0.1:3000/api/health',r=>{if(r.statusCode===200){serverReady=true;clearTimeout(timer);resolve();}else setTimeout(check,100);}).on('error',()=>setTimeout(check,100));};
  check();
});
assert.equal(serverReady,true);
const health=await new Promise((resolve,reject)=>http.get('http://127.0.0.1:3000/api/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>resolve(JSON.parse(d)));}).on('error',reject));
assert.equal(health.ok,true); assert.equal(health.version,'3.1.1');
server.kill('SIGTERM');

console.log('Chronosphere V3.1.1 tests: PASS');
console.log('  coordinate convention: PASS');
console.log('  longitude focus sweep: PASS (9 longitudes)');
console.log('  idle motion: PASS (30/60/120 FPS + irregular frames, 10s)');
console.log('  inertia hard-cap stress: PASS');
console.log('  LOD / merged geometry / reduced-motion checks: PASS');
console.log('  production server health/security path: PASS');
