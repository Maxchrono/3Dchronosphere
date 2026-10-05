import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// FIX (Node 24 ESM interop): CommonJS packages -> default import + destructure.
import topojsonServer from 'topojson-server';
import topojsonSimplify from 'topojson-simplify';
import topojsonClient from 'topojson-client';
// TopoJSON v3 API map (verified against package-lock bins):
//   topojson-server   -> topology
//   topojson-simplify -> presimplify / simplify
//   topojson-client   -> feature / quantize  (topoquantize CLI lives here)
const { topology } = topojsonServer;
const { presimplify, simplify } = topojsonSimplify;
const { quantize } = topojsonClient;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'public','geo');
await fs.mkdir(out,{recursive:true});
// One authoritative worldview is used for India at both LODs. Natural Earth
// publishes POV variants specifically for countries with a defined legal/worldview
// policy. The rest of the world remains on Natural Earth's default de-facto theme.
const source50='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries_lakes.geojson';
const source10='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_lakes.geojson';
const sourceIndiaPov='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson';
const sourceDisputed='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_boundary_lines_disputed_areas.geojson';
async function getJson(url){
const r=await fetch(url,{redirect:'follow'});
if(!r.ok)throw new Error(`${url} -> HTTP ${r.status}`);
return r.json();
}
const [geo50Raw,geo10Raw,indiaPovWorld,disputed]=await Promise.all([
getJson(source50),getJson(source10),getJson(sourceIndiaPov),getJson(sourceDisputed)
]);
const isIndia=f=>{
const p=f?.properties||{};
return p.ADM0_A3==='IND'||p.ISO_A3==='IND'||p.ISO_A3_EH==='IND'||p.ADMIN==='India';
};
const indiaFeature=(indiaPovWorld.features||[]).find(isIndia);
if(!indiaFeature)throw new Error('India POV feature was not found in Natural Earth POV dataset');
// Sanitizer: keep only rings that are arrays of 4+ finite [lon,lat] positions.
// This guarantees the TopoJSON encoder can never receive degenerate rings.
const validRing=r=>Array.isArray(r)&&r.length>3&&r.every(pt=>Array.isArray(pt)&&pt.length>1&&Number.isFinite(pt[0])&&Number.isFinite(pt[1]));
function stripPolygonHoles(data){
const cleanGeometry=g=>{
if(!g)return g;
if(g.type==='Polygon')return {...g,coordinates:validRing(g.coordinates?.[0])?[g.coordinates[0]]:[]};
if(g.type==='MultiPolygon')return {...g,coordinates:(g.coordinates||[]).map(poly=>validRing(poly?.[0])?[poly[0]]:null).filter(Boolean)};
return g;
};
return {...data,features:(data.features||[]).map(f=>({...f,geometry:cleanGeometry(f.geometry)}))};
}
function replaceIndia(base){
const cleanIndia=stripPolygonHoles({type:'FeatureCollection',features:[indiaFeature]}).features[0];
const features=(base.features||[]).filter(f=>!isIndia(f));
features.push(cleanIndia);
return {...base,features};
}
const geo50=replaceIndia(geo50Raw);
const geo10=replaceIndia(geo10Raw);
const countryKey=f=>{
const p=f?.properties||{};
return p.ADM0_A3_EH || p.ADM0_A3 || p.SOV_A3 || p.ISO_A3_EH || p.ISO_A3 || p.ADMIN || p.NAME;
};
// Natural Earth classifies a handful of micro-territories, reefs, rocks and
// indeterminate zones as "country" units in the 10m dataset, while the 50m
// dataset intentionally omits them. They are NOT sovereign countries and must
// not fail the LOD identity check. Verified micro-codes only.
const MICRO_IGNORE=new Set(['ESB','USG','BRI','GIB','CNM','KAB','WSB','SPI','BRT','UMI','CSI','PGA','CLP','BJN','SER','SCR']);
const isRealCountry=f=>{
const p=f?.properties||{};
if(MICRO_IGNORE.has(String(countryKey(f))))return false;
if(p.featurecla)return p.featurecla==='Admin-0 country';
return p.type==='Sovereign country'||p.type==='Country';
};
const keys50=new Set((geo50.features||[]).filter(isRealCountry).map(countryKey));
const keys10=new Set((geo10.features||[]).filter(isRealCountry).map(countryKey));
const missingIn10=[...keys50].filter(k=>!keys10.has(k));
const missingIn50=[...keys10].filter(k=>!keys50.has(k));
if(missingIn10.length||missingIn50.length){
throw new Error(`LOD country identity mismatch. Missing in 10m: ${missingIn10.join(',')}; missing in 50m: ${missingIn50.join(',')}`);
}
const ignoredFound=[...new Set((geo10.features||[]).map(countryKey).filter(k=>MICRO_IGNORE.has(String(k))))];
console.log(`LOD identity check: ${keys50.size} sovereign countries matched between 50m and 10m. Ignored micro-features: ${ignoredFound.join(',')||'none'}`);
// FIX (single-pass topology): build ONE topology per layer from clean GeoJSON,
// then quantize + presimplify + simplify. Never re-topologize simplified output.
let topo50=topology({countries:geo50});
topo50=quantize(topo50,1e5);
topo50=simplify(presimplify(topo50),0.00005);
await fs.writeFile(path.join(out,'world-50m.topojson'),JSON.stringify(topo50));
let topo10=topology({countries:geo10});
topo10=quantize(topo10,1e5);
topo10=simplify(presimplify(topo10),0.000001);
await fs.writeFile(path.join(out,'world-10m.topojson'),JSON.stringify(topo10));
// Keep disputed boundaries as a small independent layer. This avoids silently
// converting politically disputed lines into ordinary country borders.
const disputedTopo=topology({disputed});
const disputedFinal=simplify(presimplify(quantize(disputedTopo,1e5)),0.000001);
await fs.writeFile(path.join(out,'disputed-boundaries-10m.topojson'),JSON.stringify(disputedFinal));
// Also emit GeoJSON for the runtime development fallback path.
await fs.writeFile(path.join(out,'disputed-boundaries-10m.geojson'),JSON.stringify(disputed));
const manifest={
version:'5.1.1',
boundaryPolicy:'Natural Earth default de-facto boundaries without boundary lakes, with Natural Earth India POV geometry for India and a separate disputed-boundary overlay',
worldview:'India POV for India; Natural Earth default de-facto elsewhere',
generatedAt:new Date().toISOString(),
assets:{world50:'/geo/world-50m.topojson',world10:'/geo/world-10m.topojson',disputed:'/geo/disputed-boundaries-10m.topojson'},
sources:{world50:source50,world10:source10,indiaPov:sourceIndiaPov,disputed:sourceDisputed}
};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('Geo build complete:',manifest.assets);