#!/usr/bin/env node
/* ============================================================================
   sync-cards.js — inline Stack Cards into the casino.

     node sync-cards.js          copy stack-cards.html into stack-casino.html
     node sync-cards.js --check  exit 1 if the inlined copy is stale

   stack-cards.html is the SOURCE OF TRUTH for the card game. It still opens on
   its own (demo mode), and every card change is made there. The casino has to
   be a single file for the launcher, so this copies the engine's CSS and script
   in between markers. ship.js runs it before every build and devkit check fails
   if you forget, so the two can never quietly drift apart.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const CARDS = path.join(ROOT, 'stack-cards.html');
const GAME = path.join(ROOT, 'stack-casino.html');
const CSS_A = '/*<<STACK-CARDS-CSS>>*/', CSS_B = '/*<</STACK-CARDS-CSS>>*/';
const JS_A = '<script id="stack-cards">', JS_B = '</script><!--/stack-cards-->';

function extract() {
  const src = fs.readFileSync(CARDS, 'utf8');
  const cs = src.indexOf('<style>'), ce = src.indexOf('</style>');
  const js = src.indexOf('<script>'), je = src.lastIndexOf('</script>');
  if (cs < 0 || ce < 0 || js < 0 || je < 0) throw new Error('stack-cards.html: missing <style> or <script>');
  let css = src.slice(cs + 7, ce);
  // The standalone page locks html/body so the table never scrolls. Inlined
  // into the casino, that rule would freeze scrolling on every page.
  css = css.replace(/^\s*html,body\{[^}]*\}\s*$/m, '/* (standalone html,body rule dropped) */');
  if (/^\s*html\s*,\s*body\s*\{/m.test(css)) throw new Error('an unscoped html,body rule survived the sync');
  const script = src.slice(js + 8, je);
  if (/<\/script/i.test(script)) throw new Error('the card engine contains "</script" and cannot be inlined safely');
  return { css, script };
}

function build(game, { css, script }) {
  const ca = game.indexOf(CSS_A), cb = game.indexOf(CSS_B);
  const ja = game.indexOf(JS_A), jb = game.indexOf(JS_B);
  if (ca < 0 || cb < 0 || ja < 0 || jb < 0) throw new Error('stack-casino.html is missing the STACK-CARDS markers');
  return game.slice(0, ca + CSS_A.length) + '\n' + css + '\n' + game.slice(cb, ja + JS_A.length)
       + '\n' + script + '\n' + game.slice(jb);
}

const check = process.argv.includes('--check');
try {
  const parts = extract();
  const game = fs.readFileSync(GAME, 'utf8');
  const next = build(game, parts);
  if (check) {
    if (next !== game) { console.log('x  Stack Cards is out of sync — run: node sync-cards.js'); process.exit(1); }
    console.log('ok Stack Cards in sync');
    process.exit(0);
  }
  // syntax-check the engine on its own before letting it into the build
  const tmp = path.join(require('os').tmpdir(), 'stack-cards-check.js');
  fs.writeFileSync(tmp, parts.script);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { console.error('x  card engine has a syntax error:\n' + String(e.stderr || e.message)); process.exit(1); }
  if (next === game) { console.log('ok Stack Cards already in sync'); return; }
  fs.writeFileSync(GAME, next);
  console.log(`ok Stack Cards synced (${(parts.css.length / 1024).toFixed(0)} KB css, ${(parts.script.length / 1024).toFixed(0)} KB js)`);
} catch (e) { console.error('x  ' + e.message); process.exit(1); }
