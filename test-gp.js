#!/usr/bin/env node
/* test-gp.js - Stack GP checks.
   node test-gp.js sim [races]   Node only: calibration targets, the live race recording gives the same
                                 results as the pricing runs, and every market returns ~97%
   node test-gp.js ui            Playwright: screens at 1280x860 + 393x852, console errors, a live bet,
                                 and memory across 10 races in a row
   Screenshots go to <tmp>/stack-gp-shots. */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-gp.html');
const mode = process.argv[2] || 'sim';
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);

function loadCore() {
  const src = fs.readFileSync(FILE, 'utf8'), a = src.indexOf('/*==CORE==*/'), b = src.indexOf('/*==END CORE==*/');
  if (a < 0 || b < 0) throw new Error('core markers missing in stack-gp.html');
  const m = { exports: {} };
  new Function('module', src.slice(a, b))(m);
  return m.exports;
}

function sim() {
  const G = loadCore(), N = +process.argv[3] || 120;
  console.log(`\n-- calibration (${N} races per circuit) --`);
  const all = { pole: 0, fav: 0, favN: 0, passes: 0, dnf: 0, sc: [], mg: [], close: 0, n: 0 };
  for (let ci = 0; ci < 6; ci++) {
    let sc = 0;
    for (let r = 0; r < N; r++) {
      const W = G.mkWeekend(ci, 1), grid = G.DRIVERS.map((d, i) => ({ i, t: G.qualiLap(W, i).tot })).sort((a, b) => a.t - b.t).map(o => o.i);
      const st = G.newRace(W, grid, G.startTyres(grid));
      if (r < 20) { const w = new Array(20).fill(0); for (let k = 0; k < 300; k++) w[G.simRace(st).o[0]]++; st._fav = w.indexOf(Math.max(...w)); }
      st.ev = []; G.advance(st, Infinity); const o = G.outcome(st);
      if (st._fav != null) { all.favN++; all.fav += o.o[0] === st._fav; }
      all.pole += o.o[0] === grid[0]; all.passes += st.ev.filter(e => e.ty === 'pass').length; all.dnf += st.dnfs.length; sc += o.sc; all.mg.push(o.m); all.close += o.m < .05; all.n++;
    }
    all.sc.push([G.CIRCUITS[ci].name, sc / N]);
  }
  const n = all.n, med = all.mg.sort((a, b) => a - b)[n >> 1];
  check(all.pole / n > .3 && all.pole / n < .55, 'pole sitter wins', `${(100 * all.pole / n).toFixed(0)}% (target 35-45)`);
  check(all.fav / all.favN > .25 && all.fav / all.favN < .6, 'pre-race favourite wins', `${(100 * all.fav / all.favN).toFixed(0)}% (target 30-40, ${all.favN} races)`);
  check(all.passes / n > 12 && all.passes / n < 45, 'on-track passes per race', (all.passes / n).toFixed(1));
  check(all.sc.every(([, p]) => p > .2 && p < .7), 'safety car rate by circuit', all.sc.map(([c, p]) => c.split(' ')[0] + ' ' + Math.round(100 * p) + '%').join(', '));
  check(all.dnf / n > .2 && all.dnf / n < 3, 'DNFs per race', (all.dnf / n).toFixed(2));
  check(med > .5 && med < 8, 'median winning margin', med.toFixed(2) + 's');
  check(all.close > 0, 'photo finishes happen', `${(100 * all.close / n).toFixed(1)}% under 0.05s`);

  console.log('\n-- the watched race is the priced race --');
  // the viewer records timelines + events; that must not change what happens
  { const W = G.mkWeekend(2, 1), grid = [...Array(20).keys()], ty = G.startTyres(grid), base = G.newRace(W, grid, ty), a = new Array(20).fill(0), b = new Array(20).fill(0), R = 3000;
    for (let k = 0; k < R; k++) a[G.simRace(base).o[0]]++;
    for (let k = 0; k < R; k++) { const st = G.cloneRace(base); st.rec = true; st.ev = []; st.lb = []; st.cars.forEach(c => c.tl = []); st.sc.tl = []; G.advance(st, Infinity); b[G.outcome(st).o[0]]++; }
    let worst = 0; for (let i = 0; i < 20; i++) { const p = (a[i] + b[i]) / (2 * R), se = Math.sqrt(2 * p * (1 - p) / R) || 1e-9; worst = Math.max(worst, Math.abs(a[i] - b[i]) / R / se); }
    check(worst < 4.5, 'winner distribution: pricing runs vs recorded live runs', `max |z| ${worst.toFixed(2)}`); }

  console.log('\n-- returns per market (every priced selection, settled on independent runs) --');
  const RR = Math.max(150, N * 2), acc = {};
  const add = (k, pr, win) => { const a = acc[k] || (acc[k] = { s: 0, r: 0, v: 0 }); a.s++; a.r += win ? pr : 0; a.v += .97 * pr; };
  for (let r = 0; r < RR; r++) {
    const W = G.mkWeekend(r % 6, 1), pp = G.qualiMC(W, 20000), grid = G.DRIVERS.map((d, i) => ({ i, t: G.qualiLap(W, i).tot })).sort((a, b) => a.t - b.t).map(o => o.i);
    pp.forEach((p, i) => { const pr = G.priceOf(p, 20000); if (pr) add('pole', pr, grid[0] === i); });
    const st = G.newRace(W, grid, G.startTyres(grid)), M = G.mkMarkets(W, grid), outs = []; for (let k = 0; k < 2000; k++) outs.push(G.simRace(st)); G.setLine(M, outs); G.priceMarkets(M, outs);
    const real = G.cloneRace(st); G.advance(real, Infinity); const o = G.outcome(real);
    for (const m of M) for (const s of m.sel) if (s.price) add(m.id, s.price, s.test(o));
    const live = G.cloneRace(st); G.advance(live, W.T.lapRef * (1 + Math.random() * (W.N - 3))); const snap = G.cloneRace(live); snap.pitSeq = [];
    const ord = live.cars.filter(c => !c.dnf && !c.fin).sort((a, b) => b.lap - a.lap || (b.kind === 1 ? W.T.K - 1 : b.k) - (a.kind === 1 ? W.T.K - 1 : a.k) || a.tIn - b.tIn).map(c => c.i);
    const LM = G.liveMarkets(ord.slice(0, 5)), lo = []; for (let k = 0; k < 300; k++) lo.push(G.simRace(snap)); G.priceMarkets(LM, lo);
    const from = live.pitSeq.length; G.advance(live, Infinity); const oL = G.outcome(live), oNP = { ...oL, pit: live.pitSeq.slice(from) };
    for (const m of LM) for (const s of m.sel) if (s.price) add('live ' + m.id, s.price, s.test(m.id === 'np' ? oNP : oL));
  }
  // a bet at price p pays p with chance ~0.97/p, so its variance is ~0.97p: allow 3 standard errors
  let tot = { s: 0, r: 0, v: 0 };
  for (const [k, a] of Object.entries(acc)) { tot.s += a.s; tot.r += a.r; tot.v += a.v; const rt = a.r / a.s, se = Math.sqrt(a.v) / a.s; check(Math.abs(rt - .97) < 3 * se + .02, `${k.padEnd(8)} returns`, `${(100 * rt).toFixed(1)}% ± ${(300 * se).toFixed(1)} over ${a.s} bets`); }
  const se = Math.sqrt(tot.v) / tot.s; check(Math.abs(tot.r / tot.s - .97) < 3 * se + .01, 'all markets', `${(100 * tot.r / tot.s).toFixed(2)}% ± ${(300 * se).toFixed(1)}`);
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-gp-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] }), errs = [];
  for (const [w, h, tag] of [[1280, 860, 'pc'], [393, 852, 'phone']]) {
    console.log(`\n-- screens ${w}x${h} --`);
    const pg = await b.newPage({ viewport: { width: w, height: h } });
    pg.on('pageerror', e => errs.push(`${tag}: ${e}`)); pg.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
    await pg.goto('file://' + FILE); await pg.waitForTimeout(1200);
    const shot = async n => pg.screenshot({ path: path.join(out, `${tag}-${n}.png`) });
    await shot('hub');
    check(await pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), `${tag}: no sideways scroll on the hub`);
    await pg.evaluate("(()=>{const b=document.querySelector('#hbody .pr[data-id]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))})()");
    await pg.waitForTimeout(150); await shot('pole-slip');
    await pg.click('#goQ'); await pg.waitForTimeout(9000); await shot('quali');
    await pg.click('#qskip'); await pg.waitForFunction('phase==="grid"&&WK.priced', null, { timeout: 30000 }); await pg.waitForTimeout(300);
    await pg.evaluate("(()=>{const b=document.querySelector('#panel .pr[data-id]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))})()"); await pg.waitForTimeout(150); await shot('grid-slip');
    check(await pg.evaluate('WK.M.every(m=>m.sel.every(s=>s.price==null||(s.price>=1.02&&s.price<=501)))'), `${tag}: every price between 1.02 and 501`);
    await pg.click('#lo'); await pg.waitForFunction('phase==="race"', null, { timeout: 15000 }); await pg.waitForTimeout(1600); await shot('start');
    // a live bet: pauses, reprices, resumes
    await pg.evaluate('speed=4'); await pg.waitForTimeout(6000); await pg.evaluate('speed=1'); await pg.waitForTimeout(400);
    // markets can be suspended (safety car); wait for them to reopen
    await pg.waitForFunction("liveOpen()&&WK.live&&[...document.querySelectorAll('#panel [data-lm]')].some(b=>!b.disabled)", null, { timeout: 30000 }).catch(() => {});
    const lid = await pg.evaluate("(()=>{const b=[...document.querySelectorAll('#panel [data-lm]')].find(b=>!b.disabled);if(!b)return null;b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return b.dataset.lid})()");
    if (lid) { await pg.waitForTimeout(300); check(await pg.evaluate('paused'), `${tag}: tapping a live price pauses the race`); await shot('live-bet'); await pg.click('#lyes'); await pg.waitForTimeout(200); check(await pg.evaluate('!paused&&bets.some(b=>b.live)'), `${tag}: live bet placed and race resumed`); }
    else fail(`${tag}: no live price open`);
    await pg.evaluate('speed=4'); await pg.waitForTimeout(8000); await pg.evaluate('speed=1'); await shot('mid');
    // jump the viewer to moments this race had: a pit stop and (if any) the safety car
    const seek = async (ty, name) => { const e = await pg.evaluate(`(()=>{advance(WK.st,V.t+60);const e=WK.st.ev.find(e=>e.ty==='${ty}'&&e.t>V.t);return e?{t:e.t,a:e.a}:null})()`);
      if (e == null) { console.log(`  --   no ${ty} in this race`); return; }
      await pg.evaluate(`V.t=${e.t}+(${ty === 'sc' ? 6 : 0.2});${ty === 'pit' ? `V.focus=[${e.a}];V.focusSC=false;V.shot={f:[${e.a}]};V.shotScore=20;V.nextCut=V.t+30;` : ''}V.cutFrom=1`); await pg.waitForTimeout(1200); await shot(name); pass(`${tag}: ${name} shown`); };
    await seek('pit', 'pit-stop'); await seek('sc', 'safety-car');
    await pg.click('#skip'); await pg.waitForFunction('phase==="result"', null, { timeout: 40000 }); await pg.waitForTimeout(1500); await shot('result');
    check(await pg.evaluate('bets.every(b=>b.settled)'), `${tag}: every bet settled at the flag`);
    await pg.close();
  }
  console.log('\n-- memory across 10 races --');
  const pg = await b.newPage({ viewport: { width: 1280, height: 860 } }); pg.on('pageerror', e => errs.push(`mem: ${e}`));
  await pg.goto('file://' + FILE); await pg.waitForTimeout(1000);
  const heap = async () => pg.evaluate('(window.gc&&gc(),performance.memory?performance.memory.usedJSHeapSize/1048576:0)');
  const oneRace = async () => {
    await pg.evaluate('startQuali()'); await pg.evaluate('V.t=WK.quali.end+2'); await pg.waitForFunction('phase==="grid"&&WK.priced', null, { timeout: 30000 });
    await pg.evaluate('lightsOut();V.startClock=99'); await pg.waitForFunction('phase==="race"', null, { timeout: 10000 });
    await pg.evaluate('advance(WK.st,Infinity);V.t=WK.st.fin-.01'); await pg.waitForFunction('phase==="result"', null, { timeout: 30000 });
    await pg.evaluate('S.season.round>=6?(newSeason(),startWeekend()):nextGP()'); await pg.waitForTimeout(300); };
  await oneRace(); await oneRace(); const h0 = await heap();
  for (let k = 0; k < 8; k++) await oneRace();
  const h1 = await heap(); check(h1 - h0 < 25, 'no memory growth over 10 races', `${h0.toFixed(1)} -> ${h1.toFixed(1)} MB`);
  await b.close();
  check(!errs.length, 'no console errors', errs.slice(0, 4).join(' | '));
  console.log('\nscreens: ' + out);
}

(async () => {
  if (mode === 'sim') sim(); else if (mode === 'ui') await ui(); else { console.log('usage: node test-gp.js sim|ui'); process.exit(2); }
  const bad = results.filter(x => !x).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})();
