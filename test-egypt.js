#!/usr/bin/env node
/* test-egypt.js - Ra's Fortune (Egyptian coin slot) checks.
   node test-egypt.js sim [rounds]  Node only: whole-game RTP, both bought bonuses, feature odds, honest strips
                                    (no two specials on a reel, collectors only on reel 5), Book of Ra fair, the
                                    hold & win board and rows, Sun and Rain always change the board
   node test-egypt.js ui            Playwright: base spin, a win, coin collect, Sun of Ra, Coin Rain, Book of Ra
                                    free games, Pharaoh's Treasure, both buys, the coin gamble - wallet audited
                                    after every round - autoplay, paytable, console errors */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-egypt.html');
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
  const G = loadCore(), N = +process.argv[3] || 3000000, R = G.mulberry(20260926);
  console.log(`\n-- whole game (${N.toLocaleString()} spins) --`);
  const a = { base: 0, scat: 0, collect: 0, fs: 0, hs: 0, tot: 0 }, c = { fs: 0, hs: 0, coll: 0, sun: 0, rain: 0, hit: 0 }; let sq = 0;
  for (let i = 0; i < N; i++) { const o = G.playRound(R); for (const k in a) a[k] += o[k]; if (o.trig.fs) c.fs++; if (o.trig.hs) c.hs++; if (o.hasColl) c.coll++; if (o.sun) c.sun++; if (o.rain) c.rain++; if (o.tot > 0) c.hit++; sq += o.tot * o.tot; }
  const rtp = a.tot / N, se = Math.sqrt(sq / N - rtp * rtp) / Math.sqrt(N);
  check(rtp > .955 && rtp < .99 || Math.abs(rtp - .97) < 3 * se, 'return to player', `${(100 * rtp).toFixed(2)}% ± ${(300 * se).toFixed(2)} (house rule 96-99%)`);
  console.log('       shares: ' + Object.entries(a).filter(([k]) => k !== 'tot').map(([k, v]) => `${k} ${(100 * v / N).toFixed(1)}%`).join(' · '));
  const f = k => N / c[k];
  check(f('hit') > 1.7 && f('hit') < 2.6, 'wins often', 'any win 1 in ' + f('hit').toFixed(2));
  check(f('coll') > 20 && f('coll') < 40, 'coin collect frequency', '1 in ' + f('coll').toFixed(0));
  check(f('sun') > 32 && f('sun') < 50, 'Sun of Ra frequency', '1 in ' + f('sun').toFixed(0));
  check(f('rain') > 70 && f('rain') < 105, 'Coin Rain frequency', '1 in ' + f('rain').toFixed(0));
  check(f('fs') > 110 && f('fs') < 170, 'Book of Ra frequency', '1 in ' + f('fs').toFixed(0));
  check(f('hs') > 120 && f('hs') < 190, "Pharaoh's Treasure frequency", '1 in ' + f('hs').toFixed(0));
  console.log('\n-- bought bonuses --');
  for (const k of ['fs', 'hs']) { let t = 0, s2 = 0; const M = 150000; for (let i = 0; i < M; i++) { const o = G.playRound(R, k); t += o.tot; s2 += o.tot * o.tot; }
    const r = t / M / G.BUY[k].x, e = Math.sqrt(s2 / M - (t / M) ** 2) / Math.sqrt(M) / G.BUY[k].x;
    check(Math.abs(r - .97) < Math.max(.03, 3 * e), `${G.BUY[k].name} at ${G.BUY[k].x}x returns about 97%`, `${(100 * r).toFixed(1)}% ± ${(300 * e).toFixed(1)}`); }
  console.log('\n-- honest draws --');
  { let bad = 0; for (const set of [G.STRIPS, G.FSTRIPS]) for (const st of set) for (let i = 0; i < st.length; i++) { const w = [0, 1, 2, 3].map(k => st[(i + k) % st.length]).filter(s => s >= G.SCAT && s !== G.COIN); if (w.length > 1) bad++; }
    check(!bad, 'a reel never shows two scatters/collectors', bad + ' bad windows'); }
  { const d = {}; G.STRIPS.forEach((s, r) => s.forEach(x => { if (x === G.WILD) d['w' + r] = 1; if (x === G.COLL) d['c' + r] = 1; })); check(!d.w0 && d.w1 && d.w4 && d.c4 && !d.c0 && !d.c3, 'wilds only on reels 2-5, the Pharaoh mask only on reel 5', JSON.stringify(d)); }
  { let ok = true, n = 0; for (let i = 0; i < 400000 && n < 2000; i++) { const o = G.spinBase(R); if (o.sun) { n++; if (!o.g[o.sun.r].every(s => s === G.WILD || s >= G.SCAT)) ok = false; } } check(ok && n > 500, 'Sun of Ra leaves the whole reel wild', n + ' checked'); }
  { let ok = true, n = 0; for (let i = 0; i < 400000 && n < 2000; i++) { const o = G.spinBase(R); if (o.rain) { n++; if (!o.rain.cells.every(k => o.g[Math.floor(k / 4)][k % 4] === G.COIN) || !o.g[4].includes(G.COLL)) ok = false; } } check(ok && n > 500, 'Coin Rain drops coins and always brings a collector', n + ' checked'); }
  { const h = Array(11).fill(0); for (let i = 0; i < 200000; i++) h[G.pickBook(R)]++; check(h.every(v => v > 0), 'every symbol can become the Book of Ra symbol', h.map(v => (v / 2000).toFixed(1)).join(' ')); }
  { let rows = 0, ok = true; for (let i = 0; i < 20000; i++) { const r = G.runHold(R, G.seedHold(R, 6)); rows = Math.max(rows, r.rows); if (r.rows > 6 || Object.keys(r.board).length > 5 * r.rows) ok = false; } check(ok && rows === 6, 'the treasure board grows to 6 rows and never overfills', 'max rows ' + rows); }
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-egypt-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + FILE); await pg.waitForTimeout(1000);
  const shot = n => pg.screenshot({ path: path.join(out, n + '.png') });
  await pg.evaluate("S.bal=100000;S.turbo=true;drawBal()"); await shot('idle');
  const force = async cond => pg.evaluate(`(()=>{const o=window.__sb||(window.__sb=spinBase);spinBase=R=>{let r,g=0;do r=o(R);while(!(${cond})&&g++<3e6);spinBase=o;window.__last=r;return r}})()`);
  const play = async (name, click, cost, snaps) => {
    const before = await pg.evaluate('bal()'); await click(); const t0 = Date.now(), done = {};
    while (Date.now() - t0 < 300000) { await pg.waitForTimeout(300); await pg.evaluate("if($('big').classList.contains('on'))$('big').click()");
      for (const [k, cond] of Object.entries(snaps || {})) if (!done[k] && await pg.evaluate(cond)) { done[k] = 1; await pg.waitForTimeout(500); await shot(k); }
      if (await pg.evaluate('!busy')) break; }
    const r = await pg.evaluate('({busy,bal:bal(),last:lastWin,bet:BET()})');
    check(!r.busy && Math.abs(r.bal - (before - cost(r.bet) + r.last)) < .005, `${name}: plays to the end and the wallet adds up`, `paid ${r.last.toFixed(2)} · balance ${before.toFixed(2)} -> ${r.bal.toFixed(2)}`); return r;
  };
  const spin = () => pg.click('#spinbtn');
  const plain = '!r.sun&&!r.rain&&!r.trig.fs&&!r.trig.hs';
  console.log('\n-- base game --');
  await force('r.win===0&&' + plain); await play('a losing spin', spin, b => b);
  await force('r.ways>=2&&!r.collect&&' + plain); await play('a win', spin, b => b); await shot('win');
  await force('r.collect>=3&&' + plain); await play('coin collect', spin, b => b, { collect: 'SUCK!==null' });
  console.log('\n-- mini features --');
  await force('r.sun&&!r.trig.fs&&!r.trig.hs'); await play('Sun of Ra', spin, b => b, { sun: 'SUNB!==null' });
  await force('r.rain&&!r.trig.fs&&!r.trig.hs'); await play('Coin Rain', spin, b => b, { rain: "$('banT').textContent==='COIN RAIN'&&Object.keys(OVR).length>0" });
  console.log('\n-- big features --');
  await force('r.trig.fs&&!r.trig.hs'); await play('Book of Ra free games', spin, b => b, { book: "$('bookOv').classList.contains('on')&&BOOK&&BOOK.done", free: 'HUD.fs&&HUD.fs.left<9', expand: 'EXPAND!==null' });
  await force('r.trig.hs&&!r.trig.fs'); await play("Pharaoh's Treasure", spin, b => b, { treasure: 'HSV&&Object.keys(HSV.spin).length>0', rows: 'HSV&&HSV.rows>4' });
  await play('bought free games', async () => { await pg.click('#buyBtn'); await pg.waitForTimeout(300); await shot('buy'); await pg.click('.bcard[data-b="fs"]'); }, b => 31 * b);
  await play("bought Pharaoh's Treasure", async () => { await pg.click('#buyBtn'); await pg.waitForTimeout(300); await pg.click('.bcard[data-b="hs"]'); }, b => 26 * b);
  console.log('\n-- gamble --');
  await pg.evaluate('lastWin=10;$("gambleBtn").classList.add("on")'); const g0 = await pg.evaluate('bal()');
  await pg.click('#gambleBtn'); await pg.waitForTimeout(300); check(Math.abs(await pg.evaluate('bal()') - (g0 - 10)) < .005, 'gamble takes the win back into play');
  await pg.click('#gHead'); await pg.waitForTimeout(500); await shot('gamble'); await pg.waitForTimeout(2200);
  const gs = await pg.evaluate('({open:$("gambleOv").classList.contains("on"),bal:bal()})');
  if (gs.open) { await pg.click('#gTake'); await pg.waitForTimeout(300); check(Math.abs(await pg.evaluate('bal()') - (g0 + 10)) < .005, 'called it: 2x collected'); }
  else check(Math.abs(gs.bal - (g0 - 10)) < .005, 'wrong call: the stake is lost');
  await pg.click('#infoBtn'); await pg.waitForTimeout(300); await shot('info'); check(await pg.evaluate("document.querySelectorAll('#infoBody .pr').length===15"), 'paytable shows every symbol'); await pg.click('[data-close="info"]');
  console.log('\n-- autoplay --');
  await pg.click('#autoBtn'); await pg.click('[data-a="10"]');
  const t0 = Date.now(); while (Date.now() - t0 < 300000) { await pg.waitForTimeout(500); await pg.evaluate("if($('big').classList.contains('on'))$('big').click()"); if (await pg.evaluate('auto===0&&!busy')) break; }
  check(await pg.evaluate('auto===0&&!busy'), 'ten autoplay spins run and stop');
  await b.close();
  check(!errs.length, 'no console errors', errs.slice(0, 4).join(' | '));
  console.log('\nscreens: ' + out);
}
(async () => {
  if (mode === 'sim') sim(); else if (mode === 'ui') await ui(); else { console.log('usage: node test-egypt.js sim|ui'); process.exit(2); }
  const bad = results.filter(x => !x).length; console.log(`\n${results.length - bad}/${results.length} checks passed`); process.exit(bad ? 1 : 0);
})();
