import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'..','public','vendor');
await fs.mkdir(out,{recursive:true});
const files={
  'three.min.js':path.join(root,'..','node_modules','three','build','three.min.js'),
  'topojson-client.min.js':path.join(root,'..','node_modules','topojson-client','dist','topojson-client.min.js')
};
for(const [name,src] of Object.entries(files)){
  try{await fs.copyFile(src,path.join(out,name));console.log(`vendor: ${name}`);}catch{console.warn(`vendor missing: ${src}`);}
}
