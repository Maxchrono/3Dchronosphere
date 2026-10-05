import {exec} from 'node:child_process';
import {promisify} from 'node:util';
// HARDEN: dependency audit routine. Run monthly & before every deployment:
//   node scripts/audit-deps.mjs
const run=promisify(exec);
let raw='';
try{
const {stdout}=await run('npm audit --json');
raw=stdout;
}catch(err){raw=err.stdout||'';}
try{
const j=JSON.parse(raw);
const v=j.metadata?.vulnerabilities||{};
const high=(v.high||0)+(v.critical||0);
console.log('[audit] summary:',JSON.stringify(v));
if(high===0){console.log('[audit] PASS — no high/critical vulnerabilities.');}
else{console.error('[audit] ACTION NEEDED — high/critical issues found. Run `npm audit` for details and update the affected package.');process.exitCode=1;}
}catch{
console.warn('[audit] Could not parse npm audit output (registry unreachable?). Run `npm audit` manually.');
process.exitCode=2;
}