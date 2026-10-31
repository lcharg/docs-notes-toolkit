import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolkit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(toolkit, 'scripts', 'docs-notes.mjs');
async function fixture(t, installToolkit = true) {
  const dir = await mkdtemp(path.join(tmpdir(), 'docs-notes-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  if (installToolkit) {
    const { cp } = await import('node:fs/promises');
    await cp(toolkit, path.join(dir, 'docs-notes-toolkit'), { recursive: true });
  }
  return dir;
}
function run(cwd, ...args) {
  const localCli = path.join(cwd, 'docs-notes-toolkit', 'scripts', 'docs-notes.mjs');
  return spawnSync(process.execPath, [localCli, ...args], { cwd, encoding: 'utf8' });
}

test('help succeeds and unknown commands are usage errors', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  const unknown = spawnSync(process.execPath, [cli, 'unknown'], { encoding: 'utf8' });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /CLI|command/i);
});

test('init generates project files and is idempotent', async t => {
  const root = await fixture(t);
  const first = run(root, 'init', '--root', root);
  assert.equal(first.status, 0, first.stderr);
  const config = await readFile(path.join(root, 'docs', 'maintenance.json'), 'utf8');
  const second = run(root, 'init', '--root', root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(path.join(root, 'docs', 'maintenance.json'), 'utf8'), config);
  const entry=await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(entry.match(/DOCS_NOTES_TOOLKIT:START/g)?.length, 1);
  for(const skill of ['bootstrap','update','curate','promote']) assert.match(entry,new RegExp(`\\]\\(docs-notes-toolkit/skills/docs-notes-${skill}/SKILL\\.md\\)`));
  const check=run(root,'check','--config','docs/maintenance.json'); assert.equal(check.status,0,check.stderr);
});

test('check reports missing required configuration as invalid input', async t => {
  const root = await fixture(t);
  const result = run(root, 'check', '--config', 'missing.json');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CONFIG|config/i);
});

test('init refuses collisions without partially creating other targets', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'index.md'), 'unrelated');
  const result = run(root, 'init', '--root', root);
  assert.equal(result.status, 1);
  assert.equal(await readFile(path.join(root, 'docs', 'index.md'), 'utf8'), 'unrelated');
  await assert.rejects(readFile(path.join(root, 'docs', 'maintenance.json')));
});

async function initProject(t) {
  const root = await fixture(t);
  const init = run(root, 'init', '--root', root);
  assert.equal(init.status, 0, init.stderr);
  return { root, cliPath: path.join(root, 'docs-notes-toolkit', 'scripts', 'docs-notes.mjs'), config: 'docs/maintenance.json' };
}
function runAt(cliPath, cwd, ...args) { return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8' }); }
async function file(root, name, content) {
  const target = path.join(root, name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content); return target;
}

test('check catches missing link target and unresolved reference', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'docs/topic.md','# Topic\n\n[missing](absent.md) and [unknown][nope].\n');
  const result=runAt(cliPath,root,'check','--config',config);
  assert.equal(result.status,1); assert.match(result.stderr,/LINK .*absent\.md/); assert.match(result.stderr,/unresolved reference/);
});

test('check ignores fenced and inline code but validates heading anchors', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'docs/topic.md','# Topic\n\n`literal <placeholder> [x](missing)`\n\n```md\n[x](missing)\n```\n\n[bad](#missing-heading)\n');
  const result=runAt(cliPath,root,'check','--config',config);
  assert.equal(result.status,1); assert.match(result.stderr,/ANCHOR/); assert.doesNotMatch(result.stderr,/TEMPLATE|LINK/);
});

test('check validates primary note status and rejection rationale', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'.agent/notes/a.md','# Note\n\nStatus: rejected\n\n## Context\nStatus: active\n');
  const result=runAt(cliPath,root,'check','--config',config);
  assert.equal(result.status,1); assert.match(result.stderr,/rejected note needs a reason/);
});

test('snapshot is exclusive, contains hashes and rejects tampering', async t => {
  const {root,cliPath,config}=await initProject(t);
  const out=path.join(root,'baseline.json');
  const result=runAt(cliPath,root,'snapshot','--config',config,'--output',out);
  assert.equal(result.status,0,result.stderr);
  const baseline=JSON.parse(await readFile(out,'utf8')); assert.equal(baseline.version,1); assert.ok(baseline.files['docs/index.md'].sha256);
  assert.equal(runAt(cliPath,root,'snapshot','--config',config,'--output',out).status,1);
  baseline.files['docs/index.md'].text += 'tamper'; await writeFile(out,JSON.stringify(baseline));
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'update',decisions:[],promotions:[]}));
  const gate=runAt(cliPath,root,'gate','--config',config,'--phase','update','--baseline',out,'--report',report);
  assert.equal(gate.status,2); assert.match(gate.stderr,/integrity failure/);
});

