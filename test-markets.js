#!/usr/bin/env node
/* test-markets.js - Stack Markets v2 checks.
   node test-markets.js sim   Node only: every product is priced from the live model and returns inside the
                              house band (96-99%) when played out on that same model, from many random market
                              states (pending company news, market calls, flash moves): leveraged trades,
                              targets, up/down, options, predictions, IPO openings, and holding shares
   node test-markets.js ui    Playwright: every section renders; a trade, an investment, an option, a
                              prediction and an IPO order go through on the wallet; everything is saved and
                              restored; no console errors */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, 'stack-markets.html');
const mode = process.argv[2] || 'sim', results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function core() { const src = fs.readFileSync(FILE, 'utf8'), m = { exports: {} }; new Function('module', src.slice(src.indexOf('/*==CORE==*/'), src.indexOf('/*==END CORE==*/')))(m); return m.exports; }
const pct = x => (x * 100).toFixed(2) + '%';
function sim() {
  const K = core(), { DT, STOCKS, HOUSE } = K, bySym = s => STOCKS.find(S => S.sym === s);
  /* a random live state: run the market a random while so news and market calls are pending at random times */
  const state = S => { const st = { p: S.p0, pend: null }, G = { pend: null }, n = 40 + Math.floor(Math.random() * 400); for (let k = 0; k < n; k++) { K.applyG(K.stepGlobal(G), S, st); K.stepStock(S, st); } return { st, G }; };
  const clone = (st, G) => ({ st: { p: st.p, pend: st.pend ? { t: st.pend.t, x: st.pend.x } : null }, G: { pend: G.pend ? { t: G.pend.t, e: G.pend.e } : null } });
  const walk = (S, s0, N, each) => { const { st, G } = clone(s0.st, s0.G), p0 = st.p; for (let k = 1; k <= N; k++) { K.applyG(K.stepGlobal(G), S, st); K.stepStock(S, st); if (each && each(st.p / p0, k)) return st.p / p0; } return st.p / p0; };
  const band = r => r >= .96 && r <= .99;
  console.log('\n-- leveraged trades (fee from the model, played out on the model) --');
  for (const [sym, dir, L, T, tp, sl] of [['GLDN', 1, 20, 30, 0, 0], ['AURA', -1, 10, 120, 0, 0], ['VLTC', 1, 5, 60, 1, .5], ['SHRK', -1, 3, 30, 0, 0], ['MOON', 1, 3, 60, 3, 0], ['AUDUSD', 1, 50, 15, 0, 0]]) {
    const S = bySym(sym), N = T / DT; let paid = 0, got = 0;
    for (let s = 0; s < 36; s++) { const s0 = state(S), q = K.mcTrade(S, s0.st, s0.G, { dir, L, N, tp, sl }, 900), fee = K.feeFor(1000, q.ev) / 1000;
      for (let j = 0; j < 300; j++) { let V = 1; walk(S, s0, N, (r, k) => { V = 1 + L * dir * (r - 1); if (V <= 0) { V = 0; return 1; } if (tp && V >= 1 + tp) return 1; if (sl && V <= 1 - sl) return 1; return 0; }); paid += 1 + fee; got += V; } }
    check(band(got / paid), `${sym} ${dir > 0 ? 'long' : 'short'} ${L}x ${T}s${tp ? ' TP+' + tp * 100 + '%' : ''}${sl ? ' SL-' + sl * 100 + '%' : ''}`, pct(got / paid));
  }
  console.log('\n-- targets and up/down --');
  for (const [sym, rel, T] of [['NVRX', .02, 30], ['OIL', -.03, 60], ['SHRK', .1, 60], ['STK', .005, 30]]) {
    const S = bySym(sym), N = T / DT; let paid = 0, got = 0;
    /* a target pays rarely, so each live quote (4000 paths) is scored against the true chance from 40,000 fresh paths */
    for (let s = 0; s < 48; s++) { const s0 = state(S), m = K.multFor(K.mcTarget(S, s0.st, s0.G, rel, N, 4000)); if (m < 1.05 || m > 100) continue;
      paid++; got += m * K.mcTarget(S, s0.st, s0.G, rel, N, 40000); }
    check(band(got / paid), `target ${sym} ${rel > 0 ? '+' : ''}${rel * 100}% in ${T}s`, pct(got / paid));
  }
  for (const [sym, T] of [['PXFX', 30], ['NBLA', 120], ['GLDN', 15]]) {
    const S = bySym(sym), N = T / DT; let paid = 0, got = 0;
    for (let s = 0; s < 40; s++) { const s0 = state(S), P = K.mcUpDown(S, s0.st, s0.G, N, 3000), mu = Math.min(100, K.multFor(P)), md = Math.min(100, K.multFor(1 - P));
      for (let j = 0; j < 300; j++) { const r = walk(S, s0, N); paid += 2; if (r > 1) got += mu; if (r < 1) got += md; } }
    check(band(got / paid), `up/down ${sym} ${T}s (both sides)`, pct(got / paid));
  }
  console.log('\n-- options (chain pricing vs a full simulation) --');
  { let worst = 0, paid = 0, got = 0, cnt = 0;
    for (const [sym, T] of [['STK', 60], ['VLTC', 120], ['SHRK', 60], ['OIL', 300], ['AURA', 30], ['NVRX', 120]]) {
      const S = bySym(sym), N = T / DT;
      for (let s = 0; s < 6; s++) { const s0 = state(S), typ = Math.sqrt(S.sig * S.sig * T + S.jr * T * S.js * S.js + (S.evRate || 0) * T * S.evX * S.evX);
        const Ks = [-1.5, -.5, 0, .5, 1.5].map(z => s0.st.p * Math.exp(z * typ)), ch = K.chainFair(S, s0.st, s0.G, Ks, N, 8000), ch2 = K.chainFair(S, s0.st, s0.G, Ks, N, 8000);
        const outs = []; for (let j = 0; j < 6000; j++) outs.push(s0.st.p * walk(S, s0, N));
        for (const [q, o] of ch.entries()) for (const d of [1, -1]) { const fair = d > 0 ? o.c : o.p, sf = Math.abs(fair - (d > 0 ? ch2[q].c : ch2[q].p)) / Math.SQRT2; if (fair < s0.st.p * 5e-4) continue; const pay = outs.map(x => Math.max(0, d * (x - o.K))), mc = pay.reduce((a, x) => a + x, 0) / pay.length;
          const se = Math.sqrt(pay.reduce((a, x) => a + (x - mc) * (x - mc), 0)) / pay.length;
          paid += fair / HOUSE; got += mc; cnt++; worst = Math.max(worst, Math.abs(fair - mc) / (Math.hypot(se, sf) + .02 * mc)); } } }
    check(band(got / paid), `options return (${cnt} contracts across 6 markets, 5 strikes, calls + puts)`, pct(got / paid));
    check(worst < 4, 'each premium matches the simulated fair value (within simulation + quote noise + 2%)', 'worst ' + worst.toFixed(2) + ' noise units'); }
  console.log('\n-- prediction contracts --');
  { let paid = 0, got = 0, maxErr = 0;
    for (const sym of ['STK', 'GLDN', 'OIL', 'AUDUSD', 'VLTC', 'NVRX']) { const S = bySym(sym);
      for (let s = 0; s < 12; s++) { const s0 = state(S), T = [60, 120, 300][s % 3], N = T / DT, L = s0.st.p * Math.exp((Math.random() - .5) * 1.2 * Math.sqrt(S.sig * S.sig * T + S.jr * T * S.js * S.js)), P = K.pAbove(S, s0.st, s0.G, L, N, 3000);
        let up = 0; const n = 4000; for (let j = 0; j < n; j++) if (s0.st.p * walk(S, s0, N) > L) up++; maxErr = Math.max(maxErr, Math.abs(P - up / n));
        for (const [sp, won] of [[P, up / n], [1 - P, 1 - up / n]]) if (K.canBuy(sp)) { paid += K.yesAsk(sp); got += won; } } }
    check(maxErr < .035, 'live quotes match the simulated chance', 'worst gap ' + (maxErr * 100).toFixed(1) + ' points');
    check(band(got / paid), 'price contracts return in the band (YES and NO)', pct(got / paid));
    const ev = .5 / K.yesAsk(.5); check(band(ev), 'a 50/50 event contract costs ' + (K.yesAsk(.5) * 100).toFixed(1) + 'c', pct(ev));
    let worstB = 1, worstT = 0; for (let P = K.P_MIN; P <= K.P_MAX + 1e-9; P += .001) { worstB = Math.min(worstB, P / K.yesAsk(P)); worstT = Math.max(worstT, P / K.yesAsk(P)); }
    check(worstB >= .965 && worstT <= .97 + 1e-9, 'every buyable price returns 96.5-97% (rounding included)', pct(worstB) + ' to ' + pct(worstT));
    check(K.yesBid(.6) < .6 && K.yesAsk(.6) > .6, 'selling back pays below the fair price, buying costs above it'); }
  console.log('\n-- ranges, touches and head to head --');
  { let worst = 0, paid = 0, got = 0;
    for (const sym of ['GLDN', 'OIL', 'VLTC', 'NVRX']) { const S = bySym(sym);
      for (let s = 0; s < 6; s++) { const s0 = state(S), T = [120, 180, 300][s % 3], N = T / DT, typ = Math.sqrt(S.sig * S.sig * T + S.jr * T * S.js * S.js + S.evRate * T * S.evX * S.evX), e = [-1, -.35, .35, 1].map(z => s0.st.p * Math.exp(z * typ));
        const P = K.pBuckets(S, s0.st, s0.G, e, N, 3000), c = [0, 0, 0, 0, 0], n = 5000; for (let j = 0; j < n; j++) { const x = s0.st.p * walk(S, s0, N); let b = 0; while (b < 4 && x > e[b]) b++; c[b]++; }
        P.forEach((q, k) => { worst = Math.max(worst, Math.abs(q - c[k] / n)); if (K.canBuy(q)) { paid += K.yesAsk(q); got += c[k] / n; } }); } }
    check(worst < .035, 'range buckets match the simulated chance', 'worst gap ' + (worst * 100).toFixed(1) + ' points');
    check(band(got / paid), 'range contracts return in the band', pct(got / paid)); }
  { let worst = 0, paid = 0, got = 0;
    for (const [a, b] of [['VLTC', 'NBLA'], ['GLDN', 'OIL'], ['AURA', 'STK'], ['MOON', 'SHRK']]) { const A = bySym(a), B = bySym(b);
      for (let s = 0; s < 5; s++) { const sa = state(A), sb = state(B), G = sa.G, N = [60, 120, 240][s % 3] / DT, lead = (Math.random() - .5) * .01, P = K.pBeat(A, sa.st, B, sb.st, G, N, 3000, lead); let w = 0; const n = 5000;
        for (let j = 0; j < n; j++) { const x = { p: sa.st.p, pend: sa.st.pend ? { t: sa.st.pend.t } : null }, y = { p: sb.st.p, pend: sb.st.pend ? { t: sb.st.pend.t } : null }, G2 = { pend: G.pend ? { t: G.pend.t, e: G.pend.e } : null };
          for (let k = 0; k < N; k++) { const g = K.stepGlobal(G2); K.applyG(g, A, x); K.applyG(g, B, y); K.stepStock(A, x); K.stepStock(B, y); } if (lead + Math.log(x.p / sa.st.p) > Math.log(y.p / sb.st.p)) w++; }
        worst = Math.max(worst, Math.abs(P - w / n)); for (const [q, r] of [[P, w / n], [1 - P, 1 - w / n]]) if (K.canBuy(q)) { paid += K.yesAsk(q); got += r; } } }
    check(worst < .035, 'head to head matches a joint simulation (shared market calls)', 'worst gap ' + (worst * 100).toFixed(1) + ' points');
    check(band(got / paid), 'head-to-head contracts return in the band', pct(got / paid)); }
  { let paid = 0, got = 0;
    for (const [sym, rel, T] of [['VLTC', .02, 90], ['OIL', -.015, 120], ['SHRK', .05, 60], ['NVRX', -.02, 180]]) { const S = bySym(sym), N = T / DT;
      for (let s = 0; s < 8; s++) { const s0 = state(S), q = K.mcTarget(S, s0.st, s0.G, rel, N, 2400), tr = K.mcTarget(S, s0.st, s0.G, rel, N, 30000); for (const [a, b] of [[q, tr], [1 - q, 1 - tr]]) if (K.canBuy(a)) { paid += K.yesAsk(a); got += b; } } }
    check(band(got / paid), 'touch contracts (YES and NO) return in the band', pct(got / paid)); }
  console.log('\n-- earnings season and moving TP / SL --');
  { /* a scheduled earnings report (bigger size, known time) is in every price */
    let gap = 0, paid = 0, got = 0, tp = 0, tg = 0;
    for (const sym of ['MOON', 'SHRK', 'NVRX', 'AURA']) { const S = bySym(sym);
      for (let s = 0; s < 6; s++) { const s0 = state(S); s0.st.pend = { t: Math.round((10 + Math.random() * 150) / DT) * DT, x: K.EARNX[sym], k: 'earn' }; const T = [60, 120, 240][s % 3], N = T / DT;
        const L = s0.st.p * Math.exp((Math.random() - .5) * .1), P = K.pAbove(S, s0.st, s0.G, L, N, 3000); let up = 0; const n = 5000; for (let j = 0; j < n; j++) if (s0.st.p * walk(S, s0, N) > L) up++; gap = Math.max(gap, Math.abs(P - up / n));
        const ch = K.chainFair(S, s0.st, s0.G, [s0.st.p], N, 8000)[0], outs = []; for (let j = 0; j < 4000; j++) outs.push(walk(S, s0, N) * s0.st.p);
        paid += (ch.c + ch.p) / HOUSE; got += outs.reduce((a, x) => a + Math.abs(x - s0.st.p), 0) / outs.length;
        const q = K.mcTrade(S, s0.st, s0.G, { dir: 1, L: 2, N, tp: 0, sl: 0 }, 900), fee = K.feeFor(1000, q.ev) / 1000;
        for (let j = 0; j < 300; j++) { let V = 1; walk(S, s0, N, r => { V = 1 + 2 * (r - 1); if (V <= 0) { V = 0; return 1; } return 0; }); tp += 1 + fee; tg += V; } } }
    check(gap < .035, 'price contracts know about a scheduled earnings report', 'worst gap ' + (gap * 100).toFixed(1) + ' points');
    check(band(got / paid), 'options across an earnings report return in the band (straddles)', pct(got / paid));
    check(band(tg / tp), 'trades across an earnings report return in the band', pct(tg / tp)); }
  { /* open a trade, then move its take profit / stop loss part way through; the fee change keeps it fair */
    let paid = 0, got = 0;
    for (const [sym, L, T, a, b] of [['VLTC', 5, 60, { tp: 0, sl: 0 }, { tp: .3, sl: .2 }], ['AUDUSD', 50, 30, { tp: 0, sl: 0 }, { tp: 0, sl: .3 }], ['MOON', 3, 60, { tp: .5, sl: .25 }, { tp: 0, sl: 0 }], ['GLDN', 20, 30, { tp: 0, sl: .5 }, { tp: 1, sl: 0 }]]) {
      const S = bySym(sym), N = T / DT, k0 = Math.round(N / 3);
      for (let s = 0; s < 20; s++) { const s0 = state(S), q = K.mcTrade(S, s0.st, s0.G, { dir: 1, L, N, ...a }, 900), fee = K.feeFor(1000, q.ev) / 1000;
        for (let j = 0; j < 60; j++) { const { st, G } = clone(s0.st, s0.G), p0 = st.p; let V = 1, done = false, extra = 0;
          for (let k = 1; k <= N && !done; k++) { K.applyG(K.stepGlobal(G), S, st); K.stepStock(S, st); V = 1 + L * (st.p / p0 - 1); const lim = k <= k0 ? a : b;
            if (V <= 0) { V = 0; done = true; } else if (lim.tp && V >= 1 + lim.tp || lim.sl && V <= 1 - lim.sl) done = true;
            if (k === k0 && !done) { const [ea, eb] = K.mcExit2(S, st, G, { dir: 1, L, p0, N: N - k }, a, b, 600); extra = (eb - ea) / HOUSE; } }
          paid += 1 + fee + extra; got += V; } } }
    check(band(got / paid), 'moving TP / SL mid-trade (fee re-balanced) still returns in the band', pct(got / paid)); }
  console.log('\n-- IPOs and holding shares --');
  { let s = 0; const n = 400000; for (let i = 0; i < n; i++) s += K.ipoOpen(20) / 20; const m = s / n;
    check(Math.abs(m - K.IPO_MEAN) < .004, 'IPOs open at 98.5% of the IPO price on average', pct(m));
    check(band(m * (1 - K.SPREAD)), 'flipping an IPO at the bid returns', pct(m * (1 - K.SPREAD))); }
  for (const sym of ['AURA', 'GLDN', 'NVRX']) { const S = bySym(sym), T = 540, N = T / DT; let tot = 0; const n = 3000;
    for (let j = 0; j < n; j++) { const s0 = state(S); let r = walk(S, s0, N); tot += r * Math.pow(1 - (S.div || 0), -T / 180) ; }
    check(Math.abs(tot / n - 1) < .02, `${sym}: holding is fair (price${S.div ? ' + dividends' : ''} averages what you paid)`, pct(tot / n)); }
  check(band((1 - K.SPREAD) / (1 + K.SPREAD)), 'buying then selling costs the 3% spread', pct((1 - K.SPREAD) / (1 + K.SPREAD)));
  console.log('\n-- stakes --');
  check(['STK', 'GLDN', 'OIL', 'AUDUSD', 'AURA'].every(s => bySym(s).maxStake === 1e6) && bySym('PNYM').maxStake === 2e4 && STOCKS.filter(S => !/STK|GLDN|OIL|AUDUSD|AURA|PNYM/.test(S.sym)).every(S => S.maxStake === 1e5), 'max stakes: $1M majors, $100K others, $20K Penny Mining');
}
async function ui() {
  const playwright = require('playwright'); const b = await playwright.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1600, height: 900 } }); pg.on('pageerror', e => errs.push('' + e));
  await pg.goto('file://' + FILE); await pg.waitForTimeout(500); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.waitForTimeout(1500);
  check(await pg.evaluate("!!document.querySelector('.help')"), 'first visit shows the welcome');
  await pg.click('#helpGo'); await pg.evaluate('credit(5e6)');
  const secs = await pg.evaluate("(()=>{const o={};for(const k of['term','port','opt','pred','ipo','pulse','guide']){showSec(k);o[k]=document.querySelector('.sec.on').textContent.length}showSec('term');return o})()");
  check(Object.values(secs).every(n => n > 150), 'all seven sections render', JSON.stringify(secs));
  check(await pg.evaluate("[...document.querySelectorAll('#chips,.chips button')].some(b=>b.textContent==='$1M')&&STOCKS[0].maxStake===1e6"), 'stake chips go up to $1M');
  await pg.evaluate('select(1)'); await pg.click('[data-c="100000"]'); await pg.click('#levs [data-v="10"]'); await pg.waitForTimeout(300);
  const b0 = await pg.evaluate('getBal()'); await pg.click('#go'); await pg.waitForTimeout(200);
  const tr = await pg.evaluate('({n:positions.length,cost:positions[0]&&positions[0].cost,stake:positions[0]&&positions[0].stake,bal:getBal()})');
  check(tr.n === 1 && tr.stake === 1e5 && Math.abs(b0 - tr.bal - tr.cost) < .01, 'a $100K 10x trade takes stake + fee from the wallet', JSON.stringify(tr));
  const co = await pg.evaluate("(()=>{const b=getBal(),v=valueOf(positions[0]);cashOut(positions[0].id);return{n:positions.length,got:+(getBal()-b).toFixed(2),v:+v.toFixed(2)}})()");
  check(co.n === 0 && Math.abs(co.got - co.v) < .02, 'cashing out pays the live value', JSON.stringify(co));
  await pg.evaluate('select(4)'); await pg.click('[data-t="invest"]'); await pg.click('[data-ic="10000"]'); await pg.waitForTimeout(200); await pg.click('#go');
  const inv = await pg.evaluate("({h:save.port.AURA,ask:askOf(M[4].p)})");
  check(inv.h && inv.h.cost === 1e4 && Math.abs(inv.h.q * inv.ask - 1e4) / 1e4 < .01, 'investing buys shares at the ask', `${inv.h && inv.h.q.toFixed(2)} AURA`);
  await pg.evaluate("showSec('opt')"); await pg.waitForTimeout(300); await pg.click('#chain td[data-d="1"]'); await pg.waitForTimeout(300); await pg.click('[data-oc="10000"]'); await pg.waitForTimeout(200);
  const ob = await pg.evaluate('getBal()'); await pg.click('#oGo'); await pg.waitForTimeout(200);
  const op = await pg.evaluate('({n:OPTS.length,o:OPTS[0],bal:getBal()})');
  check(op.n === 1 && op.o.cost === 1e4 && Math.abs(op.o.units * op.o.prem - 1e4) < .01 && Math.abs(ob - op.bal - 1e4) < .01, 'buying a call: stake / premium = units', `${op.o && op.o.units.toFixed(1)} units at $${op.o && op.o.prem.toFixed(2)}`);
  const ex = await pg.evaluate("(()=>{const o=OPTS[0],b=getBal();T=o.exp;resolveOpts();return{n:OPTS.length,paid:+(getBal()-b).toFixed(2),iv:+(o.units*Math.max(0,M[o.i].p-o.K)).toFixed(2)}})()");
  check(ex.n === 0 && Math.abs(ex.paid - ex.iv) < .02, 'an option settles to units x (price - strike)', JSON.stringify(ex));
  await pg.evaluate("showSec('pred')"); await pg.waitForTimeout(300);
  await pg.evaluate("PF='px';drawPred()");await pg.click('[data-buy][data-side="1"]:not([disabled])'); const pr = await pg.evaluate("(()=>{const o=PRED_OWN[0],c=PRED.find(x=>x.id===o.cid);return{o,kind:c.kind}})()");
  check(pr.o && pr.o.cost === 1000 && pr.o.n > 1000, 'a prediction buys $1 contracts below $1 each', `${pr.o.n.toFixed(0)} YES (${pr.kind})`);
  const ps = await pg.evaluate("(()=>{const o=PRED_OWN[0],c=PRED.find(x=>x.id===o.cid),b=getBal();settleContract(c,true);return{left:PRED_OWN.length,paid:+(getBal()-b).toFixed(2),n:+o.n.toFixed(2)}})()");
  check(ps.left === 0 && Math.abs(ps.paid - ps.n) < .02, 'a YES that comes true pays $1 a contract', JSON.stringify(ps));
  await pg.evaluate("IPO.t=1;showSec('ipo')"); await pg.waitForTimeout(1600);
  await pg.evaluate("$('iAmt').value=20000"); await pg.click('#iGo');
  const sym = await pg.evaluate('IPO.d.sym'); await pg.evaluate('IPO.t=1'); await pg.waitForTimeout(7500);
  const ip = await pg.evaluate(`({st:IPO.st,listed:byS('${sym}'),h:save.port['${sym}'],ipo:IPO.last.d.ipo})`);
  check(ip.st === 'soon' && ip.listed > 0 && ip.h && Math.abs(ip.h.q * ip.ipo - 2e4) < .01, 'an IPO order becomes shares at the IPO price and the stock lists', `${sym}: ${ip.h && ip.h.q.toFixed(0)} shares`);
  await pg.evaluate("select(1)"); await pg.click('[data-t="trade"]'); await pg.click('#go'); await pg.waitForTimeout(200);
  await pg.evaluate("showSec('opt')"); await pg.waitForTimeout(300); await pg.click('#chain td[data-d="-1"]'); await pg.waitForTimeout(300); await pg.click('#oGo');
  const before = await pg.evaluate("snapshot();persist();({pos:positions.map(o=>o.stake),opts:OPTS.length,port:Object.keys(save.port).sort().join(),n:STOCKS.length,p:M[4].p})");
  await pg.reload(); await pg.waitForTimeout(1500);
  const after = await pg.evaluate("({pos:positions.map(o=>o.stake),opts:OPTS.length,port:Object.keys(save.port).sort().join(),n:STOCKS.length,p:M[4].p})");
  check(JSON.stringify(before.pos) === JSON.stringify(after.pos) && before.opts === after.opts && before.port === after.port && before.n === after.n && Math.abs(before.p / after.p - 1) < .02,
    'bets, options, holdings, IPO listings and prices survive a reload', JSON.stringify(after));
  for (const k of ['port', 'pulse']) { await pg.evaluate(`showSec('${k}')`); await pg.waitForTimeout(1100); }
  check(await pg.evaluate("document.querySelectorAll('#pfHold tr').length>=3"), 'the portfolio lists the holdings');
  check(await pg.evaluate("document.querySelector('#nav button').dataset.s==='port'"), 'Portfolio is first in the nav');
  /* charts: every timeframe and type draws, company page */
  await pg.evaluate("showSec('term')");
  const ch = await pg.evaluate(`(()=>{const out=[];for(let r=0;r<RANGES.length;r++)for(const t of['candle','bar','ha','line','area']){CV.r=r;CV.type=t;CV.rsi=true;CV.bb=true;CV.log=r>8;yLo=null;MX=300;MY=200;try{drawChart();out.push(1)}catch(e){out.push(RANGES[r].k+' '+t+': '+e.message)}}MX=MY=null;CV.rsi=CV.bb=CV.log=false;CV.r=2;return out.filter(x=>x!==1)})()`);
  check(ch.length === 0, 'the chart draws on all 12 timeframes x 5 chart types with every overlay', ch.slice(0, 2).join(' | '));
  const hs = await pg.evaluate("(()=>{const H=hist(STOCKS[1]);return{n:H.d.length,last:H.d[H.d.length-1].c,wk:H.wk.length,h:H.h.length,same:hist(STOCKS[1])===H}})()");
  check(hs.n > 3000 && Math.abs(hs.last - 1) < 1e-9 && hs.h === 168 && hs.same, 'company history is years long and joins today\'s open exactly', JSON.stringify(hs));
  await pg.click('[data-b="co"]'); await pg.waitForTimeout(200);
  check(await pg.evaluate("/Performance/.test($('blist').textContent)&&/All-time high/.test($('blist').textContent)"), 'the Company tab shows the profile, performance and key numbers');
  /* IPO: jump to it on launch */
  await pg.evaluate("showSec('ipo')"); await pg.click('#iJump'); await pg.evaluate("IPO.st='bell';IPO.t=0.5;IPO.d=nextIpoDeal();IPO.sub=0");
  const sym2 = await pg.evaluate('IPO.d.sym'); await pg.waitForTimeout(1600);
  check(await pg.evaluate(`SEC==='term'&&STOCKS[sel].sym==='${sym2}'&&save.ipoJump===true`), 'with "jump to it on launch" ticked, a listing opens that stock in the Terminal', sym2);
  /* predictions: build your own, ranges, head to head, touch */
  await pg.evaluate("showSec('pred');pu.stake=500;pb.i=byS('OIL');pb.type='px';pb.T=120;pb.z=.3;buildBuilder()"); await pg.waitForTimeout(400);
  const bo = await pg.evaluate("(()=>{const n=PRED_OWN.length;$('bYes').click();const o=PRED_OWN[PRED_OWN.length-1],c=PRED.find(x=>x.id===o.cid);return{made:PRED_OWN.length-n,mine:c.mine,kind:c.kind,cost:o.cost}})()");
  check(bo.made === 1 && bo.mine && bo.cost === 500, 'Build your own makes a contract and buys it', JSON.stringify(bo));
  const rg = await pg.evaluate("(()=>{const c=PRED.find(x=>x.kind==='rng'&&!x.done&&cOpen(x)&&canBuy(x.P));if(!c)return null;const g=PRED.filter(x=>x.g===c.g);buyPred(c.id,1);const o=PRED_OWN.find(x=>x.cid===c.id),b=getBal();M[c.i].p=(Math.max(c.lo,M[c.i].p*.5)+Math.min(c.hi,M[c.i].p*2))/2;g.forEach(x=>x.exp=T);resolvePreds();return{paid:+(getBal()-b).toFixed(2),n:+o.n.toFixed(2),sum:+g.reduce((a,x)=>a+x.P,0).toFixed(3),won:g.filter(x=>x.yes).length}})()");
  check(rg && Math.abs(rg.paid - rg.n) < .02 && rg.won === 1 && Math.abs(rg.sum - 1) < .02, 'a range bucket that lands pays $1 a contract, and only one bucket wins', JSON.stringify(rg));
  const hh = await pg.evaluate("(()=>{newH2H(['GLDN','OIL']);const c=PRED.filter(x=>x.kind==='h2h'&&!x.done).pop();if(!c)return null;c.exp=T+120;const P=cP(c,3000);M[c.i].p*=1.05;const P2=cP(c,3000);c.exp=T;resolvePreds();return{P:+P.toFixed(2),P2:+P2.toFixed(2),yes:c.yes}})()");
  check(hh && hh.P2 > hh.P && hh.yes === true, 'head to head: A pulling ahead lifts its price and A winning resolves it', JSON.stringify(hh));
  const tc = await pg.evaluate("(()=>{const c=PRED.find(x=>x.kind==='tch'&&!x.done);if(!c)return null;M[c.i].p=c.up?c.L*1.001:c.L*.999;resolvePreds();return{done:c.done,yes:c.yes}})()");
  check(tc && tc.done && tc.yes, 'a touch contract pays the moment the level is touched', JSON.stringify(tc));
  /* quality of life */
  await pg.evaluate("showSec('term');WF='All';UIP.sort='def';buildTerm();select(1)");
  await pg.click('[data-fav="SHRK"]'); await pg.evaluate("UIP.sort='move';buildWatch()");
  const fv = await pg.evaluate("(()=>{const rows=[...document.querySelectorAll('#wrows .wr')].map(b=>STOCKS[+b.dataset.i].sym);const ch=rows.slice(1).map(s=>Math.abs(M[byS(s)].p/M[byS(s)].open-1));return{first:rows[0],fav:save.favs.includes('SHRK'),sorted:ch.every((v,k)=>k===0||ch[k-1]>=v-1e-12)}})()");
  check(fv.first === 'SHRK' && fv.fav && fv.sorted, 'favourites pin to the top and the watchlist sorts by biggest movers', JSON.stringify(fv));
  await pg.evaluate("UIP.sort='def';buildWatch();select(1);ui.L=5;ui.T=60;quote()"); await pg.waitForTimeout(200); await pg.evaluate("select(4)"); await pg.evaluate("ui.L=2;quote()"); await pg.waitForTimeout(200);
  check(await pg.evaluate("select(1),ui.L===5&&ui.T===60"), 'each market remembers its own ticket');
  await pg.evaluate("document.activeElement&&document.activeElement.blur()"); await pg.keyboard.press('3'); const k3 = await pg.evaluate('ui.stake');
  const s0 = await pg.evaluate('sel'); await pg.keyboard.press('ArrowDown'); const s1 = await pg.evaluate('sel');
  await pg.evaluate("select(1);UIP.one=true;positions.length=0"); const n0 = await pg.evaluate('positions.length'); await pg.keyboard.press('b'); const n1 = await pg.evaluate('positions.length');
  check(k3 === 1e4 && s1 !== s0 && n1 === n0 + 1, 'keys: 3 = $10K stake, arrows change market, B trades instantly in one-click mode', JSON.stringify({ k3, s0, s1, n1 }));
  const cw = await pg.evaluate("(()=>{UIP.one=false;select(1);ui.stake=100;ui.T=120;openTrade(1);openTrade(-1);const n=positions.length,b=getBal(),vs=positions.map(o=>valueOf(o)-o.cost);closeAll(true);const w=positions.length;closeAll(false);return{n,wins:vs.filter(v=>v>0).length,afterWinners:w,afterAll:positions.length}})()");
  check(cw.afterWinners === cw.n - cw.wins && cw.afterAll === 0, 'close winners closes only the ones in profit, close all closes the rest', JSON.stringify(cw));
  const al = await pg.evaluate("(()=>{save.alerts=[];addAlert(1,M[1].p*1.001);const a=save.alerts.length;M[1].p*=1.01;checkAlerts();return{set:a,left:save.alerts.length}})()");
  check(al.set === 1 && al.left === 0, 'a price alert fires when the price gets there', JSON.stringify(al));
  const md = await pg.evaluate("(()=>{select(byS('VLTC'));ui.stake=1000;ui.L=5;ui.T=120;ui.tp=0;ui.sl=0;openTrade(1);const o=positions[positions.length-1],c0=o.cost,b0=getBal();const ok=modTrade(o.id,{sl:.4});return{ok,sl:o.sl,dc:+(o.cost-c0).toFixed(2),db:+(b0-getBal()).toFixed(2)}})()");
  check(md.ok && md.sl === .4 && Math.abs(md.dc - md.db) < .011, 'moving a stop loss re-balances the fee on the wallet', JSON.stringify(md));
  const jr = await pg.evaluate("(()=>{const n=save.jr.length;positions.slice().forEach(o=>cashOut(o.id));const j=save.jr[0];showSec('jour');return{added:save.jr.length-n,tr:j&&j.tr.length,e:j&&j.e,rows:document.querySelectorAll('#jRows tr').length,chart:!!$('jC')}})()");
  check(jr.added >= 1 && jr.tr > 10 && jr.e > 0 && jr.rows >= 1 && jr.chart, 'closed bets land in the journal with their chart from before entry to exit', JSON.stringify(jr));
  /* earnings season */
  await pg.evaluate("EARN.next=1;showSec('pulse')"); await pg.waitForTimeout(2300);
  const es = await pg.evaluate("(()=>{const l=EARN.list;return{st:EARN.st,n:l.length,set:l.filter(e=>e.set).length,earnPend:M.filter(m=>m.pend&&m.pend.k==='earn').length,card:/EARNINGS SEASON/.test($('puEarn').textContent)}})()");
  check(es.st === 'on' && es.n >= 6 && es.earnPend >= 1 && es.card, 'an earnings season schedules every company\'s report as its pending news', JSON.stringify(es));
  const er = await pg.evaluate("(async()=>{const e=EARN.list.find(e=>e.set),i=byS(e.sym);M[i].pend.t=.5;await new Promise(r=>setTimeout(r,1500));return{sym:e.sym,res:e.res,news:news.some(h=>/beats|misses/.test(h.text)&&h.sym===e.sym)}})()");
  check(er.res && er.news, 'a report lands as a beat or a miss with its headline', JSON.stringify(er));
  /* the IPO order box keeps what you pick */
  await pg.evaluate("IPO.st='open';IPO.t=60;IPO.d=nextIpoDeal();showSec('ipo')"); await pg.waitForTimeout(300); await pg.click('[data-ia="1000"]'); await pg.waitForTimeout(2300);
  check(await pg.evaluate("$('iAmt').value==='1000'"), 'the IPO order amount stays at $1,000 while the book counts down');
  await pg.click('[data-ia="250000"]'); await pg.waitForTimeout(1500); const sb0 = await pg.evaluate('IPO.sub'); await pg.click('#iGo'); await pg.waitForTimeout(200);
  check(await pg.evaluate('IPO.sub') - sb0 === 250000, 'tapping $250K then Order shares orders $250K', String(await pg.evaluate('IPO.sub')));
  /* invest sells are journalled with realised P&L, hold time and dividends */
  const ij = await pg.evaluate(`(async()=>{select(byS('AURA'));delete save.port.AURA;ui.inv='buy';ui.invAmt=20000;setTab('invest');invest();await new Promise(r=>setTimeout(r,2500));save.port.AURA.div=12.5;
    const n=save.jr.length;ui.inv='sell';ui.invQ=save.port.AURA.q/2;buildTab();invest();const a=save.jr[0];sellAll('AURA');const b=save.jr[0];
    return{added:save.jr.length-n,kindA:a.kind,kindB:b.kind,costA:+a.cost.toFixed(2),netA:a.net,divA:a.div,dur:a.dur,tr:a.tr.length,e:a.e,gone:!save.port.AURA}})()`);
  check(ij.added === 2 && ij.kindA === 'inv' && ij.kindB === 'inv' && Math.abs(ij.costA - 1e4) < .02 && Math.abs(ij.divA - 6.25) < .01 && ij.dur >= 2 && ij.tr >= 1 && ij.gone, 'selling shares (ticket or Portfolio) lands in the journal with realised P&L, hold time and dividends', JSON.stringify(ij));
  await pg.evaluate("showSec('jour');JF.kind='inv';drawJour()"); check(await pg.evaluate("/Invest/.test($('jRows').textContent)&&/Dividends while held/i.test($('jDet').textContent)"), 'the journal filters to Invest and shows the sale');
  await pg.evaluate("JF.kind=''");
  /* regression: a new listing opened with the mouse over the chart used to throw and stop the whole market */
  await pg.evaluate("save.ipoJump=true;IPO.st='bell';IPO.t=.5;IPO.d=nextIpoDeal();IPO.sub=0;showSec('term');CV.r=2"); await pg.mouse.move(700, 500); await pg.waitForTimeout(1800);
  const lt = await pg.evaluate('T'); await pg.waitForTimeout(1000);
  const lv = await pg.evaluate(`({T:T,sym:STOCKS[sel].sym,ipo:!!STOCKS[sel].ipo,candles:M[sel].candles.length,errs:ERRS.slice()})`);
  check(lv.T > lt && lv.ipo && lv.candles >= 1 && lv.errs.length === 0, 'jumping to a brand-new listing keeps the market running (chart has its opening candle)', JSON.stringify(lv));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  await b.close();
}
(async () => { if (mode === 'sim') sim(); else await ui(); const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0); })();
