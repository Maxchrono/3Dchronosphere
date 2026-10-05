(async()=>{
let sriMap=null;
try{const r=await fetch('/vendor/sri.json',{cache:'no-cache'});if(r.ok)sriMap=await r.json();}catch(err){}
function loadScript(src,entry){
return new Promise((resolve,reject)=>{
const el=document.createElement('script');
el.src=src;
const pin=entry&&sriMap&&sriMap[entry];
if(pin&&pin.integrity){el.integrity=pin.integrity;el.crossOrigin='anonymous';el.referrerPolicy='no-referrer';}
el.onload=resolve;
el.onerror=reject;
document.head.appendChild(el);
});
}
try{await loadScript('/vendor/three.min.js');}
catch{const pin=sriMap?.['three.min.js'];await loadScript(pin?pin.url:'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js','three.min.js');}
try{await loadScript('/vendor/topojson-client.min.js');}
catch{const pin=sriMap?.['topojson-client.min.js'];await loadScript(pin?pin.url:'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js','topojson-client.min.js');}
const stage=document.querySelector('#stage'),panel=document.querySelector('#panel'),q=document.querySelector('#q'),results=document.querySelector('#results');
const name=document.querySelector('#name'),country=document.querySelector('#country'),tz=document.querySelector('#tz'),offset=document.querySelector('#offset'),date=document.querySelector('#date'),coords=document.querySelector('#coords'),pop=document.querySelector('#pop'),detection=document.querySelector('#detection'),coord=document.querySelector('#coord');
const panelEyebrow=document.querySelector('#panelEyebrow'),placeMeta=document.querySelector('#placeMeta');
const localMiniPlace=document.querySelector('#localMiniPlace'),localMiniClock=document.querySelector('#localMiniClock'),localMiniZone=document.querySelector('#localMiniZone');
const browserTimezone=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch{return ''}})();
const canonicalClientTz=(()=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:browserTimezone}).resolvedOptions().timeZone||browserTimezone}catch{return browserTimezone}})();
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,100);camera.position.set(0,0,5.35);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(err){
stage.innerHTML='<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#aeb5b4;font:12px ui-monospace,monospace">WebGL is unavailable on this device. Please enable hardware acceleration or use a WebGL-capable browser.</div>';
return;
}renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;stage.appendChild(renderer.domElement);
const earthGroup=new THREE.Group();scene.add(earthGroup);const R=1.58;
const earth=new THREE.Mesh(new THREE.SphereGeometry(R,128,96),new THREE.MeshPhongMaterial({color:0x1b2425,specular:0x3c5051,shininess:20,transparent:false,depthTest:true,depthWrite:true}));earthGroup.add(earth);
scene.add(new THREE.AmbientLight(0x2b3738,.18));
const key=new THREE.DirectionalLight(0xe6efed,.25);key.position.set(-4,2,5);scene.add(key);
const fill=new THREE.DirectionalLight(0x799395,.10);fill.position.set(4,-1,-4);scene.add(fill);
const sunLight=new THREE.DirectionalLight(0xfff2df,3.0);earthGroup.add(sunLight);earthGroup.add(sunLight.target);
function ll(lat,lon,r=R+.026){
const phi=THREE.MathUtils.degToRad(lat),lambda=THREE.MathUtils.degToRad(lon),cosPhi=Math.cos(phi);
return new THREE.Vector3(r*cosPhi*Math.sin(lambda),r*Math.sin(phi),r*cosPhi*Math.cos(lambda));
}
function latLonToVector3(lat,lon,distance){
const phi=THREE.MathUtils.degToRad(lat),lambda=THREE.MathUtils.degToRad(lon),cosPhi=Math.cos(phi);
return new THREE.Vector3(distance*cosPhi*Math.sin(lambda),distance*Math.sin(phi),distance*cosPhi*Math.cos(lambda));
}
const CELESTIAL={sunDistance:18,moonDistance:7,zoomThreshold:9.0,zoomMin:3.35,zoomMax:30,fade:0,fadeTarget:0};
const celestialFadeItems=[];
function fadeItem(obj,baseOpacity,depthWrite=false){obj.material.transparent=true;obj.material.opacity=0;obj.material.depthWrite=depthWrite;obj.userData.baseOpacity=baseOpacity;obj.visible=false;celestialFadeItems.push(obj);}
function makeGlowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const grad=g.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.25,'rgba(255,255,255,.6)');grad.addColorStop(.6,'rgba(255,255,255,.18)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const glowTex=makeGlowTexture();
function glowSprite(color,scale,opacity){const m=new THREE.SpriteMaterial({map:glowTex,color:color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true});const s=new THREE.Sprite(m);s.scale.setScalar(scale);s.userData.baseScale=scale;return s;}
const celestialGroup=new THREE.Group();earthGroup.add(celestialGroup);
const sunGroup=new THREE.Group();celestialGroup.add(sunGroup);
const sunCore=new THREE.Mesh(new THREE.SphereGeometry(1.0,32,32),new THREE.MeshBasicMaterial({color:0xffe9a8}));sunGroup.add(sunCore);fadeItem(sunCore,1,true);
const sunGlow1=glowSprite(0xffc46b,7,.55);sunGroup.add(sunGlow1);fadeItem(sunGlow1,.55);
const sunGlow2=glowSprite(0xff8c2e,12,.22);sunGroup.add(sunGlow2);fadeItem(sunGlow2,.22);
const moonGroup=new THREE.Group();celestialGroup.add(moonGroup);
const moonCore=new THREE.Mesh(new THREE.SphereGeometry(.35,24,24),new THREE.MeshStandardMaterial({color:0xb9c4c9,roughness:.95,metalness:.05}));moonGroup.add(moonCore);fadeItem(moonCore,1,true);
const moonGlow=glowSprite(0x9fc4cf,2.2,.16);moonGroup.add(moonGlow);fadeItem(moonGlow,.16);
function orbitRing(){const pts=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;pts.push(new THREE.Vector3(Math.sin(a),0,Math.cos(a)));}return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8fb4ba,transparent:true,opacity:0,depthWrite:false}));}
const sunPathRing=orbitRing(),moonPathRing=orbitRing();celestialGroup.add(sunPathRing,moonPathRing);fadeItem(sunPathRing,.10);fadeItem(moonPathRing,.12);
const map=new THREE.Group();earthGroup.add(map);
const geo50=new THREE.Group(), geo10=new THREE.Group(), disputed=new THREE.Group();
map.add(geo50,geo10,disputed);
const borderMat=new THREE.LineBasicMaterial({color:0xd5dcda,transparent:true,opacity:.54,depthTest:true,depthWrite:false});
const coastMat=new THREE.LineBasicMaterial({color:0xf0f3f1,transparent:true,opacity:.28,depthTest:true,depthWrite:false});
const detailedMat=new THREE.LineBasicMaterial({color:0xe2e9e7,transparent:true,opacity:.66,depthTest:true,depthWrite:false});
const disputedMat=new THREE.LineDashedMaterial({color:0xb8c1c0,transparent:true,opacity:.34,dashSize:.022,gapSize:.018,depthTest:true,depthWrite:false});
const GEO_R=R+.026;
const GEO_LOCAL_50='/geo/world-50m.topojson',GEO_LOCAL_10='/geo/world-10m.topojson';
const GEO_REMOTE_50='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries_lakes.geojson';
const GEO_REMOTE_10='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_lakes.geojson';
const GEO_REMOTE_INDIA_POV='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson';
const GEO_CDN_INDIA_POV='https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_0_countries_ind.geojson';
const GEO_REMOTE_DISPUTED='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_boundary_lines_disputed_areas.geojson';
const mapStatus=document.querySelector('#mapStatus');
let mapState='loading',detailedLoaded=false,detailedLoading=false,lodBlend=0,lodTarget=0;const LOD_FADE_MS=420;
function setLODVisibility(target){lodTarget=target?1:0}
function setMapStatus(v){mapState=v;if(mapStatus)mapStatus.textContent=v.toUpperCase()}
function zoomTierLabel(z){return z<=4.72?'10M':z<=6.7?'50M':z<=12?'100M':z<=20?'200M':'400M'}
function disposeGroup(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose()});while(g.children.length)g.remove(g.children[0])}
function flattenPolylines(lines,closeRings=false){const out=[];for(const coords of lines||[]){if(!Array.isArray(coords)||coords.length<2)continue;let prev=null;for(const c of coords){if(!Array.isArray(c)||c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1])){prev=null;continue}const p=ll(c[1],c[0],GEO_R);if(prev)out.push(prev.x,prev.y,prev.z,p.x,p.y,p.z);prev=p}if(closeRings&&coords.length>2){const a=coords[0],b=coords[coords.length-1];if(Array.isArray(a)&&Array.isArray(b)){const p1=ll(a[1],a[0],GEO_R),p2=ll(b[1],b[0],GEO_R);if(p1.distanceToSquared(p2)>1e-10)out.push(p2.x,p2.y,p2.z,p1.x,p1.y,p1.z)}}}return new Float32Array(out)}
function addMergedSegments(group,lines,mat,closeRings=false){const data=flattenPolylines(lines,closeRings);if(!data.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));g.computeBoundingSphere();const renderMat=mat.clone();const obj=new THREE.LineSegments(g,renderMat);obj.userData.baseOpacity=renderMat.opacity;group.add(obj);return obj}
function addDashedSegments(group,lines,mat){const data=flattenPolylines(lines,false);if(!data.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));g.computeBoundingSphere();const renderMat=mat.clone();const obj=new THREE.LineSegments(g,renderMat);obj.computeLineDistances();obj.userData.baseOpacity=renderMat.opacity;group.add(obj);return obj}
function extractExteriorRings(geojson){const lines=[];for(const f of geojson.features||[]){const g=f.geometry;if(!g)continue;if(g.type==='Polygon'){const ring=g.coordinates?.[0];if(ring)lines.push(ring)}else if(g.type==='MultiPolygon'){for(const poly of g.coordinates||[]){const ring=poly?.[0];if(ring)lines.push(ring)}}}return lines}
function extractAllLines(geojson){const lines=[];for(const f of geojson.features||[]){const g=f.geometry;if(!g)continue;if(g.type==='LineString')lines.push(g.coordinates||[]);else if(g.type==='MultiLineString')for(const line of g.coordinates||[])lines.push(line);else if(g.type==='Polygon')for(const ring of g.coordinates||[])lines.push(ring);else if(g.type==='MultiPolygon')for(const poly of g.coordinates||[])for(const ring of poly||[])lines.push(ring)}return lines}
async function fetchJsonWithFallback(localUrl,remoteUrl){try{const r=await fetch(localUrl,{cache:'default'});if(r.ok)return await r.json()}catch{}const r=await fetch(remoteUrl,{cache:'force-cache'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
function geoBoundaryLines(data){if(data?.objects?.countries){const countries=data.objects.countries,feature=topojson.feature(data,countries);return{borders:topojson.mesh(data,countries,(a,b)=>a!==b).coordinates||[],coast:extractExteriorRings(feature)}}return{borders:extractExteriorRings(data),coast:[]}}
function isIndiaFeature(f){const p=f?.properties||{};return p.ADM0_A3==='IND'||p.ISO_A3==='IND'||p.ISO_A3_EH==='IND'||p.ADMIN==='India'}
function stripPolygonHoles(data){if(data?.type!=='FeatureCollection')return data;const cleanGeometry=g=>{if(!g)return g;if(g.type==='Polygon')return {...g,coordinates:g.coordinates?.length?[g.coordinates[0]]:[]};if(g.type==='MultiPolygon')return {...g,coordinates:(g.coordinates||[]).map(poly=>poly?.length?[poly[0]]:[]).filter(Boolean)};return g};return {...data,features:(data.features||[]).map(f=>({...f,geometry:cleanGeometry(f.geometry)}))};}
function mergeIndiaPOV(base,pov){const india=(pov?.features||[]).find(isIndiaFeature);if(!india)return base;const cleanIndia=stripPolygonHoles({type:'FeatureCollection',features:[india]}).features[0];return {...base,features:(base.features||[]).map(f=>isIndiaFeature(f)?cleanIndia:f)}}
function dataFeatures(data){
if(data?.type==='FeatureCollection')return data.features||[];
if(data?.objects?.countries){try{return topojson.feature(data,data.objects.countries).features||[]}catch(err){return []}}
return [];
}
function featurePointCount(f){
return extractAllLines({type:'FeatureCollection',features:[f]}).reduce((n,r)=>n+(r?.length||0),0);
}
function indiaGeometryHealthy(data){
const india=dataFeatures(data).find(isIndiaFeature);
if(!india)return false;
return featurePointCount(india)>=100;
}
function countryNameSet(data){
const names=new Set();
for(const f of dataFeatures(data)){const p=f?.properties||{};if(p.ADMIN)names.add(p.ADMIN);if(p.NAME)names.add(p.NAME);}
return names;
}
const AUDIT_COUNTRIES=['India','China','United States of America','United States','Russia','Brazil','Australia','Pakistan','Bangladesh','Sri Lanka','Nepal','Bhutan','Myanmar','Japan','France','Germany','United Kingdom','Canada','Mexico','Argentina','South Africa','Egypt','Nigeria','Indonesia','Saudi Arabia','Turkey','Iran','Afghanistan','Thailand','Vietnam','South Korea','Malaysia','Kazakhstan','Mongolia','Ukraine','Poland','Spain','Italy','Norway','Sweden','Finland','Iceland','Greenland','New Zealand','Chile','Peru','Colombia','Kenya','Ethiopia','Morocco','Algeria','Libya','Sudan','Chad','Mali','Niger','Namibia','Botswana','Zimbabwe','Madagascar','Tanzania','Angola','Mozambique','Ghana','Senegal','Portugal','Greece','Switzerland','Austria','Netherlands','Belgium','Denmark','Romania','Bulgaria','Hungary','Czechia','Czech Republic','Slovakia','Belarus'];
function auditCountries(data,label){
try{
const names=countryNameSet(data);
console.log('[Chronosphere] '+label+': '+names.size+' countries present in source data.');
const missing=AUDIT_COUNTRIES.filter(c=>!names.has(c));
if(missing.length)console.warn('[Chronosphere] '+label+' audit flags (check aliases): '+missing.join(', '));
}catch(err){}
}
async function healIndia(group,mat,label){
const sources=[GEO_CDN_INDIA_POV,GEO_REMOTE_INDIA_POV];
for(const url of sources){
try{
const r=await fetch(url,{cache:'no-store'});
if(!r.ok){console.warn('[Chronosphere] India source '+url+' -> HTTP '+r.status);continue;}
const pov=await r.json();
const india=(pov?.features||[]).find(isIndiaFeature);
if(!india){console.warn('[Chronosphere] India feature not found in '+url);continue;}
const rings=extractAllLines({type:'FeatureCollection',features:[india]});
const pts=rings.reduce((n,rg)=>n+(rg?.length||0),0);
if(pts<100){console.warn('[Chronosphere] India geometry degenerate in '+url+' ('+pts+' pts)');continue;}
addMergedSegments(group,rings,mat,false);
console.warn('[Chronosphere] '+label+': India self-healed — '+pts+' points drawn from '+new URL(url).hostname);
return true;
}catch(err){console.warn('[Chronosphere] India source failed: '+url+' '+(err?.message||err));}
}
console.error('[Chronosphere] '+label+': all India heal sources exhausted.');
return false;
}
async function fetchWorldWithIndiaPOV(localUrl,remoteUrl){try{const r=await fetch(localUrl,{cache:'default'});if(r.ok)return await r.json()}catch{}const [world,pov]=await Promise.all([fetch(remoteUrl,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}),fetch(GEO_REMOTE_INDIA_POV,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`India POV HTTP ${r.status}`);return r.json()})]);return mergeIndiaPOV(world,pov)}
async function loadWorld50(){try{setMapStatus('loading 50m');const data=await fetchWorldWithIndiaPOV(GEO_LOCAL_50,GEO_REMOTE_50);console.info('[Chronosphere] 50m source: '+(data?.objects?.countries?'local topojson':'remote geojson'));disposeGroup(geo50);const {borders,coast}=geoBoundaryLines(data);addMergedSegments(geo50,borders,borderMat,false);addMergedSegments(geo50,coast,coastMat,false);auditCountries(data,'50m');if(!indiaGeometryHealthy(data))await healIndia(geo50,borderMat,'50m');geo50.visible=true;setMapStatus(zoomTierLabel(camera.position.z));return true}catch(err){console.warn('[Chronosphere] 50m map unavailable',err);setMapStatus('map error');return false}}
async function loadDetailed10(){if(detailedLoaded||detailedLoading)return detailedLoaded;detailedLoading=true;try{setMapStatus('loading 10m');const data=await fetchWorldWithIndiaPOV(GEO_LOCAL_10,GEO_REMOTE_10);console.info('[Chronosphere] 10m source: '+(data?.objects?.countries?'local topojson':'remote geojson'));disposeGroup(geo10);const {borders,coast}=geoBoundaryLines(data);addMergedSegments(geo10,borders,detailedMat,false);addMergedSegments(geo10,coast.length?coast:[],coastMat,false);if(!coast.length&&data?.type==='FeatureCollection')geo10.children.forEach(o=>o.material=detailedMat);auditCountries(data,'10m');if(!indiaGeometryHealthy(data))await healIndia(geo10,detailedMat,'10m');detailedLoaded=true;geo10.visible=true;setMapStatus(zoomTierLabel(camera.position.z));return true}catch(err){console.warn('[Chronosphere] 10m map unavailable',err);geo10.visible=false;setMapStatus('50m fallback');return false}finally{detailedLoading=false}}
async function loadDisputedBoundaries(){try{const data=await fetchJsonWithFallback('/geo/disputed-boundaries-10m.geojson',GEO_REMOTE_DISPUTED);disposeGroup(disputed);addDashedSegments(disputed,extractAllLines(data),disputedMat);disputed.visible=true;return true}catch(err){console.warn('[Chronosphere] disputed-boundary layer unavailable',err);disputed.visible=false;return false}}
async function setMapLOD(){const near=camera.position.z<=4.72;if(near){setLODVisibility(true);if(!detailedLoaded)await loadDetailed10();if(detailedLoaded)setMapStatus(zoomTierLabel(camera.position.z))}else{setLODVisibility(false);setMapStatus(zoomTierLabel(camera.position.z))}}
const grid=new THREE.Group();const gridMat=new THREE.LineBasicMaterial({color:0x718081,transparent:true,opacity:.052,depthTest:true,depthWrite:false});for(let lat=-75;lat<=75;lat+=15){const pts=[];for(let lon=0;lon<=360;lon+=2)pts.push(ll(lat,lon,R+.012));grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMat))}for(let lon=0;lon<360;lon+=15){const pts=[];for(let lat=-90;lat<=90;lat+=2)pts.push(ll(lat,lon,R+.012));grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMat))}earthGroup.add(grid);
const eq=[];for(let i=0;i<=256;i++){const a=i/256*Math.PI*2;eq.push(new THREE.Vector3((R+.023)*Math.cos(a),0,(R+.023)*Math.sin(a)))}earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eq),new THREE.LineBasicMaterial({color:0xaebbbb,transparent:true,opacity:.15,depthTest:true,depthWrite:false})));
const clouds=new THREE.Mesh(new THREE.SphereGeometry(R+.035,96,64),new THREE.MeshPhongMaterial({color:0x89999a,transparent:true,opacity:.035,depthWrite:false,depthTest:true,side:THREE.DoubleSide}));earthGroup.add(clouds);
const atmo=new THREE.Mesh(new THREE.SphereGeometry(R+.10,96,64),new THREE.MeshBasicMaterial({color:0x86a4a7,transparent:true,opacity:.045,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));const atmo2=new THREE.Mesh(new THREE.SphereGeometry(R+.16,96,64),new THREE.MeshBasicMaterial({color:0x9ab4b7,transparent:true,opacity:.014,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));earthGroup.add(atmo,atmo2);
const hud=new THREE.Group();earthGroup.add(hud);const hudMat=new THREE.LineBasicMaterial({color:0x849596,transparent:true,opacity:.16});const hp=[];for(let i=0;i<=128;i++){const a=i/128*Math.PI*2;hp.push(new THREE.Vector3(1.80*Math.cos(a),0,1.80*Math.sin(a)))}hud.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hp),hudMat));
const stars=[];for(let i=0;i<520;i++){const r=8+Math.random()*11,t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);stars.push(r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t))}const sb=new THREE.BufferGeometry();sb.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(sb,new THREE.PointsMaterial({color:0xaeb8b8,size:.009,opacity:.35,transparent:true})));
const marker=new THREE.Group();earthGroup.add(marker);const markerDot=new THREE.Mesh(new THREE.SphereGeometry(.034,20,20),new THREE.MeshBasicMaterial({color:0xff3948,depthTest:true,depthWrite:false}));marker.add(markerDot);const mr=new THREE.Mesh(new THREE.RingGeometry(.058,.074,48),new THREE.MeshBasicMaterial({color:0xff3948,transparent:true,opacity:.86,side:THREE.DoubleSide,depthTest:true,depthWrite:false}));marker.add(mr);const markerNormal=new THREE.Vector3(),markerAxis=new THREE.Vector3(0,0,1);
function updateMarker(c){const lat=Number(c?.latitude),lon=Number(c?.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon)){marker.visible=false;return}marker.visible=true;marker.position.copy(ll(lat,lon,R+.050));markerNormal.copy(marker.position).normalize();mr.quaternion.setFromUnitVectors(markerAxis,markerNormal)}
function normalizeLocation(x){if(!x)return null;return {...x,latitude:Number(x.latitude??x.lat),longitude:Number(x.longitude??x.lon),population:Number(x.population??x.pop??0),timezone:String(x.timezone||'')}}
let selected={id:'local',name:'Your local time',type:'local',region:'',country:'',countryCode:'',latitude:null,longitude:null,timezone:browserTimezone,population:0,match:'browser-timezone'};
let localLocation=null,selectedMode='local';
updateMarker(selected);
function safeParts(zone,instant=new Date()){try{return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(x=>[x.type,x.value]))}catch{return null}}
function safeOffset(zone,instant=new Date()){try{const z=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(instant).find(x=>x.type==='timeZoneName')?.value||'GMT';return z.replace('GMT','UTC')}catch{return 'Unavailable'}}
function placeLabel(x){return [x?.region,x?.country].filter(Boolean).join(' · ')||'Local timezone'}
function locationDetectionText(x){if(x?.match==='geolocation')return Number.isFinite(x.distanceKm)?`GPS · ${x.distanceKm.toFixed(1)} km`:'GPS detected';if(x?.match==='timezone-reference')return 'Timezone reference';return 'Browser timezone'}
function applySelectedLocation(raw,mode='search',center=true){
const c=normalizeLocation(raw);if(!c)return;
selected=c;selectedMode=mode;
panel.classList.remove('closed');
if(center){
updateMarker(c);
const lon=Number(c.longitude),lat=Number(c.latitude);
if(Number.isFinite(lon)&&Number.isFinite(lat)){
velY=0;velX=0;autoSpin=false;lastInteraction=performance.now();
const token=++autoSpinTimer;
const currentRot=normalizeAngle(rotY);rotY=currentRot;
const delta=angleDelta(currentRot,-THREE.MathUtils.degToRad(lon));
isAnimating=true;
animStartTime=performance.now();
animStartY=currentRot;animStartX=rotX;
animTargetY=currentRot+delta;
animTargetX=THREE.MathUtils.clamp(-THREE.MathUtils.degToRad(lat)*.24,-.62,.62);
const dist=Math.hypot(Math.abs(delta),animTargetX-rotX);
animDuration=THREE.MathUtils.clamp(dist*1.2,.8,2.2);
setTimeout(()=>{if(token===autoSpinTimer&&!drag&&!isAnimating)autoSpin=true},(animDuration*1000)+2000);
}
}
updatePanel()}
function updateLocalStrip(instant=new Date()){const localTz=localLocation?.timezone||browserTimezone;if(!localTz){localMiniPlace.textContent='Timezone unavailable';localMiniClock.textContent='--:--:--';localMiniZone.textContent='—';return}const p=safeParts(localTz,instant);if(!p){localMiniPlace.textContent='Timezone unavailable';localMiniClock.textContent='--:--:--';localMiniZone.textContent=localTz;return}localMiniPlace.textContent=localLocation?.name||'Local time';localMiniClock.textContent=`${p.hour}:${p.minute}:${p.second}`;localMiniZone.textContent=`${localTz} · ${safeOffset(localTz,instant)}`}
function updatePanel(){const p=safeParts(selected.timezone||browserTimezone);name.textContent=selected.name||'Your local time';country.textContent=placeLabel(selected);placeMeta.textContent=selectedMode==='search'?'SELECTED LOCATION':(selected.match==='geolocation'?'YOUR LOCATION · GPS':'YOUR LOCATION · TIMEZONE');panelEyebrow.textContent=selectedMode==='search'?'Selected location · live':'Your location · live';if(p){document.querySelector('#clock').innerHTML=`${p.hour}:${p.minute}:<span class="sec">${p.second}</span>`;date.textContent=`${p.weekday}, ${p.month} ${p.day}, ${p.year}`}else{document.querySelector('#clock').textContent='Unavailable';date.textContent='—'}tz.textContent=selected.timezone||'Unavailable';offset.textContent=safeOffset(selected.timezone||browserTimezone);coords.textContent=Number.isFinite(selected.latitude)&&Number.isFinite(selected.longitude)?`${selected.latitude.toFixed(4)}°, ${selected.longitude.toFixed(4)}°`:'—';detection.textContent=locationDetectionText(selected);pop.textContent=selected.population?selected.population.toLocaleString():'—';coord.textContent=Number.isFinite(selected.latitude)&&Number.isFinite(selected.longitude)?`LAT ${selected.latitude.toFixed(4)} · LON ${selected.longitude.toFixed(4)}`:'LAT — · LON —';updateLocalStrip()}
function clock(){const now=new Date();const p=safeParts(selected.timezone||browserTimezone,now);if(p)document.querySelector('#clock').innerHTML=`${p.hour}:${p.minute}:<span class="sec">${p.second}</span>`;updateLocalStrip(now)}
// --- V4.2 GPS: universal guards + timezone re-assertion + clean labels ---
let locateBtn=null;
async function timezoneFallback(reason){
if(!browserTimezone){if(locateBtn)locateBtn.textContent=reason;return;}
try{
const r=await fetch('/api/localize?timezone='+encodeURIComponent(browserTimezone)).then(x=>x.json());
if(r.location){
localLocation=normalizeLocation(r.location);
if(selectedMode==='local')applySelectedLocation(localLocation,'local',true);else updateLocalStrip();
}
}catch(err){console.warn('[Chronosphere] timezone fallback unavailable',err)}
if(locateBtn)locateBtn.textContent=reason;
}
function requestGeolocation(manual){
if(!navigator.geolocation){timezoneFallback('GPS UNAVAILABLE ON DEVICE');return;}
if(locateBtn)locateBtn.textContent='REQUESTING GPS…';
navigator.geolocation.getCurrentPosition(async pos=>{
try{
const lat=pos.coords.latitude,lon=pos.coords.longitude,acc=pos.coords.accuracy;
// GUARD 1 — NULL ISLAND: (0,0) is the canonical bogus IP/VPN artifact.
if(Math.abs(lat)<1&&Math.abs(lon)<1){
console.warn('[Chronosphere] GPS fix rejected: Null-Island artifact (0,0).');
await timezoneFallback('GPS UNRELIABLE — USING TIMEZONE');
return;
}
const qs=`lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}${browserTimezone?'&timezone='+encodeURIComponent(browserTimezone):''}`;
const r=await fetch('/api/localize?'+qs).then(x=>x.json());
if(!r.location)return;
const cand=normalizeLocation(r.location);
// GUARD 2 — OCEAN DUMP / CROSS-TIMEZONE: real fixes land near an indexed
// city in the OS timezone; open-ocean or weak cross-zone fixes are bogus.
const km=Number.isFinite(cand.distanceKm)?cand.distanceKm:0;
const crossTz=browserTimezone&&cand.timezone&&cand.timezone!==browserTimezone&&cand.timezone!==canonicalClientTz;
if(km>1000||(km>250&&crossTz)||(crossTz&&!(Number.isFinite(acc)&&acc<=30000))){
console.warn('[Chronosphere] GPS fix rejected: ocean-dump/cross-timezone ('+Math.round(km)+' km).');
await timezoneFallback('GPS UNRELIABLE — USING TIMEZONE');
return;
}
localLocation=cand;
if(selectedMode==='local')applySelectedLocation(localLocation,'local',true);else updateLocalStrip();
if(locateBtn)locateBtn.textContent='⌖ LOCATION LOCKED';
}catch(err){console.warn('[Chronosphere] GPS localization unavailable',err);await timezoneFallback('GPS UNAVAILABLE');}
},err=>{
// GPS denied / blocked / timed out -> OS timezone is re-asserted as default.
if(err?.code!==1)console.warn('[Chronosphere] geolocation unavailable',err);
timezoneFallback(err?.code===1?'GPS BLOCKED':'GPS UNAVAILABLE');
},{enableHighAccuracy:false,maximumAge:0,timeout:120000});
}
async function resolveLocalLocation(){
if(browserTimezone){
try{
const r=await fetch('/api/localize?timezone='+encodeURIComponent(browserTimezone)).then(x=>x.json());
if(r.location){localLocation=normalizeLocation(r.location);applySelectedLocation(localLocation,'local',true)}
}catch(err){console.warn('[Chronosphere] timezone localization unavailable',err)}
}
requestGeolocation(false);
}
let targetY=0, targetX=0;
let rotY=0, rotX=0;
let velY=0, velX=0;
let drag=false;
let lastX=0, lastY=0, lastPointerTime=0;
let pointerX=0, pointerY=0, hover=false;
let lastInteraction=performance.now();
let autoSpin=true;
let autoSpinTimer=0;
let scale=1, scaleTarget=1;
let isAnimating=false,animStartTime=0,animDuration=0,animStartY=0,animStartX=0,animTargetY=0,animTargetX=0;
const DRAG_SENSITIVITY_X=0.0026;
const DRAG_SENSITIVITY_Y=0.0019;
const MAX_INERTIA_Y=0.35;
const MAX_INERTIA_X=0.24;
const VELOCITY_RESPONSE=12;
const INERTIA_DAMPING=6.0;
const ROTATION_SMOOTHING=12.0;
const AUTO_SPIN_SPEED=0.0105;
const MAX_DRAG_STEP=0.12;
function angleDelta(from,to){
return Math.atan2(Math.sin(to-from),Math.cos(to-from));
}
function nearestAngle(from,to){
return from+angleDelta(from,to);
}
function normalizeAngle(a){
return Math.atan2(Math.sin(a),Math.cos(a));
}
function focus(c){applySelectedLocation(c,'search',true)}
const canvas=renderer.domElement;
canvas.addEventListener('pointerenter',()=>hover=true);
canvas.addEventListener('pointerleave',()=>{ hover=false; pointerX=0; pointerY=0; });
canvas.addEventListener('pointerdown',e=>{
drag=true; isAnimating=false; autoSpin=false; ++autoSpinTimer;
lastInteraction=performance.now();
lastPointerTime=lastInteraction;
lastX=e.clientX; lastY=e.clientY;
velY=0; velX=0;
scaleTarget=1.008;
canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
pointerX=e.clientX/innerWidth-.5;
pointerY=e.clientY/innerHeight-.5;
if(!drag) return;
const now=performance.now();
const dt=Math.min(.05,Math.max(.004,(now-lastPointerTime)/1000));
const dx=e.clientX-lastX, dy=e.clientY-lastY;
lastX=e.clientX; lastY=e.clientY;
lastPointerTime=now; lastInteraction=now;
const stepY=THREE.MathUtils.clamp(dx*DRAG_SENSITIVITY_X,-MAX_DRAG_STEP,MAX_DRAG_STEP);
const stepX=THREE.MathUtils.clamp(dy*DRAG_SENSITIVITY_Y,-MAX_DRAG_STEP,MAX_DRAG_STEP);
targetY+=stepY;
targetX=THREE.MathUtils.clamp(targetX+stepX,-.78,.78);
const instantY=THREE.MathUtils.clamp(stepY/dt,-MAX_INERTIA_Y,MAX_INERTIA_Y);
const instantX=THREE.MathUtils.clamp(stepX/dt,-MAX_INERTIA_X,MAX_INERTIA_X);
const response=1-Math.exp(-VELOCITY_RESPONSE*dt);
velY+=(instantY-velY)*response;
velX+=(instantX-velX)*response;
});
function releasePointer(){
if(!drag) return;
drag=false; scaleTarget=1; lastInteraction=performance.now(); ++autoSpinTimer;
velY=THREE.MathUtils.clamp(velY,-MAX_INERTIA_Y,MAX_INERTIA_Y);
velX=THREE.MathUtils.clamp(velX,-MAX_INERTIA_X,MAX_INERTIA_X);
setTimeout(()=>{
if(!drag && Math.abs(velY)<.012 && Math.abs(velX)<.012) autoSpin=true;
},800);
}
canvas.addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',releasePointer);
canvas.addEventListener('lostpointercapture',()=>{ if(drag) releasePointer(); });
canvas.addEventListener('wheel',e=>{
e.preventDefault();
camera.position.z=THREE.MathUtils.clamp(
camera.position.z+e.deltaY*.0017,
CELESTIAL.zoomMin,CELESTIAL.zoomMax
);
if(mapStatus)mapStatus.textContent=zoomTierLabel(camera.position.z);
void setMapLOD();
},{passive:false});
function esc(s){
return String(s).replace(/[&<>'"]/g,c=>({
'&':'&amp;',
'<':'&lt;',
'>':'&gt;',
"'":'&#39;',
'"':'&quot;'
}[c]));
}
let searchTimer;
q.addEventListener('input',()=>{
clearTimeout(searchTimer);
const v=q.value.trim();
if(v.length<2){
results.style.display='none';
return;
}
searchTimer=setTimeout(async()=>{
try{
const r=await fetch('/api/search?q='+encodeURIComponent(v))
.then(x=>x.json());
results.innerHTML=r.results.map((x,i)=>`
<button class="result" role="option" data-i="${i}">
<div>
<b>${esc(x.name)}</b>
<small>${esc([x.region,x.country].filter(Boolean).join(' · '))}</small>
</div>
<em>${esc(x.timezone)}</em>
</button>
`).join('') ||
'<div style="padding:16px;color:#687173;font-size:10px">No matching place found.</div>';
results.style.display='block';
results.querySelectorAll('.result').forEach((b,i)=>{
b.onclick=()=>{
focus(r.results[i]);
q.value=r.results[i].name;
results.style.display='none';
};
});
}catch{
results.innerHTML=
'<div style="padding:16px;color:#687173;font-size:10px">Search service unavailable.</div>';
results.style.display='block';
}
},140);
});
document.addEventListener('click',e=>{
if(!e.target.closest('.topSearch'))
results.style.display='none';
});
locateBtn=document.createElement('button');
locateBtn.type='button';
locateBtn.textContent='⌖ USE MY LOCATION';
locateBtn.setAttribute('aria-label','Request my GPS location');
locateBtn.style.cssText='margin-top:10px;width:100%;height:30px;background:rgba(11,14,15,.84);border:1px solid rgba(255,255,255,.095);color:#8fa3a5;font-size:8px;letter-spacing:.12em;cursor:pointer';
locateBtn.onmouseenter=()=>{locateBtn.style.color='#c6d4d5';};
locateBtn.onmouseleave=()=>{locateBtn.style.color='#8fa3a5';};
locateBtn.onclick=()=>requestGeolocation(true);
document.querySelector('.topSearch').appendChild(locateBtn);
document.querySelector('#close').onclick=()=>{
panel.classList.add('closed');
};
document.querySelector('#save').onclick=()=>{
localStorage.setItem(
'chronosphere.selected',
JSON.stringify(selected)
);
document.querySelector('#save').textContent='Saved';
setTimeout(()=>{
document.querySelector('#save').textContent='Save location';
},900);
};
updatePanel();
clock();
void resolveLocalLocation();
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
if(reduceMotion.matches){autoSpin=false;}
reduceMotion.addEventListener?.('change',e=>{autoSpin=!e.matches&&!drag;});
let last=performance.now();
let lastClockUpdate=performance.now();
let lastLodCheck=performance.now();
let pageVisible=!document.hidden;
document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;});
function animate(t){
requestAnimationFrame(animate);
if(!pageVisible)return;
const dt=Math.min(.05,Math.max(.001,(t-last)/1000));
last=t;
if(isAnimating){
const elapsed=(t-animStartTime)/1000;
let p=Math.min(elapsed/animDuration,1);
const eased=p<.5?8*p*p*p*p:1-Math.pow(-2*p+2,4)/2;
rotY=animStartY+(animTargetY-animStartY)*eased;
rotX=animStartX+(animTargetX-animStartX)*eased;
targetY=rotY;targetX=rotX;
if(p>=1){isAnimating=false;rotY=normalizeAngle(animTargetY);rotX=animTargetX;targetY=rotY;targetX=rotX;}
}else if(!drag){
const damping=Math.exp(-INERTIA_DAMPING*dt);
velY*=damping; velX*=damping;
targetY+=velY*dt;
targetX=THREE.MathUtils.clamp(targetX+velX*dt,-.78,.78);
if(autoSpin && t-lastInteraction>900 && Math.abs(velY)<.012 && Math.abs(velX)<.012){
targetY+=AUTO_SPIN_SPEED*dt;
}
}
if(!isAnimating){
const alpha=1-Math.exp(-ROTATION_SMOOTHING*dt);
rotY+=angleDelta(rotY,targetY)*alpha;
rotY=normalizeAngle(rotY);
targetY=normalizeAngle(targetY);
rotX+=(targetX-rotX)*alpha;
}
earthGroup.rotation.y=rotY+pointerX*.0035;
earthGroup.rotation.x=rotX+pointerY*.002;
clouds.rotation.y+=.00008*dt;
hud.rotation.y+=.00005*dt;
mr.scale.setScalar(1+Math.sin(t*.004)*.055);
const scaleAlpha=1-Math.exp(-12*dt);
scale+=(scaleTarget-scale)*scaleAlpha;
earthGroup.scale.setScalar(scale);
const blendRate=1-Math.exp(-(1000/LOD_FADE_MS)*dt);
lodBlend+=(lodTarget-lodBlend)*blendRate;
geo10.visible=detailedLoaded && lodBlend>0.001;
geo50.visible=lodBlend<0.999;
const geo10Alpha=THREE.MathUtils.clamp(lodBlend,0,1);
const geo50Alpha=1-geo10Alpha;
geo10.children.forEach(o=>{o.material.opacity=(o.userData.baseOpacity??0.66)*geo10Alpha;});
geo50.children.forEach(o=>{o.material.opacity=(o.userData.baseOpacity??0.54)*geo50Alpha;});
disputed.children.forEach(o=>{o.material.opacity=o.userData.baseOpacity??.34;});
const atmosphereTarget=hover?.058:.045;
const atmosphereAlpha=1-Math.exp(-3.0*dt);
atmo.material.opacity+=(atmosphereTarget-atmo.material.opacity)*atmosphereAlpha;
const nowDate=new Date();
const utcH=nowDate.getUTCHours()+nowDate.getUTCMinutes()/60+nowDate.getUTCSeconds()/3600;
const doy=Math.floor((Date.now()-Date.UTC(nowDate.getUTCFullYear(),0,0))/864e5);
const decl=23.44*Math.sin(THREE.MathUtils.degToRad((360/365)*(doy+284)));
const subLon=(12-utcH)*15;
sunGroup.position.copy(latLonToVector3(decl,subLon,CELESTIAL.sunDistance));
sunLight.position.copy(sunGroup.position);
const theta=(nowDate.getTime()/1000/(29.5*86400))*Math.PI*2;
const moonLon=subLon+180+Math.sin(theta)*30;
const moonLat=-decl*0.3+Math.cos(theta)*10;
moonGroup.position.copy(latLonToVector3(moonLat,moonLon,CELESTIAL.moonDistance));
moonGroup.lookAt(0,0,0);
const cosD=Math.cos(THREE.MathUtils.degToRad(decl)),sinD=Math.sin(THREE.MathUtils.degToRad(decl));
sunPathRing.scale.set(cosD*CELESTIAL.sunDistance,1,cosD*CELESTIAL.sunDistance);
sunPathRing.position.y=sinD*CELESTIAL.sunDistance;
const cosM=Math.cos(THREE.MathUtils.degToRad(moonLat)),sinM=Math.sin(THREE.MathUtils.degToRad(moonLat));
moonPathRing.scale.set(cosM*CELESTIAL.moonDistance,1,cosM*CELESTIAL.moonDistance);
moonPathRing.position.y=sinM*CELESTIAL.moonDistance;
if(!reduceMotion.matches){const pulse=1+Math.sin(t*.0012)*.05;sunGlow1.scale.setScalar(sunGlow1.userData.baseScale*pulse);sunGlow2.scale.setScalar(sunGlow2.userData.baseScale*pulse);}
CELESTIAL.fadeTarget=camera.position.z>CELESTIAL.zoomThreshold?1:0;
CELESTIAL.fade+=(CELESTIAL.fadeTarget-CELESTIAL.fade)*(1-Math.exp(-(1000/LOD_FADE_MS)*dt));
const cf=THREE.MathUtils.clamp(CELESTIAL.fade,0,1);
for(const o of celestialFadeItems){o.material.opacity=(o.userData.baseOpacity??1)*cf;o.visible=cf>0.001;}
if(t-lastClockUpdate>=1000){ lastClockUpdate=t; clock(); }
if(t-lastLodCheck>=300){ lastLodCheck=t; void setMapLOD(); }
renderer.render(scene,camera);
}
void Promise.all([loadWorld50(),loadDisputedBoundaries()]).then(()=>setMapLOD());
requestAnimationFrame(animate);
addEventListener('resize',()=>{
camera.aspect=innerWidth/innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
});
})();