test('bootstrap gate succeeds; non-bootstrap requires baseline and report', async t => {
  const {root,cliPath,config}=await initProject(t);
  const boot=runAt(cliPath,root,'gate','--config',config,'--phase','bootstrap'); assert.equal(boot.status,0,boot.stderr);
  const missing=runAt(cliPath,root,'gate','--config',config,'--phase','update'); assert.equal(missing.status,2);
  const invalid=runAt(cliPath,root,'gate','--config',config,'--phase','bogus'); assert.equal(invalid.status,2);
});

test('update gate requires decisions for changed files and stale ownership documentation', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'docs/owned.md','# Owned\\n'); await file(root,'src/input.txt','one');
  const cfg=JSON.parse(await readFile(path.join(root,config),'utf8'));
  cfg.ownership=[{topic:'source',document:'docs/owned.md',sources:['src/input.txt']}];
  await writeFile(path.join(root,config),JSON.stringify(cfg,null,2));
  const baseline=path.join(root,'baseline.json');
  assert.equal(runAt(cliPath,root,'snapshot','--config',config,'--output',baseline).status,0);
  await file(root,'src/input.txt','two');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'update',decisions:[],promotions:[]}));
  const failed=runAt(cliPath,root,'gate','--config',config,'--phase','update','--baseline',baseline,'--report',report);
  assert.equal(failed.status,1); assert.match(failed.stderr,/changed source requires updated owner document/);
});

test('archive snapshot bytes are frozen across later gates', async t => {
  const {root,cliPath,config}=await initProject(t);
  const archive=await file(root,'.agent/notes/archive/old.md','# Old\\n');
  const baseline=path.join(root,'baseline.json');
  assert.equal(runAt(cliPath,root,'snapshot','--config',config,'--output',baseline).status,0);
  await writeFile(archive,'# Mutated\\n');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'curate',decisions:[],promotions:[]}));
  const result=runAt(cliPath,root,'gate','--config',config,'--phase','curate','--baseline',baseline,'--report',report);
  assert.equal(result.status,1); assert.match(result.stderr,/ARCHIVE frozen file changed/);
});

test('promotion rejects proposed sources even if report claims promotion', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'docs/target.md','# Existing\n');
  await file(root,'.agent/notes/source.md','# Note\n\nStatus: proposed\n');
  await file(root,'evidence.txt','proof');
  const baseline=path.join(root,'baseline.json');
  const baseSnap=runAt(cliPath,root,'snapshot','--config',config,'--output',baseline); assert.equal(baseSnap.status,0,baseSnap.stderr);
  await file(root,'docs/target.md','# Changed\\n');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'promote',decisions:[],promotions:[{source:'.agent/notes/source.md',target:'docs/target.md',evidence:['evidence.txt'],reason:'Proof'}]}));
  const result=runAt(cliPath,root,'gate','--config',config,'--phase','promote','--baseline',baseline,'--report',report);
  assert.equal(result.status,1); assert.match(result.stderr,/source must be active/);
});

test('all four phases accept valid report and promotion stays active', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'docs/target.md','# Old\n'); await file(root,'evidence.txt','evidence');
  await file(root,'.agent/notes/source.md','# Source\n\nStatus: active\n');
  const baseline=path.join(root,'base.json'); const initial=runAt(cliPath,root,'snapshot','--config',config,'--output',baseline); assert.equal(initial.status,0,initial.stderr);
  await file(root,'docs/target.md','# New\\n');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'promote',decisions:[{path:'docs/target.md',action:'updated',documents:['docs/target.md'],reason:'Evidence reviewed'}],promotions:[{source:'.agent/notes/source.md',target:'docs/target.md',evidence:['evidence.txt'],reason:'Evidence supports durable guidance'}]}));
  const result=runAt(cliPath,root,'gate','--config',config,'--phase','promote','--baseline',baseline,'--report',report);
  assert.equal(result.status,0,result.stderr);
});

test('check reports duplicate ownership topics and unknown config fields', async t => {
  const {root,cliPath,config}=await initProject(t);
  const cfg=JSON.parse(await readFile(path.join(root,config),'utf8'));
  cfg.ownership=[{topic:'same',document:'docs/index.md',sources:[]},{topic:'same',document:'docs/index.md',sources:[]}];
  await writeFile(path.join(root,config),JSON.stringify(cfg));
  const result=runAt(cliPath,root,'check','--config',config); assert.equal(result.status,1); assert.match(result.stderr,/duplicate topic/);
  cfg.unexpected=true; await writeFile(path.join(root,config),JSON.stringify(cfg));
  const malformed=runAt(cliPath,root,'check','--config',config); assert.equal(malformed.status,2); assert.match(malformed.stderr,/unknown field/);
});

