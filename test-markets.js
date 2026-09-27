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
  const clone = (st, G) => ({ st: { p: st.p, pend: st.pend ? { t: st.pend.t } : null }, G: { pend: G.pend ? { t: G.pend.t, e: G.pend.e } : null } });
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
  const hh = await pg.evaluate("(()=>{const c=PRED.find(x=>x.kind==='h2h'&&!x.done);if(!c)return null;const P=cP(c,3000);M[c.i].p*=1.05;const P2=cP(c,3000);c.exp=T;resolvePreds();return{P:+P.toFixed(2),P2:+P2.toFixed(2),yes:c.yes}})()");
  check(hh && hh.P2 > hh.P && hh.yes === true, 'head to head: A pulling ahead lifts its price and A winning resolves it', JSON.stringify(hh));
  const tc = await pg.evaluate("(()=>{const c=PRED.find(x=>x.kind==='tch'&&!x.done);if(!c)return null;M[c.i].p=c.up?c.L*1.001:c.L*.999;resolvePreds();return{done:c.done,yes:c.yes}})()");
  check(tc && tc.done && tc.yes, 'a touch contract pays the moment the level is touched', JSON.stringify(tc));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  await b.close();
}
(async () => { if (mode === 'sim') sim(); else await ui(); const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0); })();
