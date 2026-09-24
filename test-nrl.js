#!/usr/bin/env node
/* test-nrl.js - Stack League (rugby league) checks.
   node test-nrl.js sim [matches]  Node only: calibration against real NRL numbers, the recorded match gives
                                   the same results as the pricing runs, every market returns ~97%
   node test-nrl.js ui             Playwright: screens at 1280x860 + 393x852, a live bet, settlement at
                                   full time, memory across 8 matches, console errors
   Screenshots go to <tmp>/stack-nrl-shots. */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-nrl.html');
const mode = process.argv[2] || 'sim';
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function loadCore() {
  const src = fs.readFileSync(FILE, 'utf8'), a = src.indexOf('/*==CORE==*/'), b = src.indexOf('/*==END CORE==*/');
  if (a < 0 || b < 0) throw new Error('core markers missing in stack-nrl.html');
  const m = { exports: {} }; new Function('module', src.slice(a, b))(m); return m.exports;
}
function sim() {
  const G = loadCore(), N = +process.argv[3] || 1500;
  console.log(`\n-- calibration (${N} matches) --`);
  let pts = 0, tries = 0, draws = 0, home = 0, fav = 0, favN = 0, conv = 0, convN = 0; const mg = [];
  for (let r = 0; r < N; r++) {
    const h = r % 8, a = (h + 1 + (r >> 3) % 7) % 8, M = G.mkMatch(h, a, 1), s = G.newMatch(M); s.ev = [];
    if (r < 250) { let w = 0; for (let k = 0; k < 200; k++) if (G.simMatch(G.newMatch(M)).m > 0) w++; s._f = w >= 100 ? 0 : 1; }
    while (!s.done) G.step(s); const o = G.outcome(s);
    pts += o.tot; tries += o.nt; draws += o.m === 0; home += o.m > 0; mg.push(Math.abs(o.m));
    for (const e of s.ev) if (e.ty === 'conv') { convN++; conv += e.ok; }
    if (s._f != null) { favN++; fav += s._f === 0 ? o.m > 0 : o.m < 0; }
  }
  mg.sort((a, b) => a - b);
  check(pts / N > 36 && pts / N < 50, 'points per match', (pts / N).toFixed(1) + ' (NRL ~43)');
  check(tries / N > 6 && tries / N < 9, 'tries per match', (tries / N).toFixed(2) + ' (NRL ~7.5)');
  check(conv / convN > .65 && conv / convN < .85, 'conversion rate', (100 * conv / convN).toFixed(0) + '%');
  check(home / N > .48 && home / N < .62, 'home side wins', (100 * home / N).toFixed(0) + '%');
  check(fav / favN > .52 && fav / favN < .72, 'pre-match favourite wins', (100 * fav / favN).toFixed(0) + '% (NRL ~64%)');
  check(draws / N < .02, 'draws are rare (golden point)', (100 * draws / N).toFixed(1) + '%');
  check(mg[N >> 1] >= 8 && mg[N >> 1] <= 18, 'median margin', mg[N >> 1] + ' points');

  console.log('\n-- the watched match is the priced match --');
  { const M = G.mkMatch(0, 1, 1), base = G.newMatch(M), R = 6000, a = [0, 0, 0], b = [0, 0, 0];
    for (let k = 0; k < R; k++) { const o = G.simMatch(base); a[o.m > 0 ? 0 : o.m < 0 ? 2 : 1]++; }
    for (let k = 0; k < R; k++) { const s = G.cloneMatch(base); s.rec = true; s.plays = []; s.ev = []; s.stats = [{}, {}]; while (!s.done) G.step(s); const o = G.outcome(s); b[o.m > 0 ? 0 : o.m < 0 ? 2 : 1]++; }
    let worst = 0; for (let i = 0; i < 3; i++) { const p = (a[i] + b[i]) / (2 * R), se = Math.sqrt(2 * p * (1 - p) / R) || 1e-9; worst = Math.max(worst, Math.abs(a[i] - b[i]) / R / se); }
    check(worst < 4, 'result distribution: pricing runs vs recorded live runs', `max |z| ${worst.toFixed(2)}`); }

  console.log('\n-- returns per market (every priced selection, settled on independent runs) --');
  const RR = Math.max(300, N >> 1), acc = {};
  const add = (k, pr, win) => { const a = acc[k] || (acc[k] = { s: 0, r: 0, v: 0 }); a.s++; a.r += win ? pr : 0; a.v += .97 * pr; };
  for (let r = 0; r < RR; r++) {
    const h = r % 8, a = (h + 1 + (r >> 3) % 7) % 8, M = G.mkMatch(h, a, 1), s0 = G.newMatch(M), mk = G.mkMarkets(M), outs = [];
    for (let k = 0; k < 2000; k++) outs.push(G.simMatch(s0)); G.setLines(mk, outs); G.priceMarkets(mk, outs);
    const o = G.simMatch(s0); for (const m of mk) for (const x of m.sel) if (x.price) add(m.id, x.price, x.test(o));
    // live: stop somewhere in the match, price the rest, then play it out
    const live = G.cloneMatch(s0), stop = 20 + Math.floor(Math.random() * 110); for (let k = 0; k < stop && !live.done; k++) G.step(live);
    if (live.done) continue;
    const LM = G.liveMarkets(M, live), lo = []; for (let k = 0; k < 300; k++) lo.push(G.simMatch(live)); G.setLines(LM, lo); G.priceMarkets(LM, lo);
    const oL = G.simMatch(live); for (const m of LM) for (const x of m.sel) if (x.price) add('live ' + m.id, x.price, x.test(oL));
  }
  let tot = { s: 0, r: 0, v: 0 };
  for (const [k, a] of Object.entries(acc)) { tot.s += a.s; tot.r += a.r; tot.v += a.v; const rt = a.r / a.s, se = Math.sqrt(a.v) / a.s; check(Math.abs(rt - .97) < 3 * se + .02, `${k.padEnd(9)} returns`, `${(100 * rt).toFixed(1)}% ± ${(300 * se).toFixed(1)} over ${a.s} bets`); }
  const se = Math.sqrt(tot.v) / tot.s; check(Math.abs(tot.r / tot.s - .97) < 3 * se + .01, 'all markets', `${(100 * tot.r / tot.s).toFixed(2)}% ± ${(300 * se).toFixed(1)}`);
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-nrl-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] }), errs = [];
  for (const [w, h, tag] of [[1280, 860, 'pc'], [393, 852, 'phone']]) {
    console.log(`\n-- screens ${w}x${h} --`);
    const pg = await b.newPage({ viewport: { width: w, height: h } });
    pg.on('pageerror', e => errs.push(`${tag}: ${e}`)); pg.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
    await pg.goto('file://' + FILE); await pg.waitForTimeout(1200);
    const shot = async n => pg.screenshot({ path: path.join(out, `${tag}-${n}.png`) });
    await shot('hub'); check(await pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), `${tag}: no sideways scroll on the hub`);
    await pg.evaluate("(()=>{const b=document.querySelector('#hub .pr[data-id]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))})()"); await pg.waitForTimeout(150);
    await pg.click('#place'); await pg.waitForTimeout(150);
    await pg.click('#goM'); await pg.waitForFunction('MT&&MT.priced', null, { timeout: 30000 }); await pg.waitForTimeout(300); await shot('pre');
    check(await pg.evaluate('MT.mk.every(m=>m.sel.every(s=>s.price==null||(s.price>=1.02&&s.price<=501)))'), `${tag}: every price between 1.02 and 501`);
    await pg.click('#ko'); await pg.waitForTimeout(5000); await shot('kickoff');
    check(await pg.evaluate('V.F.filter(f=>f.team>=0&&Math.hypot(f.vx,f.vy)>.3).length>=6'), `${tag}: players are moving`);
    await pg.evaluate('speed=4'); await pg.waitForTimeout(8000); await pg.evaluate('speed=1');
    await pg.waitForFunction("liveOpen()&&MT.live&&[...document.querySelectorAll('#panel [data-lm]')].some(b=>!b.disabled)", null, { timeout: 30000 }).catch(() => {});
    const lid = await pg.evaluate("(()=>{const b=[...document.querySelectorAll('#panel [data-lm]')].find(b=>!b.disabled);if(!b)return null;b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return b.dataset.lid})()");
    if (lid) { await pg.waitForTimeout(300); check(await pg.evaluate('paused'), `${tag}: tapping a live price pauses the match`); await shot('live-bet'); await pg.click('#lyes'); await pg.waitForTimeout(200); check(await pg.evaluate('!paused&&bets.some(b=>b.live)'), `${tag}: live bet placed and play resumed`); }
    else fail(`${tag}: no live price open`);
    await pg.evaluate('speed=4'); await pg.waitForTimeout(6000); await pg.evaluate('speed=1'); await pg.waitForTimeout(500); await shot('mid');
    await pg.click('[data-cam="wide"]'); await pg.waitForTimeout(1200); await shot('wide'); await pg.click('[data-cam="tv"]');
    await pg.click('#skip'); await pg.waitForFunction('phase==="result"', null, { timeout: 20000 }); await pg.waitForTimeout(600); await shot('result');
    check(await pg.evaluate('bets.every(b=>b.settled)'), `${tag}: every bet settled at full time`);
    check(await pg.evaluate('S.season.lad.reduce((a,r)=>a+r.w+r.d+r.l,0)===8'), `${tag}: the whole round went on the ladder`);
    await pg.close();
  }
  console.log('\n-- memory across 8 matches --');
  const pg = await b.newPage({ viewport: { width: 1280, height: 860 } }); pg.on('pageerror', e => errs.push(`mem: ${e}`));
  await pg.goto('file://' + FILE); await pg.waitForTimeout(1000);
  const heap = async () => pg.evaluate('(window.gc&&gc(),performance.memory?performance.memory.usedJSHeapSize/1048576:0)');
  const one = async () => { await pg.evaluate('openMatch(RD.pick)'); await pg.waitForFunction('MT.priced', null, { timeout: 30000 }); await pg.evaluate('startKickOff()'); await pg.waitForTimeout(600);
    await pg.evaluate('(()=>{const s=MT.s;while(!s.done)step(s);finishMatch()})()'); await pg.evaluate('S.season.round>7?(newSeason(),startRound()):nextRound()'); await pg.waitForTimeout(200); };
  await one(); await one(); const h0 = await heap(); for (let k = 0; k < 6; k++) await one(); const h1 = await heap();
  check(h1 - h0 < 25, 'no memory growth over 8 matches', `${h0.toFixed(1)} -> ${h1.toFixed(1)} MB`);
  await b.close();
  check(!errs.length, 'no console errors', errs.slice(0, 4).join(' | '));
  console.log('\nscreens: ' + out);
}
(async () => {
  if (mode === 'sim') sim(); else if (mode === 'ui') await ui(); else { console.log('usage: node test-nrl.js sim|ui'); process.exit(2); }
  const bad = results.filter(x => !x).length; console.log(`\n${results.length - bad}/${results.length} checks passed`); process.exit(bad ? 1 : 0);
})();
