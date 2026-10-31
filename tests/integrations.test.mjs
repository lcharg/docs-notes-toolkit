import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const toolkit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const installer=path.join(toolkit,'scripts/integrations.mjs')
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'notes-plugin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root}
function run(...args){return spawnSync(process.execPath,[installer,...args],{encoding:'utf8'})}
for(const tool of ['claude','codex','cursor'])test(`${tool} project installation preserves complete runtime and four callable entries`,t=>{
 const root=fixture(t);const out=run('install','--tool',tool,'--root',root);assert.equal(out.status,0,out.stderr)
 const location={claude:'.claude/skills',codex:'.agents/skills',cursor:'.cursor/skills'}[tool]
 for(const phase of ['bootstrap','update','curate','promote']){
  const entry=path.join(root,location,`docs-notes-${phase}/SKILL.md`);const text=fs.readFileSync(entry,'utf8');assert.match(text,new RegExp(`docs-notes-${phase}`));assert.match(text,/scripts\/docs-notes.mjs/)
  for(const match of text.matchAll(/\]\(([^)]+)\)/g))assert.ok(fs.existsSync(path.resolve(path.dirname(entry),match[1])))
 }
 const cli=path.join(root,'docs-notes-toolkit/scripts/docs-notes.mjs')
 const init=spawnSync(process.execPath,[cli,'init','--root',root],{encoding:'utf8'});assert.equal(init.status,0,init.stderr)
 const gate=spawnSync(process.execPath,[cli,'gate','--config',path.join(root,'docs/maintenance.json'),'--phase','bootstrap'],{encoding:'utf8'});assert.equal(gate.status,0,gate.stderr)
 if(tool==='codex')for(const phase of ['bootstrap','update','curate','promote'])assert.match(fs.readFileSync(path.join(root,location,`docs-notes-${phase}/agents/openai.yaml`),'utf8'),/allow_implicit_invocation: false/)
 assert.equal(run('install','--tool',tool,'--root',root).status,0)
})
test('installer preflights entry collisions without copying runtime',t=>{
 const root=fixture(t);const file=path.join(root,'.cursor/skills/docs-notes-update/SKILL.md');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'user data')
 const out=run('install','--tool','cursor','--root',root);assert.equal(out.status,1);assert.equal(fs.readFileSync(file,'utf8'),'user data');assert.equal(fs.existsSync(path.join(root,'docs-notes-toolkit')),false)
})
test('installer rejects traversal, unknown tools and symlink destinations',t=>{
 const root=fixture(t);assert.equal(run('install','--tool','other','--root',root).status,2);assert.equal(run('install','--tool','all','--root',root,'--runtime','../escape').status,2)
 const outside=fixture(t);try{fs.symlinkSync(outside,path.join(root,'.agents'),'junction')}catch(error){if(['EPERM','EACCES'].includes(error.code))return t.skip(error.code);throw error}
 assert.equal(run('install','--tool','codex','--root',root).status,1);assert.equal(fs.readdirSync(outside).length,0)
})
test('native manifests resolve the same four canonical skills',()=>{
 for(const vendor of ['claude','codex','cursor']){const manifest=JSON.parse(fs.readFileSync(path.join(toolkit,`.${vendor}-plugin/plugin.json`),'utf8'));assert.equal(manifest.name,'docs-notes');assert.ok(manifest.version);for(const p of manifest.skills?[manifest.skills].flat():['./skills'])assert.ok(fs.existsSync(path.join(toolkit,p)))}
 assert.equal(run('validate').status,0)
})
test('installer does not recurse when target project is inside plugin source',t=>{
 const root=fixture(t);const cache=path.join(root,'cache');fs.cpSync(toolkit,cache,{recursive:true});const nested=path.join(cache,'nested-project');fs.mkdirSync(nested)
 const out=spawnSync(process.execPath,[path.join(cache,'scripts/integrations.mjs'),'install','--tool','all','--root',nested],{encoding:'utf8'})
 assert.equal(out.status,2)
 assert.equal(fs.existsSync(path.join(nested,'docs-notes-toolkit')),false)
})
test('repository installation excludes Git metadata dependencies and local secrets',t=>{
 const root=fixture(t),cache=path.join(root,'repository');fs.cpSync(toolkit,cache,{recursive:true});const target=path.join(root,'target');fs.mkdirSync(target)
 for(const name of ['.git/config','node_modules/local/index.js','.env','.env.local','private.key']){const file=path.join(cache,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'local-only test data')}
 const out=spawnSync(process.execPath,[path.join(cache,'scripts/integrations.mjs'),'install','--tool','all','--root',target],{encoding:'utf8'});assert.equal(out.status,0,out.stderr)
 for(const name of ['.git','node_modules','.env','.env.local','private.key'])assert.equal(fs.existsSync(path.join(target,'docs-notes-toolkit',name)),false,name)
 assert.ok(fs.existsSync(path.join(target,'docs-notes-toolkit/.claude-plugin/plugin.json')))
 assert.ok(fs.existsSync(path.join(target,'docs-notes-toolkit/.agents/plugins/marketplace.json')))
})
test('copied and renamed plugin installs without source repository',t=>{
 const root=fixture(t),cache=path.join(root,'cached plugin');fs.cpSync(toolkit,cache,{recursive:true});const target=path.join(root,'project space');fs.mkdirSync(target)
 const out=spawnSync(process.execPath,[path.join(cache,'scripts/integrations.mjs'),'install','--tool','all','--root',target,'--runtime','tools/knowledge-kit'],{encoding:'utf8'});assert.equal(out.status,0,out.stderr)
 const cli=path.join(target,'tools/knowledge-kit/scripts/docs-notes.mjs');assert.equal(spawnSync(process.execPath,[cli,'init','--root',target],{encoding:'utf8'}).status,0)
})
