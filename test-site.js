#!/usr/bin/env node
/* test-site.js - the Stack Casino rebrand site (stack-site.html, built by site/build.py from site/src.html + site/site.js
   + the Stack Motion Vault in site/motion-vault.html). Checks: every area has a vault animation, the Motion panel
   changes and remembers one, every page renders, a tile opens the white game screen, transitions run, no errors. */
const path = require('path');
let playwright; try { playwright = require('playwright'); } catch { console.error('x  npm i -D playwright'); process.exit(2); }
const FILE = 'file://' + path.resolve(process.env.SITE_FILE || 'stack-site.html');
const results = [], check = (ok, n, d = '') => { results.push(ok); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); };
(async () => {
  const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.goto(FILE); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(3400);
  const cat = await pg.evaluate("({n:Object.keys(SITE.ITEM).length,areas:SITE.AREAS.length,bad:SITE.AREAS.filter(a=>!SITE.ITEM[SITE.pick(a.k)]&&!/^X-/.test(SITE.pick(a.k))).map(a=>a.k)})");
  check(cat.n >= 250 && cat.bad.length === 0, 'the whole Motion Vault is built in and every area has a valid default', JSON.stringify(cat));
  check(await pg.evaluate("document.getElementById('boot').classList.contains('off')"), 'the opening screen plays, then gets out of the way');
  for (const p of ['lobby', 'casino', 'tables', 'sports', 'markets', 'cards', 'arcade', 'wallet']) {
    await pg.evaluate(`SITE.go('${p}')`); await pg.waitForTimeout(p === 'casino' ? 2600 : 1400);
    const r = await pg.evaluate(`(()=>{const el=document.getElementById('p-${p}'),slots=[...el.querySelectorAll('.slot[data-area]')],st=slots.filter(s=>s.querySelector(':scope>.stage')||/^X-/.test(s._id||'')),tiles=el.querySelectorAll('.tcell .stage').length,btn=el.querySelectorAll('[data-btn] button').length;return{on:el.classList.contains('on'),slots:slots.length,filled:st.length,tiles,btn}})()`);
    check(r.on && r.filled === r.slots && (p === 'wallet' || r.tiles > 0) && (p === 'casino' || r.btn > 0), `${p}: every area shows its animation, tiles and buttons built`, JSON.stringify(r));
  }
  await pg.evaluate("SITE.go('lobby')"); await pg.waitForTimeout(1400);
  await pg.click('#motionBtn'); await pg.waitForTimeout(600); const rows = await pg.evaluate("document.querySelectorAll('#areaList .arow').length");
  await pg.click('#areaList .arow[data-k="heroFeat"]'); await pg.waitForTimeout(900);
  await pg.click('#shCats [data-c="wins"]'); await pg.waitForTimeout(600); await pg.click('#shList .pick[data-id="WN-04"]'); await pg.waitForTimeout(500);
  const now = await pg.evaluate("document.querySelector('[data-area=\"heroFeat\"]>.stage')._item.id");
  await pg.reload(); await pg.waitForTimeout(3600); const kept = await pg.evaluate("SITE.pick('heroFeat')+'/'+document.querySelector('[data-area=\"heroFeat\"]>.stage')._item.id");
  check(rows === 25 && now === 'WN-04' && kept === 'WN-04/WN-04', 'Motion panel: 25 areas; a new pick shows straight away and is remembered', JSON.stringify({ rows, now, kept }));
  await pg.evaluate("localStorage.setItem('stack.motion.v1',JSON.stringify({tile:'HV-04',trans:'PT-12'}))"); await pg.reload(); await pg.waitForTimeout(3600);
  const hv = await pg.evaluate("[...document.querySelectorAll('[data-tiles=\"orig\"] .tcell .stage')].every(s=>s._item.id==='HV-04'&&/Crash|Blackjack|Roulette|Plinko|Mines|Dice|Limbo|Dragon|Tower|Chicken/.test(s.textContent))");
  check(hv, 'game tiles use the chosen hover animation with each game\'s own glyph and name');
  await pg.click('[data-tiles="orig"] .tcell[data-g="crash"]'); await pg.waitForTimeout(250); const mid = await pg.evaluate("!!document.querySelector('.xrib')");
  await pg.waitForTimeout(3600);
  const g = await pg.evaluate("({on:document.getElementById('game').classList.contains('on'),t:document.getElementById('gTitle').textContent,bg:getComputedStyle(document.getElementById('game')).backgroundColor,load:document.getElementById('gLoad').hidden})");
  check(mid && g.on && g.t === 'Here is Crash.' && g.bg === 'rgb(255, 255, 255)' && g.load, 'a game tile opens a white screen saying "Here is Crash." (after the ribbon wipe and the loading animation)', JSON.stringify(g));
  await pg.click('#gBack'); await pg.waitForTimeout(1500); check(await pg.evaluate("!document.getElementById('game').classList.contains('on')"), 'back to the lobby');
  await pg.click('#dep'); await pg.waitForTimeout(1600);
  const t = await pg.evaluate("(()=>{document.getElementById('invBtn').click();return getComputedStyle(document.body).backgroundColor})()");
  check(await pg.evaluate("!!document.querySelector('#balOdo .d')") && t === 'rgb(7, 7, 7)', 'the balance is an odometer, and invert switches to the dark tokens', JSON.stringify({ t }));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  await b.close(); const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})();
