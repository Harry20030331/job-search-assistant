import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const forbidden = [ /\/Users\/[^/\s]+\//, /[A-Z0-9._%+-]+@(?:gmail|stanford|outlook)\.(?:com|edu)/i, /10\.30\.\d+\.\d+/, /BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/, /(?:sk-proj-|ghp_)[A-Za-z0-9_-]{20,}/ ];
let count=0;
// Explicit user-requested Chinese planning documents; privacy checks still apply.
const chinesePlanningDocs = new Set(['docs/evaluation.md', 'docs/hannah-handoff.md']);
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 if(['node_modules','.git','data','local','private','runs','.venv','.google-local','__pycache__'].includes(entry.name))continue;
 const file=join(dir,entry.name), path=relative(root,file).split('\\').join('/');
 if(entry.isSymbolicLink())throw new Error(`symlink_in_distribution:${path}`);
 if(entry.isDirectory()){if(entry.name==='archive')throw new Error('archive_in_distribution');await walk(file);continue;}
 if(path===relative(root,fileURLToPath(import.meta.url)))continue;
 if(/\.(png|jpg|jpeg|docx)$/.test(path)||/\.local\.json$/.test(path))throw new Error(`private_artifact_type:${path}`);
 const bytes=await readFile(file);if(path.endsWith('.pdf')){if(path!=='examples/alex-liu-resume.pdf')throw new Error(`unexpected_pdf:${path}`);continue;}
 const text=bytes.toString('utf8');if(forbidden.some(pattern=>pattern.test(text)))throw new Error(`private_content_pattern:${path}`);if(!chinesePlanningDocs.has(path)&&/[\u3400-\u9fff]/u.test(text))throw new Error(`non_english_authored_content:${path}`);count++;
}}
await walk(root);console.log(`PASS distribution scan: ${count} text files. PDF requires separate content review.`);
