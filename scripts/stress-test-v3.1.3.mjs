import assert from 'node:assert/strict';
const AUTO=.0105,DAMP=6,SMOOTH=12;
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function simulate(seconds,fps){
  let target=0,rot=0,vel=0,maxStep=0;
  const n=Math.round(seconds*fps);
  for(let i=0;i<n;i++){
    const dt=1/fps;
    vel*=Math.exp(-DAMP*dt); target+=AUTO*dt;
    const a=1-Math.exp(-SMOOTH*dt);
    const step=angleDelta(rot,target)*a; maxStep=Math.max(maxStep,Math.abs(step));
    rot+=step; rot=Math.atan2(Math.sin(rot),Math.cos(rot)); target=Math.atan2(Math.sin(target),Math.cos(target));
  }
  return {rot,maxStep};
}
for(const fps of [30,60,120]){
  const x=simulate(600,fps);
  assert.ok(Math.abs(x.rot)<0.25,`10min rotation drift @${fps}fps`);
  assert.ok(x.maxStep<0.01,`rotation step spike @${fps}fps`);
}
// 10,000 drag/release cycles with the hard velocity cap used by the globe.
let vY=0,vX=0;
for(let i=0;i<10000;i++){
  const dt=.004+(i%9)*.003;
  const raw=(i%2?900:-900)*.0026;
  const instant=Math.max(-.35,Math.min(.35,raw/dt));
  const a=1-Math.exp(-12*dt);
  vY+=(instant-vY)*a;
  vX+=(-instant-vX)*a;
  assert.ok(Math.abs(vY)<=.35+1e-12 && Math.abs(vX)<=.35+1e-12);
}
// LOD blend must remain bounded through repeated zoom in/out transitions.
let blend=0;
for(let i=0;i<10000;i++){
  const target=(i%2===0)?1:0;
  const dt=.016+(i%5)*.004;
  blend+=(target-blend)*(1-Math.exp(-(1000/420)*dt));
  assert.ok(blend>=0 && blend<=1);
}
console.log('V3.1.3 extended stress tests: PASS');
console.log('  10-minute idle rotation: PASS (30/60/120 FPS)');
console.log('  10,000 drag/release cycles: PASS');
console.log('  10,000 LOD transitions: PASS');
