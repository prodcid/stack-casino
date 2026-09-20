#!/usr/bin/env node
/* devkit.js — dev tools for the single-file build. Run from the project root.
   node devkit.js check            syntax + duplicate decls + DOM ids + memory freshness
   node devkit.js map [pattern]    list declarations with line numbers
   node devkit.js ids [pattern]    list DOM ids with line numbers
   node devkit.js size             where the bytes are
   node devkit.js log "<entry>"    append a dated line to the CLAUDE.md decision log
   node devkit.js issue "<entry>"  append a line to CLAUDE.md known issues
   node devkit.js issue -r "<txt>" remove a known-issue line containing <txt>
*/
const fs = require('fs');
const path = require('path');
const FILE = process.env.STACK_FILE || 'stack-casino.html';
const MEM = process.env.STACK_MEM || 'CLAUDE.md';

function load() {
  if (!fs.existsSync(FILE)) { console.error(`x  ${FILE} not found (cwd ${process.cwd()})`); process.exit(2); }
  const html = fs.readFileSync(FILE, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { console.error('x  no <script> block found'); process.exit(2); }
  const jsStart = html.slice(0, m.index).split('\n').length; // 1-based line of <script>
  return { html, js: m[1], jsStart };
}

// line number in the HTML file for a character offset inside the js block
const lineOf = (js, idx, jsStart) => jsStart + js.slice(0, idx).split('\n').length - 1;

function check() {
  const { html, js, jsStart } = load();
  let bad = 0;

  // 1. syntax
  const tmp = path.join(require('os').tmpdir(), 'devkit-check.js');
  fs.writeFileSync(tmp, js);
  const r = require('child_process').spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.log('x  SYNTAX ERROR');
    const out = (r.stderr || '').split('\n').slice(0, 12).join('\n')
      .replace(new RegExp(tmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)', 'g'),
               (_, n) => `${FILE}:${jsStart + (+n) - 1}`);
    console.log(out);
    bad++;
  } else console.log('ok syntax');
  fs.unlinkSync(tmp);

  // 2. duplicate top-level declarations (the bug class that silently breaks this file)
  const seen = {};
  const decl = /^(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)/gm;
  for (let m; (m = decl.exec(js)); ) {
    const name = m[1] || m[2];
    (seen[name] = seen[name] || []).push(lineOf(js, m.index, jsStart));
  }
  const dups = Object.entries(seen).filter(([, v]) => v.length > 1);
  if (dups.length) {
    console.log(`x  ${dups.length} duplicate top-level declaration(s):`);
    dups.forEach(([n, ls]) => console.log(`   ${n}  lines ${ls.join(', ')}`));
    bad++;
  } else console.log('ok no duplicate declarations');

  // 3. $('id') references that have no matching id in the HTML
  const ids = new Set();
  for (let m, re = /\bid="([^"]+)"/g; (m = re.exec(html)); ) ids.add(m[1]);
  for (let m, re = /id=[`'"]([A-Za-z0-9_-]+)[`'"]/g; (m = re.exec(js)); ) ids.add(m[1]); // built at runtime
  // ids assembled in template literals, e.g. id="ptr${mini?'2':''}" -> prefix "ptr"
  const prefixes = [];
  for (let m, re = /id="([A-Za-z0-9_-]*)\$\{/g; (m = re.exec(js)); ) if (m[1]) prefixes.push(m[1]);
  for (let m, re = /id='([A-Za-z0-9_-]*)'\s*\+/g; (m = re.exec(js)); ) if (m[1]) prefixes.push(m[1]);
  for (let m, re = /\$\('([A-Za-z0-9_-]*)'\s*\+/g; (m = re.exec(js)); ) if (m[1]) prefixes.push(m[1]);
  const dynamic = prefixes.length > 0;
  const missing = new Map();
  for (let m, re = /\$\('([A-Za-z0-9_-]+)'\)/g; (m = re.exec(js)); ) {
    const id = m[1];
    if (ids.has(id) || missing.has(id)) continue;
    if (prefixes.some(p => id.startsWith(p))) continue; // built dynamically
    missing.set(id, lineOf(js, m.index, jsStart));
  }
  if (missing.size) {
    console.log(`!  ${missing.size} $('id') reference(s) with no literal id${dynamic ? ' (some ids are built dynamically — check by hand)' : ''}:`);
    [...missing].slice(0, 20).forEach(([id, ln]) => console.log(`   ${id}  first used line ${ln}`));
  } else console.log('ok all $() ids resolve');

  // 4. unbalanced script tags
  const opens = (html.match(/<script>/g) || []).length, closes = (html.match(/<\/script>/g) || []).length;
  if (opens !== closes || opens !== 1) { console.log(`!  ${opens} <script> / ${closes} </script> — expected exactly 1 of each`); }

  // 5. memory freshness — the game must not move on without CLAUDE.md moving with it
  if (!fs.existsSync(MEM)) {
    console.log(`x  ${MEM} missing — this project's memory lives there, recreate it`);
    bad++;
  } else {
    const gameT = fs.statSync(FILE).mtimeMs, memT = fs.statSync(MEM).mtimeMs;
    if (gameT > memT + 1000) {
      const secs = Math.round((gameT - memT) / 1000);
      const ago = secs < 90 ? `${secs}s` : `${Math.round(secs / 60)} min`;
      console.log(`x  ${MEM} is STALE — ${FILE} was changed ${ago} after it, and memory was not updated.`);
      console.log('   Before you finish, record what changed:');
      console.log('     node devkit.js log "why you chose X over Y"        (decision log)');
      console.log('     node devkit.js issue "something left broken"       (known issues)');
      console.log('     node devkit.js issue -r "text of a fixed issue"    (remove one)');
      console.log('   Also update section 2 (scope) if you added or removed a game.');
      console.log('   Nothing worth recording? Say so in the log — do not skip it silently.');
      bad++;
    } else console.log('ok memory current');
  }

  console.log(bad ? `\nFAILED (${bad})` : '\nPASSED');
  process.exit(bad ? 1 : 0);
}

/* ---- CLAUDE.md writers: make keeping memory current a one-liner ---- */
function readMem() {
  if (!fs.existsSync(MEM)) { console.error(`x  ${MEM} not found`); process.exit(2); }
  return fs.readFileSync(MEM, 'utf8');
}
function sectionBounds(md, heading) {
  const i = md.indexOf(heading);
  if (i < 0) return null;
  const after = md.indexOf('\n## ', i + heading.length);
  return [i + heading.length, after < 0 ? md.length : after];
}
function appendTo(heading, line, label) {
  let md = readMem();
  const b = sectionBounds(md, heading);
  if (!b) { console.error(`x  "${heading}" not found in ${MEM}`); process.exit(2); }
  let body = md.slice(b[0], b[1]).replace(/\s+$/, '');
  // keep the trailing --- rule below the list, not above the new entry
  const rule = body.match(/\n-{3,}$/);
  if (rule) body = body.slice(0, -rule[0].length).replace(/\s+$/, '');
  body += `\n${line}\n` + (rule ? '\n---\n' : '');
  md = md.slice(0, b[0]) + body + '\n' + md.slice(b[1]).replace(/^\n+/, '');
  fs.writeFileSync(MEM, md);
  console.log(`ok ${label}: ${line.replace(/^- /, '').replace(/\*\*/g, '')}`);
}
function logCmd(text) {
  if (!text) { console.error('x  usage: node devkit.js log "what you decided and why"'); process.exit(2); }
  const t = new Date();
  const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  appendTo('## 6. Decision log', `- **${d}** — ${text}`, 'logged');
}
function issueCmd(text) {
  const argv = process.argv.slice(3);
  if (argv[0] === '-r') {
    const needle = argv.slice(1).join(' ');
    if (!needle) { console.error('x  usage: node devkit.js issue -r "text of the issue"'); process.exit(2); }
    let md = readMem();
    const b = sectionBounds(md, '## 5. Known issues / open items');
    if (!b) { console.error('x  known issues section not found'); process.exit(2); }
    const body = md.slice(b[0], b[1]);
    const kept = body.split('\n').filter(l => !(/^\s*-\s+\S/.test(l) && l.toLowerCase().includes(needle.toLowerCase())));
    if (kept.length === body.split('\n').length) { console.error(`x  no known-issue line matching "${needle}"`); process.exit(1); }
    fs.writeFileSync(MEM, md.slice(0, b[0]) + kept.join('\n') + md.slice(b[1]));
    console.log(`ok issue resolved and removed: ${needle}`);
    return;
  }
  if (!text) { console.error('x  usage: node devkit.js issue "what is broken"  |  issue -r "fixed thing"'); process.exit(2); }
  appendTo('## 5. Known issues / open items', `- ${text}`, 'issue noted');
}

function map(pattern) {
  const { js, jsStart } = load();
  const re = /^(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)/gm;
  const rows = [];
  for (let m; (m = re.exec(js)); ) rows.push([m[1] || m[2], lineOf(js, m.index, jsStart), m[1] ? 'fn' : 'var']);
  const f = pattern ? rows.filter(r => r[0].toLowerCase().includes(pattern.toLowerCase())) : rows;
  f.forEach(([n, l, k]) => console.log(`${String(l).padStart(6)}  ${k}  ${n}`));
  console.log(`\n${f.length}${pattern ? ` matching "${pattern}"` : ''} of ${rows.length} declarations`);
}

function idsCmd(pattern) {
  const { html } = load();
  const lines = html.split('\n');
  const rows = [];
  lines.forEach((ln, i) => { for (let m, re = /\bid="([^"]+)"/g; (m = re.exec(ln)); ) rows.push([m[1], i + 1]); });
  const f = pattern ? rows.filter(r => r[0].toLowerCase().includes(pattern.toLowerCase())) : rows;
  f.forEach(([n, l]) => console.log(`${String(l).padStart(6)}  #${n}`));
  console.log(`\n${f.length} of ${rows.length} ids`);
}

function size() {
  const { html, js } = load();
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const kb = n => (n / 1024).toFixed(1) + ' KB';
  console.log(`total  ${kb(html.length)}`);
  console.log(`  css  ${kb(css.length)}`);
  console.log(`  js   ${kb(js.length)}`);
  console.log(`  html ${kb(html.length - css.length - js.length)}`);
  // biggest game sections, by the /* ==== NAME ==== */ banners
  const marks = [];
  for (let m, re = /\/\* =+ ([^=]+?) =+ \*\//g; (m = re.exec(js)); ) marks.push([m[1].trim(), m.index]);
  marks.push(['<end>', js.length]);
  const secs = marks.slice(0, -1).map((m, i) => [m[0], marks[i + 1][1] - m[1]]).sort((a, b) => b[1] - a[1]);
  console.log('\nbiggest js sections:');
  secs.slice(0, 12).forEach(([n, s]) => console.log(`  ${kb(s).padStart(9)}  ${n}`));
}

const [cmd, arg] = process.argv.slice(2);
({ check, map, ids: idsCmd, size, log: logCmd, issue: issueCmd }[cmd] || (() => {
  console.log('usage: node devkit.js check | map [pattern] | ids [pattern] | size | log "..." | issue [-r] "..."');
  process.exit(2);
}))(arg);
