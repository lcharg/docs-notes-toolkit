#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const phases=['bootstrap','update','curate','promote']
const roots={claude:'.claude/skills',codex:'.agents/skills',cursor:'.cursor/skills'}
const slash=p=>p.split(path.sep).join('/')
const contained=(root,p)=>{const r=path.relative(root,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r))}
class Failure extends Error{constructor(message,code=1){super(message);this.code=code}}
function safe(root,target){if(!contained(root,target))throw new Failure('path escapes target root',2);let current=root;for(const part of path.relative(root,target).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.lstatSync(current,{throwIfNoEntry:false})?.isSymbolicLink())throw new Failure(`symlink destination is not allowed: ${current}`)}}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(['.git','node_modules','.DS_Store'].includes(e.name)||/^\.env(?:\.|$)/.test(e.name)||/\.(?:key|pem|p12|pfx)$/i.test(e.name))return[];const p=path.join(dir,e.name);if(e.isSymbolicLink())throw new Failure(`source symlink is not supported: ${p}`);return e.isDirectory()?files(p):[p]})}
function parse(args){const command=args.shift();if(command==='--help')return{command};if(!['install','validate'].includes(command))throw new Failure('use install or validate',2);const options={};while(args.length){const key=args.shift();if(!['--tool','--root','--runtime'].includes(key)||options[key])throw new Failure(`unknown or duplicate option ${key}`,2);const value=args.shift();if(!value||value.startsWith('--'))throw new Failure(`missing value ${key}`,2);options[key]=value}if(command==='validate'&&Object.keys(options).length)throw new Failure('validate takes no options',2);return{command,options}}
function validate(){for(const tool of Object.keys(roots)){const file=path.join(source,`.${tool}-plugin/plugin.json`);const manifest=JSON.parse(fs.readFileSync(file,'utf8'));if(manifest.name!=='docs-notes'||!/^\d+\.\d+\.\d+$/.test(manifest.version))throw new Failure(`invalid manifest ${file}`)}for(const phase of phases){const text=fs.readFileSync(path.join(source,`skills/docs-notes-${phase}/SKILL.md`),'utf8');if(!text.startsWith('---\n')||!text.includes(`name: docs-notes-${phase}`))throw new Failure(`invalid skill ${phase}`)}for(const file of ['scripts/docs-notes.mjs','scripts/markdown.mjs','templates/maintenance.config.json','templates/workflow-report.json'])if(!fs.existsSync(path.join(source,file)))throw new Failure(`missing runtime ${file}`);console.log('Plugin manifests, four canonical skills and complete runtime: PASS')}
function install(o){if(!o['--root']||!['all',...Object.keys(roots)].includes(o['--tool']))throw new Failure('install requires --root DIR --tool claude|codex|cursor|all',2)
 const root=path.resolve(o['--root']);if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw new Failure('target root must already exist',2)
 const runtime=o['--runtime']??'docs-notes-toolkit';if(path.isAbsolute(runtime))throw new Failure('--runtime must be relative to target root',2)
 const destination=path.resolve(root,runtime);safe(root,destination)
 if(destination===root||contained(source,destination)&&destination!==source)throw new Failure('runtime cannot contain target root or recurse into source',2)
 const tools=o['--tool']==='all'?Object.keys(roots):[o['--tool']];const writes=[]
 for(const file of files(source)){const target=path.join(destination,path.relative(source,file));safe(root,target);const bytes=fs.readFileSync(file);if(fs.existsSync(target)){if(!fs.statSync(target).isFile()||!fs.readFileSync(target).equals(bytes))throw new Failure(`runtime collision: ${target}; use a new runtime location or review the existing copy`)}else writes.push({target,bytes})}
 for(const tool of tools)for(const phase of phases){const dir=path.join(root,roots[tool],`docs-notes-${phase}`);const target=path.join(dir,'SKILL.md');safe(root,target)
 const canonical=path.join(destination,`skills/docs-notes-${phase}/SKILL.md`);const script=path.join(destination,'scripts/docs-notes.mjs')
 const body=`---\nname: docs-notes-${phase}\ndescription: Use when explicitly running the ${phase} documentation and decision-note workflow.\ndisable-model-invocation: true\n---\n\n# Documentation ${phase}\n\nRead [the canonical workflow](${slash(path.relative(dir,canonical))}) and [automation instructions](${slash(path.relative(dir,path.join(destination,'AUTOMATION.md')))}) before acting.\n\nThe project-local CLI is \`${slash(path.relative(root,script))}\`. Run it with Node from the verified target project root. Keep snapshot/check/gate failures blocking; do not substitute a fresh baseline after changes. Input paths and scope come from the user and project maintenance.json. Missing configuration uses bootstrap; existing configuration must be preserved.\n\nInstalling this entry does not initialize docs, authorize deletion or install CI/hooks. Preserve project approval settings.\n`
 if(fs.existsSync(target)){if(fs.readFileSync(target,'utf8')!==body)throw new Failure(`entry collision: ${target}; preserve existing user content`)}else writes.push({target,bytes:Buffer.from(body)})
 if(tool==='codex'){
  const metadata=path.join(dir,'agents/openai.yaml');safe(root,metadata)
  const yaml=`interface:\n  display_name: "Docs Notes ${phase}"\n  short_description: "Run the ${phase} documentation lifecycle"\n  default_prompt: "Use $docs-notes-${phase} for the explicitly requested project scope."\npolicy:\n  allow_implicit_invocation: false\n`
  if(fs.existsSync(metadata)){if(fs.readFileSync(metadata,'utf8')!==yaml)throw new Failure(`entry collision: ${metadata}; preserve existing metadata`)}else writes.push({target:metadata,bytes:Buffer.from(yaml)})
 }
 }
 for(const {target,bytes}of writes){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'})}
 console.log(`Installed ${tools.join(', ')} project entries; runtime: ${destination}; ${writes.length} files created. No global settings changed.`)
}
try{const {command,options}=parse(process.argv.slice(2));if(command==='--help')console.log('node scripts/integrations.mjs install --tool claude|codex|cursor|all --root DIR [--runtime RELATIVE_PATH]\nnode scripts/integrations.mjs validate');else if(command==='validate')validate();else{validate();install(options)}}catch(error){console.error(`[INTEGRATION] ${error.message}; resolve the input or collision before retrying`);process.exitCode=error.code??1}