test('gate rejects ownership narrowing and status policy drift from baseline', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'docs/owner.md','# Owner\n'); await file(root,'source.txt','old');
  const cfg=JSON.parse(await readFile(path.join(root,config),'utf8'));
  cfg.ownership=[{topic:'topic',document:'docs/owner.md',sources:['source.txt']}]; await writeFile(path.join(root,config),JSON.stringify(cfg));
  const baseline=path.join(root,'base.json'); const snap=runAt(cliPath,root,'snapshot','--config',config,'--output',baseline); assert.equal(snap.status,0,snap.stderr);
  cfg.ownership=[]; await writeFile(path.join(root,config),JSON.stringify(cfg)); await file(root,'source.txt','new');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'update',decisions:[],promotions:[]}));
  const narrowed=runAt(cliPath,root,'gate','--config',config,'--phase','update','--baseline',baseline,'--report',report);
  assert.equal(narrowed.status,2); assert.match(narrowed.stderr,/ownership mapping removed/);
  cfg.ownership=[{topic:'topic',document:'docs/owner.md',sources:['source.txt']}]; cfg.statuses.active=['active','current']; await writeFile(path.join(root,config),JSON.stringify(cfg));
  const drift=runAt(cliPath,root,'gate','--config',config,'--phase','update','--baseline',baseline,'--report',report);
  assert.equal(drift.status,2); assert.match(drift.stderr,/incompatible config (?:identity field|setting) statuses/);
});

test('new archive paths cannot bypass archive admission with updated action', async t => {
  const {root,cliPath,config}=await initProject(t);
  await file(root,'.agent/notes/proposed.md','# Note\n\nStatus: proposed\n');
  const baseline=path.join(root,'base.json'); assert.equal(runAt(cliPath,root,'snapshot','--config',config,'--output',baseline).status,0);
  await file(root,'.agent/notes/archive/spoof.md','# Spoof\n');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'curate',decisions:[{path:'.agent/notes/archive/spoof.md',action:'updated',documents:[],reason:'try bypass'}],promotions:[]}));
  const result=runAt(cliPath,root,'gate','--config',config,'--phase','curate','--baseline',baseline,'--report',report);
  assert.equal(result.status,1); assert.match(result.stderr,/archive additions require action archived/);
});

test('archive transition accepts preserved active note and rejects arbitrary source/path', async t => {
  const {root,cliPath,config}=await initProject(t);
  const source='.agent/notes/source.md'; await file(root,source,'# Note\n\nStatus: active\n');
  const baseline=path.join(root,'base.json'); assert.equal(runAt(cliPath,root,'snapshot','--config',config,'--output',baseline).status,0);
  await file(root,'.agent/notes/archive/source.md','Archived: 2026-10-31\n\n# Note\n\nStatus: active\n'); await rm(path.join(root,source));
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'curate',decisions:[{path:'.agent/notes/archive/source.md',action:'archived',from:source,documents:[],reason:'Completed'}],promotions:[]}));
  const valid=runAt(cliPath,root,'gate','--config',config,'--phase','curate','--baseline',baseline,'--report',report);
  assert.equal(valid.status,0,valid.stderr);
});

test('unknown options are rejected and archive dates are validated on archive transitions', async t => {
  const {root,cliPath,config}=await initProject(t);
  const unknown=runAt(cliPath,root,'check','--config',config,'--wat'); assert.equal(unknown.status,2);
  await file(root,'.agent/notes/source.md','# Note\n\nStatus: active\n');
  const baseline=path.join(root,'base.json'); assert.equal(runAt(cliPath,root,'snapshot','--config',config,'--output',baseline).status,0);
  const source=path.join(root,'.agent/notes/source.md'); await writeFile(source,'# Note\n\nStatus: active\n');
  const report=await file(root,'report.json',JSON.stringify({version:1,phase:'curate',decisions:[{path:'.agent/notes/archive/source.md',action:'archived',from:'.agent/notes/source.md',documents:[],reason:'Archive it'},{path:'.agent/notes/source.md',action:'archived',from:'.agent/notes/source.md',documents:[],reason:'Moved to archive'}],promotions:[]}));
  await file(root,'.agent/notes/archive/source.md','Archived: 2026-02-31\n\n# Note\n\nStatus: active\n'); await rm(source);
  const result=runAt(cliPath,root,'gate','--config',config,'--phase','curate','--baseline',baseline,'--report',report);
  assert.equal(result.status,1); assert.match(result.stderr,/real Archived/);
});

test('toolkit CLI runs as a copied standalone Node tool', async t => {
  const root = await fixture(t, false);
  const copy = path.join(root, 'renamed-toolkit');
  await mkdir(copy, { recursive: true });
  // Copying is exercised without invoking package managers or project imports.
  const { cp } = await import('node:fs/promises');
  await cp(path.join(toolkit, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
  const copiedCli = path.join(copy, 'scripts', 'docs-notes.mjs');
  const help = spawnSync(process.execPath, [copiedCli, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
});
