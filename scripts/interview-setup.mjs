import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { interviewEnvironment, interviewPythonRoot, probeInterviewPython } from '../src/interview/pythonRuntime.mjs';
const args=process.argv.slice(2);
if(args.length && !(args.length===1&&args[0]==='--check'))throw Error('Usage: npm run interview:setup -- [--check]');
const execute=promisify(execFile);
async function available(executable,args=['--version']){try{await execute(executable,args,{timeout:10000});return true}catch{return false}}
async function run(executable,args){await new Promise((resolve,reject)=>{const child=spawn(executable,args,{shell:false,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('interview_setup_failed')))})}
if(!args.length){
 const local=process.platform==='win32'?join(interviewEnvironment,'Scripts','python.exe'):join(interviewEnvironment,'bin','python');
 const uv=await available('uv');
 if(!existsSync(local)){
  if(uv)await run('uv',['venv','--python','3.12',interviewEnvironment]);
  else{
   let python;
   for(const candidate of process.platform==='win32'?['python','python3.12','python3']:['python3.12','python3.13','python3']){
    if(await available(candidate,['-c','import sys;sys.exit(0 if sys.version_info >= (3,12) else 1)'])){python=candidate;break}
   }
   if(!python)throw Error('Install Python 3.12 or newer, then run npm run interview:setup again.');
   await run(python,['-m','venv',interviewEnvironment]);
  }
 }
 const requirements=['-r',join(interviewPythonRoot,'requirements.lock'),'-r',join(interviewPythonRoot,'requirements-google.lock')];
 if(uv)await run('uv',['pip','install','--python',local,...requirements]);
 else{if(!await available(local,['-m','pip','--version']))await run(local,['-m','ensurepip']);await run(local,['-m','pip','install','--disable-pip-version-check',...requirements])}
}
const status=await probeInterviewPython();
console.log(JSON.stringify({interview_runtime:status.coreReady?'ready':'unavailable',google_libraries:status.googleReady,python_version:status.version,missing:status.missing,account_connected:'not_checked',model_login:'not_checked'}));
if(!status.coreReady||!status.googleReady){console.error('Run npm run interview:setup. If INTERVIEW_PYTHON is set, it must identify a configured Python 3.12 environment.');process.exitCode=1}
