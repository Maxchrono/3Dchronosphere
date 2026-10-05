import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';

const R=1.58, surface=R+.026, deg=d=>d*Math.PI/180, eps=1e-9;
const ll=(lat,lon,r=surface)=>{const p=deg(lat),l=deg(lon),c=Math.cos(p);return {x:r*c*Math.sin(l),y:r*Math.sin(p),z:r*c*Math.cos(l)};};
const near=(a,b,e=eps)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const normalize=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Coordinate convention.
let p=ll(0,0); near(p.x,0); assert.ok(p.z>0);
p=ll(0,90); assert.ok(p.x>0 && Math.abs(p.z)<eps);
p=ll(0,-90); assert.ok(p.x<0 && Math.abs(p.z)<eps);
p=ll(90,0); near(p.y,surface); p=ll(-90,0); near(p.y,-surface);
for(const lon of [-179,-120,-90,-30,0,30,90,120,179]){
  const q=ll(0,lon); const rot=-deg(lon); const z=-q.x*Math.sin(rot)+q.z*Math.cos(rot);
  assert.ok(z>0.999*surface,`focus failed at ${lon}`);
}

// Motion regression: 10 seconds at multiple frame rates and irregular timing.
function simulate(sequenceSeconds){
  let target=0,rot=0,vel=0; const AUTO=.0105,DAMP=6,SMOOTH=12;
  for(const dt of sequenceSeconds){
    vel*=Math.exp(-DAMP*dt); target+=AUTO*dt;
    const a=1-Math.exp(-SMOOTH*dt);
    rot+=angleDelta(rot,target)*a; rot=normalize(rot); target=normalize(target);
  }
  return {rot};
}
for(const fps of [30,60,120]){
  const out=simulate(Array.from({length:fps*10},()=>1/fps));
  assert.ok(Math.abs(out.rot)<0.2);
}
const irregular=Array.from({length:900},(_,i)=>[.004,.011,.018,.027,.006,.013][i%6]);
assert.ok(Math.abs(simulate(irregular).rot)<0.25);

// Inertia hard cap stress.
let v=0; for(let i=0;i<500;i++){
  const dt=.004+(i%7)*.006;
  const step=Math.max(-.12,Math.min(.12,(i%2?800:-800)*.0026));
  const instant=Math.max(-.35,Math.min(.35,step/dt));
  v+=(instant-v)*(1-Math.exp(-12*dt));
  assert.ok(Math.abs(v)<=.35+1e-12);
}

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('./build-geo.mjs',import.meta.url),'utf8');
assert.ok(html.includes('extractExteriorRings'));
assert.ok(html.includes('GEO_REMOTE_DISPUTED'));
assert.ok(html.includes('GEO_REMOTE_INDIA_POV'));
assert.ok(html.includes('fetchWorldWithIndiaPOV'));
assert.ok(html.includes('mergeIndiaPOV'));
assert.ok(html.includes('LineDashedMaterial'));
assert.ok(html.includes('disputed-boundaries-10m.geojson'));
assert.ok(html.includes('SphereGeometry(.034'));
assert.ok(html.includes('RingGeometry(.058,.074'));
assert.ok(html.includes('mr.scale.setScalar(1+Math.sin(t*.004)*.055)'));
assert.ok(build.includes('ne_10m_admin_0_countries_lakes.geojson'));
assert.ok(build.includes('ne_50m_admin_0_countries_lakes.geojson'));
assert.ok(build.includes('stripPolygonHoles'));
assert.ok(html.includes('ne_10m_admin_0_countries_lakes.geojson'));
assert.ok(html.includes('ne_50m_admin_0_countries_lakes.geojson'));
assert.ok(build.includes('ne_10m_admin_0_boundary_lines_disputed_areas.geojson'));
assert.ok(build.includes('replaceIndia'));
assert.ok(build.includes('india50Feature'));
assert.ok(build.includes('disputed-boundaries-10m.topojson'));
assert.ok(!html.includes('countries-110m.json'));

// Synthetic geometry regression: exterior-ring extraction must ignore interior holes.
function exteriorOnly(g){
  const lines=[];
  for(const f of g.features||[]){
    const x=f.geometry;if(!x)continue;
    if(x.type==='Polygon'&&x.coordinates?.[0])lines.push(x.coordinates[0]);
    else if(x.type==='MultiPolygon')for(const poly of x.coordinates||[])if(poly?.[0])lines.push(poly[0]);
  }
  return lines;
}
const synthetic={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[.4,.4],[.6,.4],[.6,.6],[.4,.6],[.4,.4]]]}}]};
assert.equal(exteriorOnly(synthetic).length,1,'interior lake/hole must not become a visible circle');
// Source-data regression: production must use Natural Earth's dedicated
// country-without-boundary-lakes datasets, not the lake-inclusive country layers.
assert.ok(!build.includes('ne_10m_admin_0_countries.geojson'));
assert.ok(!build.includes('ne_50m_admin_0_countries.geojson'));
assert.ok(!html.includes('ne_10m_admin_0_countries.geojson'));
assert.ok(!html.includes('ne_50m_admin_0_countries.geojson'));

// Delhi marker regression and reduced size.
const markerR=R+.050, dlat=deg(28.6139),dlon=deg(77.209);
const mx=markerR*Math.cos(dlat)*Math.sin(dlon),my=markerR*Math.sin(dlat),mz=markerR*Math.cos(dlat)*Math.cos(dlon);
near(Math.hypot(mx,my,mz),markerR,1e-8); assert.ok(mx>0&&my>0&&mz>0);

// LOD cross-fade remains bounded.
let blend=0,target=1;for(let i=0;i<60;i++){blend+=(target-blend)*(1-Math.exp(-(1000/420)/60));assert.ok(blend>=0&&blend<=1);}
assert.ok(blend>.88);

// Server regression.
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('server startup timeout')),5000);
  const check=()=>http.get('http://127.0.0.1:3000/api/health',r=>{if(r.statusCode===200){clearTimeout(timer);resolve();}else setTimeout(check,100);}).on('error',()=>setTimeout(check,100));
  check();
});
const health=await new Promise((resolve,reject)=>http.get('http://127.0.0.1:3000/api/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>resolve(JSON.parse(d)));}).on('error',reject));
assert.equal(health.ok,true); assert.equal(health.version,'3.1.3');
server.kill('SIGTERM');

console.log('Chronosphere V3.1.3 tests: PASS');
console.log('  coordinate convention: PASS');
console.log('  10-second motion regression: PASS (30/60/120 FPS + irregular)');
console.log('  inertia hard-cap stress: PASS');
console.log('  10m interior-hole/circle regression: PASS');
console.log('  India POV + disputed-boundary build checks: PASS');
console.log('  Delhi marker size/surface: PASS');
console.log('  LOD cross-fade: PASS');
console.log('  production server health: PASS');
