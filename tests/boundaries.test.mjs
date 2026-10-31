import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, cpSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const toolkit = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function project(t) {
  const root = mkdtempSync(join(tmpdir(), 'docs-gate-boundary-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  cpSync(toolkit, join(root, 'kit'), { recursive: true })
  const cli = join(root, 'kit/scripts/docs-notes.mjs')
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
  const init = run('init', '--root', root)
  assert.equal(init.status, 0, init.stderr)
  const config = 'docs/maintenance.json'
  const put = (name, text) => { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), text) }
  const edit = fn => { const c = JSON.parse(readFileSync(join(root, config), 'utf8')); fn(c); put(config, JSON.stringify(c)) }
  return { root, run, config, put, edit }
}
test('alphabetic and fenced placeholders are rejected, valid HTML is not', t => {
  const p = project(t)
  p.put('docs/unfinished.md', '# Unfinished\n\n<subject>\n\n```text\n{{actual_input}}\n```\n')
  assert.equal(p.run('check', '--config', p.config).status, 1)
  p.put('docs/unfinished.md', '# Finished\n\n<details><summary>Details</summary>Verified.</details>\n')
  assert.equal(p.run('check', '--config', p.config).status, 0)
})
test('query paths, duplicate heading fragments and reference definitions are checked', t => {
  const p = project(t)
  p.put('docs/page.md', '# Page\n\n## Part\n\n## Part\n\n[query](page.md?view=raw#part-1)\n')
  assert.equal(p.run('check', '--config', p.config).status, 0)
  p.put('docs/page.md', '# Page\n\n[missing]\n\n[missing]: absent.md\n')
  assert.equal(p.run('check', '--config', p.config).status, 1)
})
test('ownership sources cannot escape through symlinks', t => {
  const p = project(t)
  const outside = mkdtempSync(join(tmpdir(), 'docs-gate-outside-'))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  writeFileSync(join(outside, 'private.txt'), 'not project data')
  try { symlinkSync(outside, join(p.root, 'outside'), 'junction') }
  catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return t.skip(`symlink unavailable: ${error.code}`); throw error }
  p.edit(c => { c.ownership = [{ topic: 'secrets', document: 'docs/index.md', sources: ['outside/private.txt'] }] })
  assert.notEqual(p.run('check', '--config', p.config).status, 0)
  assert.notEqual(p.run('snapshot', '--config', p.config, '--output', 'base.json').status, 0)
  assert.equal(existsSync(join(p.root, 'base.json')), false)
})
test('init rejects overlapping directories before any output is written', t => {
  const p = project(t)
  const target = join(p.root, 'child')
  mkdirSync(target); cpSync(toolkit, join(target, 'kit'), { recursive: true })
  const out = spawnSync(process.execPath, [join(target, 'kit/scripts/docs-notes.mjs'), 'init', '--root', target, '--docs', 'manual', '--notes', 'manual/notes'], { encoding: 'utf8' })
  assert.notEqual(out.status, 0)
  assert.equal(existsSync(join(target, 'manual/index.md')), false)
})
test('status mappings reject overlapping values and support hyphenated names', t => {
  const p = project(t)
  p.edit(c => { c.statuses.active = ['in-use'] })
  p.put('.agent/notes/topic.md', '# Topic\n\nStatus: in-use\n')
  assert.equal(p.run('check', '--config', p.config).status, 0)
  p.edit(c => { c.statuses.proposed = ['in-use'] })
  assert.equal(p.run('check', '--config', p.config).status, 2)
})
test('toolkitRoot cannot hide all managed documentation',t=>{
  const p=project(t);p.edit(c=>{c.toolkitRoot='.'});p.put('docs/unchecked.md','# Topic\n\n[bad](missing.md)\n')
  assert.equal(p.run('check','--config',p.config).status,2)
})
test('init generated entry and policy describe the executable lifecycle',t=>{
  const p=project(t)
  assert.match(readFileSync(join(p.root,'AGENTS.md'),'utf8'),/snapshot/)
  assert.match(readFileSync(join(p.root,'AGENTS.md'),'utf8'),/gate/)
  assert.match(readFileSync(join(p.root,'.agent/notes/policy.md'),'utf8'),/proposed/)
  assert.match(readFileSync(join(p.root,'.agent/notes/policy.md'),'utf8'),/archive/)
})
test('known but irrelevant CLI flags are usage errors', t => {
  const p = project(t)
  assert.equal(p.run('check', '--config', p.config, '--phase', 'promote').status, 2)
})
test('init refuses a symlinked output before writing external files', t => {
  const p = project(t)
  const outside = mkdtempSync(join(tmpdir(), 'docs-init-outside-'))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  const target = join(p.root, 'new-target')
  mkdirSync(target); cpSync(toolkit, join(target, 'kit'), { recursive: true })
  try { symlinkSync(outside, join(target, 'docs'), 'junction') }
  catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return t.skip(`symlink unavailable: ${error.code}`); throw error }
  const out = spawnSync(process.execPath, [join(target, 'kit/scripts/docs-notes.mjs'), 'init', '--root', target], { encoding: 'utf8' })
  assert.notEqual(out.status, 0)
  assert.equal(existsSync(join(outside, 'index.md')), false)
  assert.equal(existsSync(join(target, 'AGENTS.md')), false)
})
test('archive admission preserves relative link targets during relocation', t => {
  const p = project(t)
  const body = '# Note\n\nStatus: active\n\n[Config](../../docs/index.md)\n'
  p.put('.agent/notes/item.md', body)
  assert.equal(p.run('snapshot', '--config', p.config, '--output', 'base.json').status, 0)
  rmSync(join(p.root, '.agent/notes/item.md'))
  p.put('.agent/notes/archive/item.md', 'Archived: 2026-10-31\n' + body.replace('../../docs/', '../../../docs/'))
  p.put('report.json', JSON.stringify({ version: 1, phase: 'curate', decisions: [{ path: '.agent/notes/archive/item.md', action: 'archived', from: '.agent/notes/item.md', documents: [], reason: 'completed historical choice' }], promotions: [] }))
  const out = p.run('gate', '--config', p.config, '--phase', 'curate', '--baseline', 'base.json', '--report', 'report.json')
  assert.equal(out.status, 0, out.stderr)
})
test('promotion cannot claim a changed untracked file as its formal target', t => {
  const p = project(t)
  p.put('.agent/notes/source.md', '# Source\n\nStatus: active\n')
  p.put('elsewhere.md', '# Existing\n')
  p.put('evidence.txt', 'present')
  assert.equal(p.run('snapshot', '--config', p.config, '--output', 'base.json').status, 0)
  p.put('elsewhere.md', '# Changed\n')
  p.put('report.json', JSON.stringify({ version: 1, phase: 'promote', decisions: [], promotions: [{ source: '.agent/notes/source.md', target: 'elsewhere.md', evidence: ['evidence.txt'], reason: 'wrong target' }] }))
  const out = p.run('gate', '--config', p.config, '--phase', 'promote', '--baseline', 'base.json', '--report', 'report.json')
  assert.equal(out.status, 1)
  assert.match(out.stderr, /PROMOTION/)
})
test('updated owner document satisfies source change without redundant source decision', t => {
  const p=project(t)
  p.put('source.txt','old'); p.put('docs/rule.md','# Old\n')
  p.edit(c=>{c.ownership=[{topic:'rule',document:'docs/rule.md',sources:['source.txt']}]})
  assert.equal(p.run('snapshot','--config',p.config,'--output','base.json').status,0)
  p.put('source.txt','new');p.put('docs/rule.md','# New\n')
  p.put('report.json',JSON.stringify({version:1,phase:'update',decisions:[{path:'docs/rule.md',action:'updated',documents:['docs/rule.md'],reason:'synchronized rule'}],promotions:[]}))
  const out=p.run('gate','--config',p.config,'--phase','update','--baseline','base.json','--report','report.json')
  assert.equal(out.status,0,out.stderr)
})
test('malformed existing JSON config cannot cause partial init writes', t=>{
  const p=project(t); const target=join(p.root,'new-project');mkdirSync(target);cpSync(toolkit,join(target,'kit'),{recursive:true})
  mkdirSync(join(target,'docs'));writeFileSync(join(target,'docs/maintenance.json'),'{}')
  const out=spawnSync(process.execPath,[join(target,'kit/scripts/docs-notes.mjs'),'init','--root',target],{encoding:'utf8'})
  assert.notEqual(out.status,0)
  assert.equal(existsSync(join(target,'docs/index.md')),false)
  assert.equal(existsSync(join(target,'AGENTS.md')),false)
})
test('promotion rejects an existing outside-root evidence path',t=>{
  const p=project(t);const external=join(dirname(p.root),'existing-evidence-'+Date.now()+'.txt');writeFileSync(external,'external');t.after(()=>rmSync(external,{force:true}))
  p.put('.agent/notes/source.md','# Source\n\nStatus: active\n');p.put('docs/rule.md','# Old\n')
  assert.equal(p.run('snapshot','--config',p.config,'--output','base.json').status,0)
  p.put('docs/rule.md','# New\n')
  p.put('report.json',JSON.stringify({version:1,phase:'promote',decisions:[{path:'docs/rule.md',action:'updated',documents:[],reason:'updated'}],promotions:[{source:'.agent/notes/source.md',target:'docs/rule.md',evidence:[external],reason:'invalid outside evidence'}]}))
  assert.equal(p.run('gate','--config',p.config,'--phase','promote','--baseline','base.json','--report','report.json').status,1)
})
test('copied renamed toolkit supports custom nested entry and non-root invocation',t=>{
  const p=project(t);const target=join(p.root,'renamed-project');mkdirSync(target);cpSync(toolkit,join(target,'tools/knowledge-kit'),{recursive:true})
  const cli=join(target,'tools/knowledge-kit/scripts/docs-notes.mjs')
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:target,encoding:'utf8'})
  assert.equal(run('init','--root',target,'--docs','handbook','--notes','decisions','--entry','config/AGENTS.md').status,0)
  mkdirSync(join(target,'source'))
  const out=spawnSync(process.execPath,[cli,'gate','--config','../handbook/maintenance.json','--phase','bootstrap'],{cwd:join(target,'source'),encoding:'utf8'})
  assert.equal(out.status,0,out.stderr)
})
test('gate rejects unchanged action on modified documentation',t=>{
  const p=project(t);p.put('docs/rule.md','# Old\n')
  assert.equal(p.run('snapshot','--config',p.config,'--output','base.json').status,0)
  p.put('docs/rule.md','# New\n')
  p.put('report.json',JSON.stringify({version:1,phase:'update',decisions:[{path:'docs/rule.md',action:'unchanged',documents:[],reason:'claims unchanged despite diff'}],promotions:[]}))
  const out=p.run('gate','--config',p.config,'--phase','update','--baseline','base.json','--report','report.json')
  assert.equal(out.status,1)
})
test('current managed symlink cannot disappear silently from scan',t=>{
  const p=project(t);const outside=mkdtempSync(join(tmpdir(),'docs-scan-outside-'));t.after(()=>rmSync(outside,{recursive:true,force:true}))
  writeFileSync(join(outside,'note.md'),'# Unchecked\n')
  try{symlinkSync(outside,join(p.root,'docs/hidden'),'junction')}catch(error){if(['EPERM','EACCES','ENOSYS'].includes(error.code))return t.skip(error.code);throw error}
  assert.notEqual(p.run('check','--config',p.config).status,0)
})
test('complete copied toolkit executes CLI regression suite without original project',t=>{
  const p=project(t)
  const copy=join(p.root,'kit')
  const env={...process.env};delete env.NODE_TEST_CONTEXT
  const out=spawnSync(process.execPath,['--test',join(copy,'tests/cli.test.mjs')],{cwd:p.root,encoding:'utf8',env})
  assert.equal(out.status,0,out.stdout+'\n'+out.stderr)
  assert.match(out.stdout,/tests 19|"tests":19/)
})
test('promotion target must be inside formal docs and evidence must stay inside root', t => {
  const p = project(t)
  p.put('.agent/notes/source.md', '# Source\n\nStatus: active\n')
  p.put('elsewhere.md', '# Existing\n')
  assert.equal(p.run('snapshot', '--config', p.config, '--output', 'base.json').status, 0)
  p.put('elsewhere.md', '# Changed\n')
  p.put('report.json', JSON.stringify({ version: 1, phase: 'promote', decisions: [], promotions: [{ source: '.agent/notes/source.md', target: 'elsewhere.md', evidence: ['../not-project'], reason: 'not valid' }] }))
  const out = p.run('gate', '--config', p.config, '--phase', 'promote', '--baseline', 'base.json', '--report', 'report.json')
  assert.equal(out.status, 1)
  assert.match(out.stderr, /PROMOTION|PATH/)
})
