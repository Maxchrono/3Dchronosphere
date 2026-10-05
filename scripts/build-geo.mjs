import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import topojsonServer from 'topojson-server';
import topojsonSimplify from 'topojson-simplify';
import topojsonClient from 'topojson-client';

const { topology, quantize } = topojsonServer;
const { simplify } = topojsonSimplify;
const { feature } = topojsonClient;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'geo');
await fs.mkdir(out, {recursive: true});

const source50 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries_lakes.geojson';
const source10 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_lakes.geojson';
const sourceIndiaPov = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson';
const sourceDisputed = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_boundary_lines_disputed_areas.geojson';

async function getJson(url) {
  const r = await fetch(url, {redirect: 'follow'});
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

const [geo50Raw, geo10Raw, indiaPovWorld, disputed] = await Promise.all([
  getJson(source50), getJson(source10), getJson(sourceIndiaPov), getJson(sourceDisputed)
]);

const isIndia = f => {
  const p = f?.properties || {};
  return p.ADM0_A3 === 'IND' || p.ISO_A3 === 'IND' || p.ISO_A3_EH === 'IND' || p.ADMIN === 'India';
};

const indiaFeature = (indiaPovWorld.features || []).find(isIndia);
if (!indiaFeature) throw new Error('India POV feature not found');

function stripPolygonHoles(data) {
  const cleanGeometry = g => {
    if (!g) return g;
    if (g.type === 'Polygon') return {...g, coordinates: g.coordinates?.length ? [g.coordinates[0]] : []};
    if (g.type === 'MultiPolygon') return {...g, coordinates: (g.coordinates || []).map(poly => poly?.length ? [poly[0]] : []).filter(Boolean)};
    return g;
  };
  return {...data, features: (data.features || []).map(f => ({...f, geometry: cleanGeometry(f.geometry)}))};
}

function replaceIndia(base) {
  const cleanIndia = stripPolygonHoles({type: 'FeatureCollection', features: [indiaFeature]}).features[0];
  const features = (base.features || []).filter(f => !isIndia(f));
  features.push(cleanIndia);
  return {...base, features};
}

const geo50 = replaceIndia(geo50Raw);
const geo10 = replaceIndia(geo10Raw);

const countryKey = f => {
  const p = f?.properties || {};
  return p.ADM0_A3_EH || p.ADM0_A3 || p.SOV_A3 || p.ISO_A3_EH || p.ISO_A3 || p.ADMIN || p.NAME;
};

const MICRO_IGNORE = new Set(['ESB','USG','BRI','GIB','CNM','KAB','WSB','SPI','BRT','UMI','CSI','PGA','CLP','BJN','SER','SCR']);
const isRealCountry = f => {
  const p = f?.properties || {};
  if (MICRO_IGNORE.has(String(countryKey(f)))) return false;
  if (p.featurecla) return p.featurecla === 'Admin-0 country';
  return p.type === 'Sovereign country' || p.type === 'Country';
};

const keys50 = new Set((geo50.features || []).filter(isRealCountry).map(countryKey));
const keys10 = new Set((geo10.features || []).filter(isRealCountry).map(countryKey));
const missingIn10 = [...keys50].filter(k => !keys10.has(k));
const missingIn50 = [...keys10].filter(k => !keys50.has(k));

if (missingIn10.length || missingIn50.length) {
  throw new Error(`LOD mismatch. Missing in 10m: ${missingIn10.join(',')}; missing in 50m: ${missingIn50.join(',')}`);
}

console.log(`LOD check: ${keys50.size} countries matched.`);

// Build 50m
const base50 = topology({countries: geo50Raw});
const india50Topo = topology({india: {type: 'FeatureCollection', features: [indiaFeature]}});
const india50Quantized = quantize(india50Topo, 1e5);
const india50Simplified = simplify(india50Quantized, 0.00005);
const india50Feature = feature(india50Simplified, india50Simplified.objects.india).features[0];
const geo50Final = {...geo50, features: (geo50.features || []).map(f => isIndia(f) ? india50Feature : f)};
const topo50 = topology({countries: geo50Final});
await fs.writeFile(path.join(out, 'world-50m.topojson'), JSON.stringify(topo50));

// Build 10m
let topo10 = topology({countries: geo10});
topo10 = quantize(topo10, 1e5);
topo10 = simplify(topo10, 0.000001);
await fs.writeFile(path.join(out, 'world-10m.topojson'), JSON.stringify(topo10));

// Disputed
const disputedTopo = topology({disputed});
const disputedQuantized = quantize(disputedTopo, 1e5);
const disputedSimplified = simplify(disputedQuantized, 0.000001);
await fs.writeFile(path.join(out, 'disputed-boundaries-10m.topojson'), JSON.stringify(disputedSimplified));
await fs.writeFile(path.join(out, 'disputed-boundaries-10m.geojson'), JSON.stringify(disputed));

console.log('Geo build complete.');