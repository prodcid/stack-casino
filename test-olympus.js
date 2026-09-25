#!/usr/bin/env node
/* test-olympus.js - Olympus Storm (tumble slot) checks.
   node test-olympus.js sim [rounds]  Node only: RTP normal + Double Chance, each bought bonus tier, feature odds,
                                      Titan choices equal on average, temple/wheel-style boards honest, Wrath always
                                      pays, max-win cap, tumbles settle, weights match the paytable
   node test-olympus.js ui            Playwright: base spins, Zeus's Wrath, Hera's Blessing, Titan Battle, a bought
                                      bonus through the Temple of Gods, Super buy, Double Chance, the gamble - with
                                      the wallet audited after every round - autoplay, paytable, console errors */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-olympus.html');
const mode = process.argv[2] || 'sim';
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function loadCore() {
  const src = fs.readFileSync(FILE, 'utf8'), a = src.indexOf('/*==CORE==*/'), b = src.indexOf('/*==END CORE==*/');
  if (a < 0 || b < 0) throw new Error('core markers missing');
  const m = { exports: {} }; new Function('module', src.slice(a, b))(m); return m.exports;
}
function sim() {
  const G = loadCore(), N = +process.argv[3] || 2500000, R = G.mulberry(20260927);
  const whole = (label, ante, cost, lo, hi) => {
    const a = { base: 0, scat: 0, fs: 0, titan: 0, tot: 0 }, c = { trig: 0, ttrig: 0, wrath: 0, hera: 0 }; let hit = 0, sq = 0, capped = 0, maxT = 0;
    for (let i = 0; i < N; i++) { const o = G.playRound(R, null, ante); for (const k in a) a[k] += o[k]; for (const k in c) c[k] += o[k] ? 1 : 0; hit += o.tot > 0; sq += o.tot * o.tot; if (o.tot > G.MAXWIN + 1e-9) capped++; maxT = Math.max(maxT, o.tumbles); }
    const rtp = a.tot / N / cost, se = Math.sqrt(sq / N - (a.tot / N) ** 2) / Math.sqrt(N) / cost;
    check(rtp > .955 && rtp < .99 || Math.abs(rtp - .97) < 3 * se, `${label}: return to player`, `${(100 * rtp).toFixed(2)}% ± ${(300 * se).toFixed(2)} (house rule 96-99%)`);
    console.log('       shares: ' + Object.entries(a).filter(([k]) => k !== 'tot').map(([k, v]) => `${k} ${(100 * v / N / cost).toFixed(1)}%`).join(' · ') + '   odds: ' + Object.entries(c).map(([k, v]) => `${k} 1/${(N / v).toFixed(0)}`).join(' · '));
    check(N / c.trig > lo && N / c.trig < hi, `${label}: free spins frequency`, '1 in ' + (N / c.trig).toFixed(0));
    check(!capped && maxT < 60, `${label}: 5000x cap holds and tumbles always end`, 'longest ' + maxT);
    return { c, hit };
  };
  console.log(`\n-- whole game (${N.toLocaleString()} spins) --`);
  const n = whole('normal', false, 1, 280, 420);
  check(N / n.hit > 2.6 && N / n.hit < 4.2, 'any win', '1 in ' + (N / n.hit).toFixed(2));
  check(N / n.c.ttrig > 40 && N / n.c.ttrig < 70, 'Titan Battle frequency', '1 in ' + (N / n.c.ttrig).toFixed(0));
  check(N / n.c.wrath > 65 && N / n.c.wrath < 100, "Zeus's Wrath frequency", '1 in ' + (N / n.c.wrath).toFixed(0));
  check(N / n.c.hera > 35 && N / n.c.hera < 65, "Hera's Blessing frequency", '1 in ' + (N / n.c.hera).toFixed(0));
  console.log('\n-- Double Chance (1.25x per spin) --');
  whole('ante', true, G.ANTE_X, 150, 250);
  console.log('\n-- bought bonuses --');
  for (let b = 0; b < G.BUYS.length; b++) {
    let t = 0, s2 = 0, all = true; const M = 120000;
    for (let i = 0; i < M; i++) { const o = G.playRound(R, b); t += o.tot; s2 += o.tot * o.tot; if (!o.trig) all = false; }
    const r = t / M / G.BUYS[b].x, e = Math.sqrt(s2 / M - (t / M) ** 2) / Math.sqrt(M) / G.BUYS[b].x;
    check(all && Math.abs(r - .97) < Math.max(.03, 3 * e), `${G.BUYS[b].name} at ${G.BUYS[b].x}x returns about 97% and always starts`, `${(100 * r).toFixed(1)}% ± ${(300 * e).toFixed(1)}`);
  }
  console.log('\n-- features are fair --');
  { const ev = [0, 1, 2].map(p => { let t = 0; const M = 300000; for (let i = 0; i < M; i++) t += G.playTitan(R, p); return t / M / G.TITAN_P0; });
    check(ev.every(v => Math.abs(v - 1) < .02), 'every Titan attack is worth the same on average', ev.map((v, i) => G.TITAN[i].k + ' ' + v.toFixed(3)).join(' · '));
    check(G.TITAN.every(o => Math.abs(o.q * o.m + (1 - o.q) * G.TITAN_LOSE - 1) < 1e-9), 'each attack: q·m + (1-q)·lose = 1 exactly'); }
  { const b = G.templeBoard(R).map(x => x.t + x.v).sort().join(), want = G.TEMPLE.map(x => x.t + x.v).sort().join(); check(b === want, 'the temple holds exactly the advertised statues'); }
  { let ok = true, n2 = 0; for (let i = 0; i < 400000 && n2 < 3000; i++) { const o = G.spinBase(R); if (o.wrath) { n2++; if (o.tw <= 0) ok = false; } } check(ok && n2 > 1000, "Zeus's Wrath always produces a win", n2 + ' checked'); }
  { let ok = true, n2 = 0; for (let i = 0; i < 400000 && n2 < 3000; i++) { const o = G.spinBase(R); if (o.hera) { n2++; if (G.countOf(o.start, G.ORB) < 1 && G.countOf(o.start, G.SCAT) === 0) ok = false; } } check(ok && n2 > 1000, "Hera's re-drop always carries an orb", n2 + ' checked'); }
  { let bad = 0; for (let i = 0; i < 20000; i++) { const b = G.spinBuy(R); if (G.countOf(b.start, G.SCAT) !== 4) bad++; } check(!bad, 'a bought board holds exactly 4 scatters', bad + ' wrong'); }
  { const c = Array(11).fill(0); let n3 = 0; for (let i = 0; i < 20000; i++) { const b = G.fillBoard(R, G.W); for (const col of b) for (const x of col) { c[x.s]++; n3++; } }
    const tw = G.W.reduce((a, b) => a + b, 0); let worst = 0; c.forEach((v, i) => { const p = G.W[i] / tw, z = Math.abs(v / n3 - p) / Math.sqrt(p * (1 - p) / n3); worst = Math.max(worst, z); });
    check(worst < 5, 'every cell is drawn from the published weights', 'max |z| ' + worst.toFixed(2)); }
  { let ok = true; for (let i = 0; i < 5000; i++) { const o = G.spinBase(R); for (const st of o.steps) for (const w of st.wins) if (w.n < 8) ok = false; if (G.findWins(o.end).length) ok = false; } check(ok, 'only 8+ pays, and the final board never has a win left on it'); }
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-olympus-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + FILE); await pg.waitForTimeout(1000);
  const shot = n => pg.screenshot({ path: path.join(out, n + '.png') });
  await pg.evaluate("S.bal=100000;S.turbo=true;S.ante=false;drawBal();drawBet()"); await shot('idle');
  const force = async cond => pg.evaluate(`(()=>{const o=window.__sb||(window.__sb=spinBase);spinBase=(R,a)=>{let r,g=0;do r=o(R,a);while(!(${cond})&&g++<3e6);spinBase=o;window.__last=r;return r}})()`);
  const drive = async shots => { await pg.evaluate(`(()=>{if($('big').classList.contains('on'))$('big').click();
      const tb=[...document.querySelectorAll('#titanBtns button')].find(b=>!b.disabled&&$('titanOv').classList.contains('on'));if(tb)tb.click();
      if($('templeOv').classList.contains('on')){const s=[...document.querySelectorAll('#templeGrid .stat:not(.open)')];if(s.length&&document.querySelectorAll('#templeGrid .stat.open').length<3)s[0].click();else if($('templeGo').style.display!=='none')$('templeGo').click()}})()`); };
  const play = async (name, click, cost, shots) => {
    const before = await pg.evaluate('bal()'); await click(); const t0 = Date.now(); const sh = {}; for (const [k, v] of Object.entries(shots || {})) sh[k] = { sel: v };
    const S2 = {}; for (const k in sh) S2[k] = sh[k].sel;
    while (Date.now() - t0 < 300000) { await pg.waitForTimeout(300); await drive(); for (const k in sh) if (!sh[k].done && await pg.evaluate(`$('${sh[k].sel}').classList.contains('on')`)) { sh[k].done = 1; await pg.waitForTimeout(600); await shot(k); } if (await pg.evaluate('!busy')) break; }
    const r = await pg.evaluate('({busy,bal:bal(),last:lastWin,bet:BET()})');
    check(!r.busy && Math.abs(r.bal - (before - cost(r.bet) + r.last)) < .005, `${name}: plays to the end and the wallet adds up`, `paid ${r.last.toFixed(2)} · balance ${before.toFixed(2)} -> ${r.bal.toFixed(2)}`); return r;
  };
  const spin = () => pg.click('#spinbtn');
  console.log('\n-- base game --');
  await force('r.win===0&&!r.fs&&!r.titan&&!r.wrath&&!r.hera'); await play('a losing spin', spin, b => b);
  check(await pg.evaluate('OB.size===30&&[...OB.values()].every(o=>o.st==="rest")'), 'the board settles to 30 symbols');
  await force('r.steps.length>=2&&r.orbs>0&&!r.fs&&!r.titan&&!r.wrath&&!r.hera'); await play('tumbles + orbs', spin, b => b);
  console.log('\n-- features --');
  await force('r.wrath&&!r.fs&&!r.titan'); const w = await play("Zeus's Wrath", async () => { await spin(); await pg.waitForTimeout(2600); await shot('wrath'); }, b => b);
  check(w.last > 0, "Zeus's Wrath paid");
  await force('r.hera&&!r.fs&&!r.titan'); await play("Hera's Blessing", async () => { await spin(); await pg.waitForTimeout(2400); await shot('hera'); }, b => b);
  await force('r.titan&&!r.fs&&!r.wrath&&!r.hera'); await play('Titan Battle', spin, b => b, { titan: 'titanOv' });
  await play('bought Free Spins (through the Temple of Gods)', async () => { await pg.click('#buyBtn'); await pg.waitForTimeout(300); await shot('buy'); await pg.click('.bcard[data-b="0"]'); }, b => 109 * b, { temple: 'templeOv' });
  await play('bought Super Free Spins', async () => { await pg.click('#buyBtn'); await pg.waitForTimeout(300); await pg.click('.bcard[data-b="1"]'); }, b => 162 * b);
  console.log('\n-- Double Chance + gamble --');
  await pg.click('#anteBtn'); check(await pg.evaluate("S.ante&&$('betV').textContent==='$1.25'"), 'Double Chance charges 1.25x', await pg.evaluate("$('betV').textContent"));
  await force('r.win>0&&!r.fs&&!r.titan'); await play('a Double Chance spin', spin, b => b * 1.25); await pg.click('#anteBtn');
  await pg.evaluate('lastWin=10;$("gambleBtn").classList.add("on")'); const g0 = await pg.evaluate('bal()');
  await pg.click('#gambleBtn'); await pg.waitForTimeout(300); await shot('gamble'); check(Math.abs(await pg.evaluate('bal()') - (g0 - 10)) < .005, 'gamble takes the win back into play');
  await pg.click('#gLeftB'); await pg.waitForTimeout(2600);
  const gs = await pg.evaluate('({open:$("gambleOv").classList.contains("on"),amt:GB?GB.amt:0,bal:bal()})');
  if (gs.open) { await pg.click('#gTake'); await pg.waitForTimeout(300); check(Math.abs(await pg.evaluate('bal()') - (g0 + 10)) < .005, 'right cloud: 2x collected'); }
  else check(Math.abs(gs.bal - (g0 - 10)) < .005, 'wrong cloud: the stake is lost');
  await pg.click('#infoBtn'); await pg.waitForTimeout(300); await shot('info'); check(await pg.evaluate("document.querySelectorAll('#infoBody .pr').length===11&&/Titan Battle/.test($('infoBody').textContent)"), 'paytable shows every symbol and feature'); await pg.click('[data-close="info"]');
  console.log('\n-- autoplay --');
  await pg.click('#autoBtn'); await pg.click('[data-a="10"]');
  const t0 = Date.now(); while (Date.now() - t0 < 300000) { await pg.waitForTimeout(500); await drive(); if (await pg.evaluate('auto===0&&!busy')) break; }
  check(await pg.evaluate('auto===0&&!busy'), 'ten autoplay spins run and stop');
  await b.close();
  check(!errs.length, 'no console errors', errs.slice(0, 4).join(' | '));
  console.log('\nscreens: ' + out);
}
(async () => {
  if (mode === 'sim') sim(); else if (mode === 'ui') await ui(); else { console.log('usage: node test-olympus.js sim|ui'); process.exit(2); }
  const bad = results.filter(x => !x).length; console.log(`\n${results.length - bad}/${results.length} checks passed`); process.exit(bad ? 1 : 0);
})();
