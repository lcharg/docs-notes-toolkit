#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { maskCode, hasPlaceholder, anchors, links, localTarget } from './markdown.mjs';

const TOOLKIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- DOCS_NOTES_TOOLKIT:START -->';
const END = '<!-- DOCS_NOTES_TOOLKIT:END -->';
const USAGE = `docs-notes (Node >=20, no dependencies)\n  init --root DIR [--config PATH] [--docs DIR] [--notes DIR] [--entry PATH]\n  check --config PATH\n  snapshot --config PATH --output PATH\n  gate --config PATH --phase bootstrap|update|curate|promote [--baseline PATH --report PATH]`;
class CliError extends Error { constructor(message, code = 2) { super(message); this.code = code; } }
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');
function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { command: 'help' };
  const command = argv.shift();
  if (!['init','check','snapshot','gate'].includes(command)) throw new CliError(`CLI unknown command ${command ?? ''}`);
  const options = {};
  while (argv.length) {
    const key = argv.shift();
    if (!['--root','--config','--docs','--notes','--entry','--output','--phase','--baseline','--report'].includes(key)) throw new CliError(`CLI unknown option ${key}`);
    if (options[key]) throw new CliError(`CLI duplicate option ${key}`);
    const value = argv.shift();
    if (!value || value.startsWith('--')) throw new CliError(`CLI expected value after ${key}`);
    options[key] = value;
  }
  const allowed = { init: ['--root','--config','--docs','--notes','--entry'], check: ['--config'], snapshot: ['--config','--output'], gate: ['--config','--phase','--baseline','--report'] }[command];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new CliError(`CLI option ${key} is not valid for ${command}`);
  return { command, options };
}
function inside(root, p) { const r = path.relative(root, p); return r === '' || (!r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r)); }
function assertInside(root, p, label) { if (!inside(root, p)) throw new CliError(`CONFIG ${label} escapes repository root`, 2); }
function noSymlinkEscape(root, target) {
  let current = root;
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  for (const part of parts) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) { const real = fs.realpathSync(current); if (!inside(root, real)) throw new CliError(`CONFIG symlink escapes repository root: ${rel(root,current)}`,2); } }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
function readConfig(file) {
  if (!fs.existsSync(file)) throw new CliError(`CONFIG missing configuration ${file}`, 2);
  let c;
  try { c = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new CliError(`CONFIG invalid JSON: ${e.message}`, 2); }
  const keys = ['version','repoRoot','docsRoot','docsEntry','notesRoot','notesPolicy','archiveRoot','agentEntry','toolkitRoot','statusField','statuses','ownership'];
  if (!c || typeof c !== 'object' || keys.some(k => !(k in c))) throw new CliError('CONFIG missing required field');
  if (c.version !== 1 || !['repoRoot','docsRoot','docsEntry','notesRoot','notesPolicy','archiveRoot','agentEntry','toolkitRoot','statusField'].every(k => typeof c[k] === 'string' && c[k].trim().length) || !c.statuses || typeof c.statuses !== 'object' || Array.isArray(c.statuses) || !Array.isArray(c.ownership)) throw new CliError('CONFIG malformed required fields');
  const allowed = new Set(keys);
  if (Object.keys(c).some(k => !allowed.has(k))) throw new CliError('CONFIG unknown field');
  const base = path.dirname(file), root = path.resolve(base, c.repoRoot);
  const paths = {};
  for (const k of ['docsRoot','docsEntry','notesRoot','notesPolicy','archiveRoot','agentEntry','toolkitRoot']) {
    paths[k] = path.resolve(root, c[k]); assertInside(root, paths[k], k); noSymlinkEscape(root, paths[k]);
  }
  if (!inside(paths.notesRoot, paths.archiveRoot) || paths.notesRoot === paths.archiveRoot) throw new CliError('CONFIG archiveRoot must be a strict child of notesRoot');
  if (paths.docsRoot === paths.notesRoot || inside(paths.docsRoot, paths.notesRoot) || inside(paths.notesRoot, paths.docsRoot)) throw new CliError('CONFIG docsRoot and notesRoot may not overlap');
  if(paths.toolkitRoot!==TOOLKIT||paths.toolkitRoot===root||inside(paths.toolkitRoot,paths.docsRoot)||inside(paths.toolkitRoot,paths.notesRoot)||inside(paths.docsRoot,paths.toolkitRoot)||inside(paths.notesRoot,paths.toolkitRoot))throw new CliError('CONFIG toolkitRoot must name this complete toolkit outside managed docs/notes');
  noSymlinkEscape(root,file);assertInside(root,file,'config');
  for (const k of ['docsEntry','notesPolicy','agentEntry']) if (!inside(root, paths[k])) throw new CliError(`CONFIG ${k} escapes root`);
  const statusKeys = ['proposed','active','rejected'];
  if (statusKeys.some(k => !Array.isArray(c.statuses[k]) || !c.statuses[k].length || c.statuses[k].some(x => typeof x !== 'string')) || Object.keys(c.statuses).some(k => !statusKeys.includes(k))) throw new CliError('CONFIG malformed statuses');
  const values = Object.values(c.statuses).flat().map(v => v.trim().toLowerCase());
  if (values.some(v => !v || /[\r\n:]/.test(v)) || new Set(values).size !== values.length) throw new CliError('CONFIG status values must be nonempty and distinct across mappings');
  if (/[\r\n:]/.test(c.statusField)) throw new CliError('CONFIG invalid statusField');
  if (!inside(paths.docsRoot,paths.docsEntry) || !inside(paths.notesRoot,paths.notesPolicy) || inside(paths.archiveRoot,paths.notesPolicy)) throw new CliError('CONFIG entry/policy must belong to the corresponding current directory');
  for (const o of c.ownership) {
    if (!o || typeof o.topic !== 'string' || !o.topic.trim() || typeof o.document !== 'string' || !o.document || !Array.isArray(o.sources) || o.sources.some(s => typeof s !== 'string' || !s) || Object.keys(o).some(k=>!['topic','document','sources'].includes(k))) throw new CliError('CONFIG malformed ownership entry');
    for (const p of [o.document,...o.sources]) { const target=path.resolve(root,p); assertInside(root,target,p); noSymlinkEscape(root,target); }
    if (!inside(paths.docsRoot,path.resolve(root,o.document))) throw new CliError('CONFIG ownership document must belong to docsRoot');
  }
  return { c, file, root, paths, identity: { repoRoot: c.repoRoot, docsRoot: c.docsRoot, docsEntry: c.docsEntry, notesRoot: c.notesRoot, notesPolicy: c.notesPolicy, archiveRoot: c.archiveRoot, agentEntry: c.agentEntry, statusField: c.statusField, statuses: c.statuses } };
}
function writeAtomic(file, content, exclusive = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (exclusive && fs.existsSync(file)) throw new CliError(`INIT collision: ${file}`, 1);
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(tmp, content, { flag: 'wx' }); fs.renameSync(tmp, file); }
  catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
}
function init(o) {
  if (!o['--root']) throw new CliError('CLI init requires --root');
  const root = path.resolve(o['--root']);
  const docsRel = o['--docs'] ?? 'docs'; const configRel = o['--config'] ?? path.join(docsRel,'maintenance.json');
  const notesRel = o['--notes'] ?? '.agent/notes'; const entryRel = o['--entry'] ?? 'AGENTS.md';
  for (const p of [configRel,docsRel,notesRel,entryRel]) {
    if (path.isAbsolute(p) || !inside(root,path.resolve(root,p))) throw new CliError(`CLI init path escapes root: ${p}`);
    noSymlinkEscape(root, path.resolve(root,p));
  }
  if (!inside(root, TOOLKIT)) throw new CliError('INIT toolkit is outside target root; copy docs-notes-toolkit into target first', 1);
  const configPath = path.resolve(root,configRel), docs = path.resolve(root,docsRel), notes = path.resolve(root,notesRel), entry = path.resolve(root,entryRel);
  if (inside(docs, notes) || inside(notes, docs) || inside(docs, TOOLKIT) || inside(notes, TOOLKIT)) throw new CliError('CONFIG docs, notes and toolkit directories may not overlap');
  if (fs.existsSync(configPath)) {
    const existing=readConfig(configPath);
    if(existing.root!==root||existing.paths.docsRoot!==docs||existing.paths.notesRoot!==notes||existing.paths.agentEntry!==entry||existing.paths.toolkitRoot!==TOOLKIT)throw new CliError('INIT existing config uses different paths; use its configured init options',1);
    const checked=configValidation(existing);if(checked.errors.length)throw new CliError(`INIT existing configuration failed checks: ${checked.errors.join('; ')}`,1);
    console.log('init reused existing configuration; no files changed');return 0;
  }
  const targets = [path.join(docs,'index.md'), path.join(notes,'policy.md'), configPath];
  if (new Set([...targets,entry]).size !== targets.length + 1) throw new CliError('CONFIG output paths must be distinct');
  for (const target of [...targets,entry]) noSymlinkEscape(root,target);
  const skillTargets=['bootstrap','update','curate','promote'].map(name=>path.join(TOOLKIT,`skills/docs-notes-${name}/SKILL.md`));
  for (const target of skillTargets) if (!fs.existsSync(target)) throw new CliError(`INIT incomplete toolkit: ${target}; copy the complete directory`,1);
  const fromEntry = target => rel(path.dirname(entry),target);
  const block = `${START}\n<!-- config: ${rel(root,configPath)} -->\n- [Machine configuration](${fromEntry(configPath)})\n- [Documentation index](${fromEntry(path.join(docs,'index.md'))})\n${skillTargets.map((p,i)=>`- [${['Bootstrap','Update','Curate','Promote'][i]} skill](${fromEntry(p)})`).join('\n')}\nRead the machine configuration first. Before changes run snapshot; after changes run the matching update, curate or promote gate with the trusted baseline and this task's report. Bootstrap uses its own gate. Nonzero exit blocks delivery. These instructions do not authorize deletion or publication and do not install CI/hooks.\n${END}`;
  const existingEntry = fs.existsSync(entry) ? fs.readFileSync(entry,'utf8') : '';
  const markerCount = (existingEntry.match(new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g')) ?? []).length;
  if (markerCount > 1 || (existingEntry.includes(START) !== existingEntry.includes(END))) throw new CliError('INIT malformed or duplicate managed block', 1);
  for (const target of targets) {
    if (fs.existsSync(target)) {
      const current = fs.readFileSync(target,'utf8');
      if (target === configPath) { try { JSON.parse(current); } catch { throw new CliError(`INIT refusing unrelated config ${target}`,1); } }
      else if (!current.includes('<!-- GENERATED BY DOCS-NOTES-TOOLKIT -->')) throw new CliError(`INIT collision: unrelated existing file ${target}`,1);
    }
  }
  const c = { version:1, repoRoot:path.relative(path.dirname(configPath),root).split(path.sep).join('/') || '.', docsRoot:docsRel, docsEntry:`${docsRel}/index.md`, notesRoot:notesRel, notesPolicy:`${notesRel}/policy.md`, archiveRoot:`${notesRel}/archive`, agentEntry:entryRel, toolkitRoot:path.relative(root,TOOLKIT).split(path.sep).join('/'), statusField:'Status', statuses:{ proposed:['proposed'],active:['active'],rejected:['rejected'] }, ownership:[] };
  for (const dir of [docs,notes,path.join(notes,'archive')]) fs.mkdirSync(dir,{recursive:true});
  if (!fs.existsSync(targets[0])) writeAtomic(targets[0], '<!-- GENERATED BY DOCS-NOTES-TOOLKIT -->\n# Documentation index\n\nAdd links to maintained documentation here.\n', true);
  if (!fs.existsSync(targets[1])) writeAtomic(targets[1], '<!-- GENERATED BY DOCS-NOTES-TOOLKIT -->\n# Notes policy\n\nFormal docs own current behavior and procedures; notes own problems, decisions, alternatives and consequences. proposed is unimplemented, active is implemented with useful rationale, rejected records an explicit rejection and reason. Keep useful rationale regardless of age; partial supersession retains its valid portion.\n\nBefore changes snapshot the checked state; after changes run the matching gate and report. Only completed active decisions without future guidance may enter archive/ with an Archived date and preserved body/link targets. Frozen history is not current authority. Deletion requires separate approval. Promotion retains rationale and never publishes proposals as current behavior.\n', true);
  if (!fs.existsSync(configPath)) writeAtomic(configPath, `${JSON.stringify(c,null,2)}\n`, true);
  if (!existingEntry.includes(START)) writeAtomic(entry, `${existingEntry}${existingEntry && !existingEntry.endsWith('\n')?'\n':''}${block}\n`);
  return 0;
}
function walk(root, skip = []) {
  const out=[]; if (!fs.existsSync(root)) return out;
  for (const ent of fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (['.git','node_modules'].includes(ent.name)) continue;
    const p=path.join(root,ent.name); if (skip.some(s=>p===s||inside(s,p))) continue;
    const st=fs.lstatSync(p); if (st.isSymbolicLink()) throw new CliError(`PATH ${p}: managed symlinks are not scanned; replace with regular files or move them outside managed scope`,1);
    if (st.isDirectory()) out.push(...walk(p,skip)); else if (ent.isFile() && p.endsWith('.md')) out.push(p);
  } return out;
}
function configValidation(x) {
  const {c,root,paths}=x, errors=[];
  const required=[paths.docsEntry,paths.notesPolicy,paths.agentEntry,x.file];
  for (const p of required) if (!fs.existsSync(p)) errors.push(`PATH ${rel(root,p)}: required file is missing; create it`);
  const owners=new Set();
  for (const o of c.ownership) {
    if (owners.has(o.topic)) errors.push(`OWNERSHIP ${o.topic}: duplicate topic; merge ownership entries`); owners.add(o.topic);
    const doc=path.resolve(root,o.document); if (!inside(root,doc)||!fs.existsSync(doc)) errors.push(`OWNERSHIP ${o.document}: document missing or outside root; correct mapping`);
    for (const s of o.sources) { const p=path.resolve(root,s); if(!inside(root,p)||!fs.existsSync(p)) errors.push(`OWNERSHIP ${s}: source missing or outside root; correct mapping`); }
  }
  if (fs.existsSync(paths.agentEntry)) {
    const text=fs.readFileSync(paths.agentEntry,'utf8');
    if ((text.match(new RegExp(START,'g'))||[]).length!==1 || (text.match(new RegExp(END,'g'))||[]).length!==1) errors.push(`NAV ${rel(root,paths.agentEntry)}: expected exactly one managed marker block; run init`);
    const begin=text.indexOf(START), finish=text.indexOf(END); const block=begin>=0&&finish>begin?text.slice(begin,finish+END.length):'';
    const expected=[x.file,paths.docsEntry,...['bootstrap','update','curate','promote'].map(name=>path.join(paths.toolkitRoot,`skills/docs-notes-${name}/SKILL.md`))];
    for (const target of expected) { const link=rel(path.dirname(paths.agentEntry),target); if(!block.includes(`](${link})`)) errors.push(`NAV ${rel(root,paths.agentEntry)}: missing managed link ${link}; restore managed navigation`); if(!fs.existsSync(target)) errors.push(`NAV ${rel(root,paths.agentEntry)}: linked target ${link} does not exist; restore the linked file`); }
    if (!block.includes(`<!-- config: ${rel(root,x.file)} -->`)) errors.push(`NAV ${rel(root,paths.agentEntry)}: managed config path is incorrect; update managed block`);
  }
  const files=[...new Set([...walk(paths.docsRoot,[paths.toolkitRoot]), ...walk(paths.notesRoot,[paths.toolkitRoot]),paths.agentEntry,paths.notesPolicy])];
  for(const p of files) if(fs.existsSync(p)&&!inside(paths.archiveRoot,p)) validateMarkdown(x,p,errors);
  return {errors,files};
}
function statusLines(text, field) {
  const escaped=[...field].map(char=>'\\^$.*+?()[]{}|'.includes(char)?'\\'+char:char).join('');
  return maskCode(text).split(/^ {0,3}##\s/m)[0].split(/\r?\n/).filter(line=>new RegExp('^'+escaped+':\\s*\\S','i').test(line));
}
function statusValue(line) { return line?.slice(line.indexOf(':')+1).trim().split(/\s+[—–]\s+/)[0].toLowerCase() ?? ''; }
function validateMarkdown(x,file,errors) {
  const {root,c,paths}=x, text=fs.readFileSync(file,'utf8'), r=rel(root,file);
  if(hasPlaceholder(text)) errors.push('TEMPLATE '+r+': unresolved placeholder; fill the template before delivery');
  if(file!==paths.notesPolicy&&inside(paths.notesRoot,file)&&!inside(paths.archiveRoot,file)) {
    const lines=statusLines(text,c.statusField);
    if(lines.length!==1) errors.push('STATUS '+r+': expected exactly one primary '+c.statusField+' line before the first H2; add one');
    else {
      const value=statusValue(lines[0]);
      if(!Object.values(c.statuses).flat().some(v=>v.toLowerCase()===value)) errors.push('STATUS '+r+': unknown status; use configured status');
      if(c.statuses.rejected.some(v=>v.toLowerCase()===value)&&!lines[0].includes(' — ')&&!/^(?:Rejection reason|Reason):\s*\S/im.test(text)) errors.push('STATUS '+r+': rejected note needs a reason line; add Reason: ...');
    }
  }
  for(const link of links(text)) {
    const location=r+':'+(text.slice(0,link.offset).match(/\n/g)?.length+1||1);
    if(link.unsupported){errors.push('MARKDOWN '+location+': unsupported nested destination; use an angle-wrapped or reference link');continue;}
    if(!link.url){errors.push('LINK '+location+': unresolved reference link; define it or correct its label');continue;}
    let target;
    try { target=localTarget(link.url,file); } catch {errors.push('LINK '+location+': malformed URL encoding; correct destination');continue;}
    if(!target)continue;
    if(!inside(root,target.target)){errors.push('PATH '+location+': link escapes project; use a project-relative target');continue;}
    try { noSymlinkEscape(root,target.target); } catch {errors.push('PATH '+location+': symlink target escapes project; use an internal file');continue;}
    if(!fs.existsSync(target.target)){errors.push('LINK '+location+': target '+link.url+' does not exist; correct the path');continue;}
    if(target.fragment&&target.target.endsWith('.md')&&!anchors(fs.readFileSync(target.target,'utf8')).has(target.fragment)) errors.push('ANCHOR '+location+': target fragment #'+target.fragment+' does not exist; correct the heading link');
  }
}
function snapshotData(x, files) {
  const all=new Set([...files,x.file,x.paths.docsEntry,x.paths.notesPolicy,x.paths.agentEntry]);
  for(const o of x.c.ownership)for(const s of o.sources){const p=path.resolve(x.root,s);if(fs.existsSync(p))all.add(p);}
  const map={};for(const p of [...all].sort()){if(fs.existsSync(p)&&fs.statSync(p).isFile())map[rel(x.root,p)]={sha256:sha(fs.readFileSync(p)),text:fs.readFileSync(p,'utf8')};}
  return {version:1,identity:x.identity,configSha256:sha(fs.readFileSync(x.file)),files:map};
}
function loadBaseline(file,x) {
  let b;try{b=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){throw new CliError(`BASELINE invalid or missing: ${e.message}`);}
  if(b.version!==1||!b.files||typeof b.files!=='object'||!b.identity||!b.configSha256)throw new CliError('BASELINE malformed snapshot');
  for(const [p,v] of Object.entries(b.files)) {
    if(path.isAbsolute(p)||!inside(x.root,path.resolve(x.root,p))||rel(x.root,path.resolve(x.root,p))!==p||!v||typeof v.text!=='string'||sha(v.text)!==v.sha256)throw new CliError(`BASELINE integrity failure for ${p}`);
    noSymlinkEscape(x.root,path.resolve(x.root,p));
  }
  const a=b.identity,z=x.identity; for(const k of Object.keys(z))if(JSON.stringify(a[k])!==JSON.stringify(z[k]))throw new CliError(`BASELINE incompatible config identity field ${k}`);
  const configRel=rel(x.root,x.file),prevConfig=b.files[configRel];if(!prevConfig)throw new CliError('BASELINE missing config content');
  let oldConfig;try{oldConfig=JSON.parse(prevConfig.text);}catch{throw new CliError('BASELINE config content invalid');}
  if(sha(prevConfig.text)!==b.configSha256)throw new CliError('BASELINE config digest mismatch');
  for(const k of ['repoRoot','docsRoot','docsEntry','notesRoot','notesPolicy','archiveRoot','agentEntry','toolkitRoot','statusField','statuses'])if(JSON.stringify(oldConfig[k])!==JSON.stringify(x.c[k]))throw new CliError(`BASELINE incompatible config setting ${k}`);
  const currentOwnership=new Map(x.c.ownership.map(o=>[o.topic,JSON.stringify(o)]));for(const o of oldConfig.ownership||[])if(currentOwnership.get(o.topic)!==JSON.stringify(o))throw new CliError(`BASELINE incompatible config setting ownership mapping removed or changed: ${o.topic}`);
  const archiveRel=rel(x.root,x.paths.archiveRoot).replace(/\\/g,'/'); const oldArchive=Object.entries(b.files).filter(([p])=>p.startsWith(`${archiveRel}/`));
  for(const [p,v] of oldArchive){const now=fs.existsSync(path.resolve(x.root,p))?fs.readFileSync(path.resolve(x.root,p),'utf8'):null;if(now!==v.text)throw new CliError(`ARCHIVE frozen file changed or deleted: ${p}`,1);}
  return b;
}
function gate(x,phase,baselineFile,reportFile) {
  if(!['bootstrap','update','curate','promote'].includes(phase))throw new CliError(`CLI invalid phase ${phase}`);
  let b=null;
  if(phase!=='bootstrap') {
    if(!baselineFile||!reportFile)throw new CliError('CLI non-bootstrap gate requires --baseline and --report');
    b=loadBaseline(path.resolve(process.cwd(),baselineFile),x);
  }
  const {errors,files}=configValidation(x);if(errors.length){errors.forEach(e=>console.error(`[${e.split(' ')[0]}] ${e}`));return 1;}
  if(phase==='bootstrap'){console.log('check passed; bootstrap gate passed');return 0;}let r;
  try{r=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),reportFile),'utf8'));}catch(e){throw new CliError(`REPORT invalid or missing: ${e.message}`);}
  if(r.version!==1||r.phase!==phase||!Array.isArray(r.decisions)||!Array.isArray(r.promotions))throw new CliError('REPORT malformed or wrong phase');
  const errs=[];const decisions=new Map();for(const d of r.decisions){
    if(!d||typeof d.path!=='string'||!['updated','unchanged','archived','deleted'].includes(d.action)||typeof d.reason!=='string'||!d.reason.trim()||!Array.isArray(d.documents)||d.documents.some(p=>typeof p!=='string')){errs.push('REPORT malformed decision; provide path/action/documents/reason');continue;}
    const target=path.resolve(x.root,d.path);
    if(path.isAbsolute(d.path)||!inside(x.root,target)||rel(x.root,target)!==d.path||decisions.has(d.path)){errs.push(`REPORT ${d.path}: path must be unique and canonical within project`);continue;}
    decisions.set(d.path,d);
  }
  const now=snapshotData(x,files).files, prev=b.files;
  const managed=new Set([...Object.keys(prev),...Object.keys(now)]);managed.delete(rel(x.root,x.file));
  for(const owner of x.c.ownership)for(const source of owner.sources){const key=rel(x.root,path.resolve(x.root,source));const absolute=path.resolve(x.root,source);if(!inside(x.paths.docsRoot,absolute)&&!inside(x.paths.notesRoot,absolute)&&absolute!==x.paths.agentEntry)managed.delete(key);}
  for(const p of managed){const a=prev[p]?.sha256,z=now[p]?.sha256;if(a!==z){const d=decisions.get(p);if(!d&&!([...decisions.values()].some(a=>a.action==='archived'&&a.from===p)))errs.push(`REPORT ${p}: changed/new/deleted file needs a decision and reason`);if(!z&&d?.action!=='deleted'&&![...decisions.values()].some(a=>a.action==='archived'&&a.from===p))errs.push(`REPORT ${p}: deletion needs action deleted or archived`);if(z&&!a&&d?.action!=='updated'&&d?.action!=='archived')errs.push(`REPORT ${p}: new file needs updated/archived decision`);}}
  for(const p of managed)if(prev[p]?.sha256!==now[p]?.sha256&&prev[p]&&now[p]&&decisions.get(p)?.action!=='updated')errs.push(`REPORT ${p}: modified current file needs action updated`);
  const archivePrefix=`${rel(x.root,x.paths.archiveRoot)}/`;
  for(const p of Object.keys(now).filter(p=>p.startsWith(archivePrefix)&&!prev[p])){const d=decisions.get(p);if(d?.action!=='archived')errs.push(`ARCHIVE ${p}: archive additions require action archived and from an active note`);}
  for(const p of Object.keys(prev).filter(p=>p.startsWith(archivePrefix)&&!now[p]))errs.push(`ARCHIVE ${p}: archived files may not be deleted`);
  for(const [p,d] of decisions) if(d.action==='archived') {
    const source=d.from; if(typeof source!=='string'){errs.push(`REPORT ${p}: archive decision needs from source`);continue;}
    const targetPath=path.resolve(x.root,p), sourcePath=path.resolve(x.root,source);
    if(!inside(x.paths.archiveRoot,targetPath)||!inside(x.paths.notesRoot,sourcePath)||inside(x.paths.archiveRoot,sourcePath)||sourceKeyIsArchive(sourcePath,x.paths.archiveRoot)){errs.push(`ARCHIVE ${p}: target must be inside archiveRoot and source a nonarchive note`);continue;}
    const sourceKey=rel(x.root,sourcePath),targetKey=rel(x.root,targetPath),old=prev[sourceKey], archived=now[targetKey]; if(!old||!archived){errs.push(`ARCHIVE ${p}: source must exist in baseline and target now; no data is deleted`);continue;}
    if(!Object.values(x.c.statuses.active).some(v=>v.toLowerCase()===primaryStatus(old.text,x.c.statusField))){errs.push(`ARCHIVE ${source}: only active notes may be archived`);continue;}
    const sourceDecision=decisions.get(sourceKey);if(sourceDecision&&sourceDecision.action!=='archived')errs.push(`ARCHIVE ${source}: moved source decision must use action archived`);if(now[sourceKey])errs.push(`ARCHIVE ${source}: archived source note must be removed, not duplicated`);    const dateMatch=archived.text.match(/^Archived:\s*(\d{4}-\d\d-\d\d)\s*$/m);
    if(!dateMatch||!validDate(dateMatch[1])){errs.push(`ARCHIVE ${p}: add a real Archived: YYYY-MM-DD date`);continue;}
    const normalized=archived.text.replace(/^Archived:\s*\d{4}-\d\d-\d\d\s*\n(?:\r?\n)?/,'');
    if(canonicalLinks(normalized,targetPath)!==canonicalLinks(old.text,sourcePath))errs.push(`ARCHIVE ${p}: body must remain unchanged and link targets preserved apart from archive metadata`);
  }
  for(const o of x.c.ownership){for(const s of o.sources){const p=rel(x.root,path.resolve(x.root,s)), old=prev[p]?.sha256, cur=now[p]?.sha256;if(old!==cur){const d=decisions.get(p);const doc=rel(x.root,path.resolve(x.root,o.document));const ownerDecision=decisions.get(doc);if(!(d?.action==='unchanged'&&d.reason.trim())&&!(ownerDecision?.action==='updated'&&now[doc]?.sha256!==prev[doc]?.sha256))errs.push(`OWNERSHIP ${p}: changed source requires updated owner document ${doc} or unchanged decision with reason`);}}}
  if(phase==='promote'&&!r.promotions.length)errs.push('PROMOTION report needs at least one promotion record');
  for(const promotion of r.promotions){
    const {source,target,evidence,reason}=promotion??{};
    if(typeof source!=='string'||typeof target!=='string'||!Array.isArray(evidence)||!evidence.length||evidence.some(e=>typeof e!=='string')||typeof reason!=='string'||!reason.trim()){errs.push('PROMOTION malformed; require source,target,evidence,reason');continue;}
    const src=path.resolve(x.root,source),dst=path.resolve(x.root,target);
    if(!inside(x.paths.notesRoot,src)||inside(x.paths.archiveRoot,src)||src===x.paths.notesPolicy||!inside(x.paths.docsRoot,dst)||inside(x.paths.archiveRoot,dst)||!fs.existsSync(src)||!fs.existsSync(dst)){errs.push(`PROMOTION ${source}: source must be a current note and target a formal docs file`);continue;}
    try{noSymlinkEscape(x.root,src);noSymlinkEscape(x.root,dst);}catch{errs.push(`PROMOTION ${source}: source or target escapes through a symlink`);continue;}
    if(!x.c.statuses.active.some(v=>v.toLowerCase()===primaryStatus(fs.readFileSync(src,'utf8'),x.c.statusField))||!prev[rel(x.root,src)]||!x.c.statuses.active.some(v=>v.toLowerCase()===primaryStatus(prev[rel(x.root,src)].text,x.c.statusField)))errs.push(`PROMOTION ${source}: source must be active in baseline and current and preserved`);
    for(const e of evidence){const file=path.resolve(x.root,e);try{assertInside(x.root,file,e);noSymlinkEscape(x.root,file);if(!fs.statSync(file).isFile())throw new Error();}catch{errs.push(`PROMOTION ${source}: evidence ${e} must be an existing in-root file`);}}
    const doc=rel(x.root,dst);if(!now[doc]||prev[doc]?.sha256===now[doc]?.sha256)errs.push(`PROMOTION ${source}: target document must change from baseline`);
  }
  if(errs.length){errs.forEach(e=>console.error(`[GATE] ${e}`));return 1;}
  console.log(`check passed; ${phase} gate passed`);return 0;
}
function main(argv) {
  try {
    const parsed=parseArgs([...argv]); if(parsed.command==='help'){console.log(USAGE);return 0;}
    const {command,options:o}=parsed;
    if(command==='init')return init(o);
    if(!o['--config'])throw new CliError(`CLI ${command} requires --config`);
    const configPath=path.resolve(process.cwd(),o['--config']);const x=readConfig(configPath);
    if(command==='check'){const {errors}=configValidation(x);if(errors.length){errors.forEach(e=>console.error(`[${e.split(' ')[0]}] ${e}`));return 1;}console.log('check passed');return 0;}
    if(command==='snapshot'){
      if(!o['--output'])throw new CliError('CLI snapshot requires --output');
      const {errors,files}=configValidation(x);if(errors.length){errors.forEach(e=>console.error(`[${e.split(' ')[0]}] ${e}`));return 1;}
      const output=path.resolve(process.cwd(),o['--output']);if(inside(x.paths.archiveRoot,output)||[x.file,x.paths.docsEntry,x.paths.notesPolicy,x.paths.agentEntry].includes(output))throw new CliError('CLI output may not overwrite managed files or reside in archive');
      const body=`${JSON.stringify(snapshotData(x,files),null,2)}\n`;try{fs.writeFileSync(output,body,{flag:'wx'});}catch(e){if(e.code==='EEXIST')throw new CliError(`SNAPSHOT output already exists: ${output}`,1);throw e;}console.log(`snapshot written: ${output}`);return 0;
    }
    return gate(x,o['--phase'],o['--baseline'],o['--report']);
  }catch(e){console.error(`[${e.code===1?'INIT':'CLI'}] ${e.message}; correct the command or input`);return e.code===1?1:2;}
}
process.exitCode=main(process.argv.slice(2));
function canonicalLinks(text,file) {
  const replacements=[];
  const masked=maskCode(text);
  for(const match of masked.matchAll(/!?\[[^\]\n]*\]\((<[^>\n]+>|[^)\n]+)\)|^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm)) {
    const raw=match[1]??match[2]; const url=raw.startsWith('<')?raw.slice(1,-1):raw.split(/\s+["']/)[0];
    if(/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(url))continue;
    const suffix=url.search(/[?#]/), authored=suffix<0?url:url.slice(0,suffix);
    let decoded;try{decoded=decodeURIComponent(authored);}catch{return text;}
    const canonical=path.resolve(path.dirname(file),decoded)+(suffix<0?'':url.slice(suffix));
    const offset=match.index+match[0].indexOf(raw)+(raw.startsWith('<')?1:0);
    replacements.push({offset,length:url.length,value:canonical});
  }
  for(const edit of replacements.reverse())text=text.slice(0,edit.offset)+edit.value+text.slice(edit.offset+edit.length);
  return text;
}
function sourceKeyIsArchive(source,archive){return inside(archive,source);}
function validDate(s){const d=new Date(`${s}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
function primaryStatus(text,field){return statusValue(statusLines(text,field)[0]);}
