#!/usr/bin/env node
/* test-arcade.js - Stack Arcade (claw machine, coin pusher, Stackheads) checks.
   node test-arcade.js sim [drops]  Node only: claw odds are exactly 97%/multiplier at a perfect line-up and never
                                    more; the pusher's return from its own physics (exit shares by drop position,
                                    Lucky Slot value) lands in the house band; money is conserved coin for coin;
                                    the baked starting field and save/restore are sound
   node test-arcade.js ui           Playwright: the arcade floor, pusher drops and payouts on the wallet, cabinets
                                    keep their own fields, a Lucky Slot feature, a figure off the pusher, a gutter
                                    coin pays nothing, the claw (win, slip, miss, timer), unboxing, selling, the
                                    shelf, saving across a reload, the odds panel, console errors */
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = path.resolve(__dirname, 'stack-arcade.html');
const mode = process.argv[2] || 'sim';
const results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
function loadCore() {
  const src = fs.readFileSync(FILE, 'utf8'), a = src.indexOf('/*==CORE==*/'), b = src.indexOf('/*==END CORE==*/');
  if (a < 0 || b < 0) throw new Error('core markers missing');
  const m = { exports: {} }; new Function('module', src.slice(a, b))(m);
  m.exports.PZ_START = JSON.parse(src.match(/const PZ_START=(\{.*?\});\n/)[1]); return m.exports;
}
const mulberry = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function sim() {
  const G = loadCore(), N = +process.argv[3] || 9000;
  console.log('\n-- claw odds --');
  { const exact = G.VARS.every((V, i) => Math.abs(G.clawP(i, 1) * V.m - .97) < 1e-12);
    check(exact, 'a perfect line-up returns exactly 97% of the play in figure value, on every finish', G.VARS.map((V, i) => `${V.n} ${(100 * G.clawP(i, 1)).toFixed(3)}%`).join(' · '));
    let mono = true, prev = 2; for (let d = 0; d <= 1.2; d += .01) { const q = G.clawQ(d, 1); if (q > prev + 1e-12 || q < 0 || q > 1) mono = false; prev = q; }
    check(mono && G.clawQ(0, 1) === 1 && G.clawQ(.35, 1) === 1 && G.clawQ(1, 1) === 0, 'line-up is 100% near the centre, falls off to 0 at the edge, never above 100%');
    const R = mulberry(7); let paid = 0, won = 0; for (let i = 0; i < 2e6; i++) { const vi = G.pickW(G.CLAW_MIX, R()), q = G.clawQ(R() * .5, 1); paid += 1; if (R() < G.clawP(vi, q)) won += G.figVal(vi, 1); }
    check(won / paid <= .975 && won / paid > .9, 'claw return with good aim stays at or under 97%', (100 * won / paid).toFixed(2) + '%');
    check(G.figVal(4, 300) === 150000 && G.figVal(0, .2) === .4, 'a figure is worth its multiplier x the play price', 'Diamond at $300 = $150,000 · Standard at 20c = 40c'); }
  console.log(`\n-- coin pusher physics (${N.toLocaleString()} drops per aim) --`);
  const run = (aim, seed) => {
    const R = mulberry(seed), st = G.pzUnpack(G.PZ_START); for (const c of st.c) c.src = 'warm';
    const T = {}, acc = (s, h, v) => { const a = T[s] || (T[s] = { pay: 0, house: 0 }); if (h) a.house += v; else a.pay += v; };
    const X = () => aim === 'c' ? 0 : aim === 'e' ? (R() < .5 ? -G.PZ.AIM : G.PZ.AIM) : (R() * 2 - 1) * G.PZ.AIM;
    let lucky = 0, maxOver = 0, outside = 0;
    for (let i = 0; i < N; i++) { if (G.pzDrop(st, X(), R)) lucky++; st.c[st.c.length - 1].src = 'd';
      if (i % 12 === 0) { const p = G.pzRainAt(st, R, true), c = G.pzCoin(st, p.x, p.y, 0, 'c', 1); G.pzLand(st, c); c.src = 'r'; }
      for (let k = 0; k < 20; k++) for (const e of G.pzStep(st, 1 / 60)) acc(e.c.src, e.house, 1);
      if (i % 500 === 0) { for (const c of st.c) { if (Math.abs(c.x) > G.PZ.W / 2 - c.r + 1e-6) outside++; for (const o of st.c) if (o !== c && o.l === c.l && o.l === 0) { const d = Math.hypot(o.x - c.x, o.y - c.y); maxOver = Math.max(maxOver, (o.r + c.r - d) / (o.r + c.r)); } } } }
    const f = s => T[s] ? T[s].pay / (T[s].pay + T[s].house) : 1;
    return { fd: f('d'), fr: f('r'), lucky: lucky / N, maxOver, outside };
  };
  const U = run('u', 11), C = run('c', 12), E = run('e', 13);
  /* Lucky Slot value per trigger, in coins, with the measured exit shares (prizes are too big for the gutters) */
  const fw = G.PZ_FEAT.reduce((a, f) => a + f.w, 0), boxEV = G.PZ_BOXX * G.PZ_BOXMIX.reduce((a, p, i) => a + p * G.VARS[i].m, 0);
  const feat = (fd, fr) => G.PZ_FEAT.reduce((a, f) => a + f.w / fw * ((f.coins || 0) * fr + (f.jumbo ? G.PZ_JUMBO : 0) + (f.bar ? G.PZ_BAR : 0) + (f.box ? boxEV : 0) + (f.walls ? G.PZ.WALLS * (1 - fd) : 0)), 0);
  const rtp = X => X.fd + G.PZ.PL * feat(X.fd, U.fr);
  console.log(`       dropped coins over the front: centre ${(100 * C.fd).toFixed(1)}% · spread ${(100 * U.fd).toFixed(1)}% · chute ends ${(100 * E.fd).toFixed(1)}% · rain coins ${(100 * U.fr).toFixed(1)}%`);
  console.log(`       Lucky Slot: ${feat(U.fd, U.fr).toFixed(2)} coins a trigger x 1 in ${Math.round(1 / G.PZ.PL)} = +${(100 * G.PZ.PL * feat(U.fd, U.fr)).toFixed(1)}%`);
  check(rtp(U) > .955 && rtp(U) < .99, 'return to player, dropping across the chute', (100 * rtp(U)).toFixed(2) + '% (house rule 96-99%)');
  check(rtp(C) < .995, 'the best aim (dead centre) stays inside the ceiling', (100 * rtp(C)).toFixed(2) + '%');
  check(rtp(E) < rtp(C) && rtp(E) > .92, 'aiming at the corners returns less (they feed the gutters)', (100 * rtp(E)).toFixed(2) + '%');
  check(Math.abs(U.lucky * 65 - 1) < .3, 'the lucky gate opens about 1 drop in 65', '1 in ' + (1 / U.lucky).toFixed(0));
  check(U.maxOver < .12 && !U.outside, 'coins never sink into each other or through the walls', `worst overlap ${(100 * U.maxOver).toFixed(1)}%`);
  console.log('\n-- money is conserved --');
  { const R = mulberry(5), st = G.pzUnpack(G.PZ_START), val = () => st.c.reduce((a, c) => a + c.v, 0), v0 = val(); let free = 0;
    for (let i = 0; i < 3000; i++) { if (G.pzDrop(st, (R() * 2 - 1) * 5, R)) { const out = G.pzFeature(st, G.pzFeatPick(R), R); free += out.reduce((a, c) => a + c.v, 0); } for (let k = 0; k < 20; k++) G.pzStep(st, 1 / 60); }
    const lhs = v0 + st.inV + free, rhs = val() + st.outV + st.houseV;
    check(Math.abs(lhs - rhs) < 1e-6, 'every coin and prize leaves over the front, into a gutter, or is still on the field', `in ${lhs} = out ${st.outV} + house ${st.houseV} + field ${val()}`); }
  { const F = G.PZ_FEAT; check(F.every(f => f.w > 0) && F.some(f => f.k === 'jack') && G.PZ_BOXMIX.reduce((a, b) => a + b, 0) === 1, 'Lucky Slot table and box finish mix are well formed'); }
  console.log('\n-- saving + the starting field --');
  { const st = G.pzUnpack(G.PZ_START); let bad = 0; for (const c of st.c) if (c.y < 0 || c.y > G.PZ.D || Math.abs(c.x) > G.PZ.W / 2) bad++;
    check(st.c.length > 70 && !bad, 'the baked starting field is full and inside the cabinet', st.c.length + ' coins');
    const R = mulberry(9); for (let i = 0; i < 50; i++) { G.pzDrop(st, 0, R); G.pzFeature(st, G.PZ_FEAT[4], R); for (let k = 0; k < 10; k++) G.pzStep(st, 1 / 60); }
    const back = G.pzUnpack(JSON.parse(JSON.stringify(G.pzPack(st)))), sig = s => s.c.map(c => c.k + c.v + (c.vi ?? '')).sort().join();
    check(back.c.length === st.c.length && sig(back) === sig(st), 'a saved field comes back with every coin and prize', back.c.length + ' pieces'); }
}
async function ui() {
  let playwright; try { playwright = require('playwright'); } catch { console.error('playwright missing'); process.exit(2); }
  const out = path.join(os.tmpdir(), 'stack-arcade-shots'); fs.mkdirSync(out, { recursive: true });
  const b = await playwright.chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 880 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + FILE); await pg.waitForTimeout(900);
  const shot = n => pg.screenshot({ path: path.join(out, n + '.png') });
  const ev = s => pg.evaluate(s);
  await ev("localStorage.clear();S.bal=10000;S.figs=[];drawBal();auInit=()=>{}");
  /* the floor */
  check(await ev("S.scene==='hall'&&hallHit(300,500)==='claw'&&hallHit(800,500)==='push'&&hallHit(1250,500)==='shelf'"), 'the arcade floor leads to the claw, the pusher and the shelf'); await shot('hall');
  await pg.mouse.click(pg.viewportSize().width * .52, 420); await pg.waitForTimeout(400);
  check(await ev("S.scene==='push'&&$('gPush').classList.contains('on')&&PU.st&&PU.st.c.length>70"), 'clicking the pusher opens it with a full field');
  /* drops + payouts on the wallet */
  const d1 = await ev(`(async()=>{const b0=bal();let n=0;for(let i=0;i<40;i++){PU.lastDrop=0;if(pzDropCoin())n++}const spent=n*PZ_TIERS[S.tier];await new Promise(r=>setTimeout(r,6000));payFlush(true);return{b0,n,spent,won:PU.won,b1:bal()}})()`);
  check(d1.n === 40 && Math.abs(d1.b1 - (d1.b0 - d1.spent + d1.won)) < .005 && d1.won > 0, 'each drop costs one coin and every payout lands on the balance', JSON.stringify(d1));
  await shot('pusher');
  const aim = await ev("pzAimFromScreen(-5000);const a=PU.aimT;pzAimFromScreen(5000);[a,PU.aimT]");
  check(aim[0] === -5.5 && aim[1] === 5.5, 'the chute only travels the middle of the machine', JSON.stringify(aim));
  /* cabinets */
  const cab = await ev(`(()=>{const n0=PU.st.c.length;cabStep(1);const t=S.tier,v=PZ_TIERS[S.tier];const b0=bal();PU.lastDrop=0;pzDropCoin();const cost=+(b0-bal()).toFixed(2);cabStep(-1);return{t,v,cost,back:S.tier,kept:!!S.boards[2]&&!!S.boards[1]}})()`);
  check(cab.t === 2 && cab.cost === 5 && cab.back === 1 && cab.kept, 'the $5 cabinet takes $5 coins and each cabinet keeps its own field', JSON.stringify(cab));
  /* a gutter coin pays nothing; a coin over the front pays one coin */
  const gut = await ev(`(()=>{const st=PU.st;st.walls=0;const b0=bal()+PU.payAcc;const h=pzCoin(st,10.4,PZ.D+.05,0);const p=pzCoin(st,0,PZ.D+.05,0);const o=pzStep(st,1/60);o.forEach(onExit);payFlush(true);return{house:o.filter(e=>e.house).length,paid:o.filter(e=>!e.house).length,gain:+(bal()-b0).toFixed(2)}})()`);
  check(gut.house >= 1 && gut.paid >= 1 && gut.gain === gut.paid * 1, 'a coin into a HOUSE gutter pays nothing, a coin over the front pays its value', JSON.stringify(gut));
  /* a Stackhead box off the front */
  const box = await ev(`(()=>{const n0=S.figs.length;const c=pzCoin(PU.st,0,PZ.D+.1,0,'b',VARS[3].m*PZ_BOXX,2.5,{vi:3,fi:0});pzStep(PU.st,1/60).forEach(onExit);const f=S.figs[S.figs.length-1];return{got:S.figs.length-n0,val:f&&f.val,src:f&&f.src,pop:$('figPop').classList.contains('on')}})()`);
  check(box.got === 1 && box.val === 300 && box.src === 'pusher' && box.pop, 'a Stackhead box pushed off the front is yours: Gold x 3 coins x $1 = $300', JSON.stringify(box));
  /* a Lucky Slot feature plays out */
  const lk = await ev(`(async()=>{const n0=PU.st.c.length;PU.featQ.push(PZ_FEAT.find(f=>f.k==='jack'));await new Promise(r=>setTimeout(r,2600));const mid=$('banT').textContent;await new Promise(r=>setTimeout(r,5000));return{mid,bar:PU.st.c.some(c=>c.k==='g')||PU.won>0,added:PU.st.c.length-n0,q:PU.spawnQ.length}})()`);
  check(/JACKPOT/.test(lk.mid) && lk.q === 0 && lk.added > 20, 'the Lucky Slot spins up the JACKPOT and rains in the gold bar and coins', JSON.stringify(lk));
  await shot('pusher-feature');
  /* claw */
  await ev("setScene('claw');S.pile=pileNew();S.prI=PRICES.indexOf(5);drawPrice()");
  const pick = "(()=>{const b=S.pile.find(b=>!b.lay&&clawTarget(b.x,b.z).b===b&&!clawTarget(b.x,b.z).buried&&b.x>-3&&!S.pile.some(o=>o!==b&&o.y>b.y&&Math.abs(o.x-(b.x+.75))<1.4&&Math.abs(o.z-b.z)<1.2));CL.x=CL.tx=b.x;CL.z=CL.tz=b.z;return b})()";
  const round = async (rnd, off) => ev(`(async()=>{const b0=bal(),n0=S.figs.length;clawPlay();const b=${pick};if(${off})CL.x=CL.tx=b.x+${off};const tg=clawTarget(CL.x,CL.z);const shown=tg.p;const R=Math.random;Math.random=()=>${rnd};clawDrop();
     for(let i=0;i<120&&CL.ph!=='idle';i++)await new Promise(r=>setTimeout(r,100));Math.random=R;const f=S.figs[S.figs.length-1];return{cost:+(b0-bal()).toFixed(2),got:S.figs.length-n0,q:tg.q,shown,exp:clawP(b.vi,tg.q),val:f&&f.val,vi:b.vi,rev:RV.on,left:S.pile.includes(b)}})()`);
  const w = await round(0, 0);
  check(w.cost === 5 && w.got === 1 && w.q === 1 && Math.abs(w.shown - w.exp) < 1e-12 && w.val === 5 * [2, 6, 20, 100, 500][w.vi] && w.rev && !w.left, 'claw win: costs the play, shows the true chance, the box leaves the cabinet and the figure is worth multiplier x play', JSON.stringify(w));
  await pg.waitForTimeout(2600); await shot('reveal');
  await pg.click('#revKeep'); await pg.waitForTimeout(300);
  const l = await round(.9999, 0);
  check(l.cost === 5 && l.got === 0 && l.left, 'claw slip: the box stays in the cabinet and nothing is added', JSON.stringify(l));
  const m = await round(0, .75);
  check(m.got === 0 && m.q === 0 && m.shown === 0, 'claw miss: off the box edge the chance shows 0% and it never wins', JSON.stringify(m));
  const tm = await ev(`(async()=>{clawPlay();CL.timer=.3;for(let i=0;i<120&&CL.ph!=='idle';i++)await new Promise(r=>setTimeout(r,100));return CL.ph})()`);
  check(tm === 'idle', 'the claw drops itself when the 15-second timer runs out');
  /* selling + the shelf */
  const sell = await ev(`(()=>{const f=S.figs[0],b0=bal();sellFig(f.u);return{gain:+(bal()-b0).toFixed(2),val:f.val,gone:!S.figs.includes(f)}})()`);
  check(sell.gain === sell.val && sell.gone, 'selling a figure pays exactly its value', JSON.stringify(sell));
  const dup = await ev(`(()=>{S.figs.push({u:'a',fi:3,vi:0,val:2,src:'claw',at:0},{u:'b',fi:3,vi:0,val:4,src:'claw',at:0},{u:'c',fi:3,vi:0,val:1,src:'claw',at:0});const b0=bal();sellDupes();const left=S.figs.filter(f=>f.fi===3&&f.vi===0);return{gain:+(bal()-b0).toFixed(2),left:left.map(f=>f.val)}})()`);
  check(dup.gain === 3 && dup.left.join() === '4', 'selling Standard duplicates keeps your most valuable copy', JSON.stringify(dup));
  await ev("setScene('shelf')"); await pg.waitForTimeout(400);
  check(await ev("document.querySelectorAll('#shelfUI .slot').length===60&&document.querySelectorAll('#shelfUI .slot:not(.none)').length>=1"), 'the shelf shows all 60 figures, owned ones lit'); await shot('shelf');
  await ev("figDetail(3)"); check(await ev("document.querySelectorAll('#fdBody .fdc').length===5"), 'a figure page lists all five finishes'); await ev("$('figDet').classList.remove('on')");
  /* saving across a reload */
  const before = await ev("saveNow();JSON.stringify({f:S.figs.length,b:Object.keys(S.boards).length,p:S.pile.length})");
  await pg.reload(); await pg.waitForTimeout(900);
  const after = await ev("JSON.stringify({f:S.figs.length,b:Object.keys(S.boards).length,p:S.pile.length})");
  check(before === after, 'figures, cabinet fields and the claw pile survive a reload', after);
  await ev("openInfo()"); check(await ev("$('info').classList.contains('on')&&$('infoBody').querySelectorAll('.odds span').length>30"), 'the odds panel lists every finish and Lucky Slot outcome');
  check(!errs.length, 'no console errors', errs.slice(0, 3).join(' | '));
  console.log('       screenshots: ' + out);
  await b.close();
}
(async () => {
  if (mode === 'sim') sim(); else await ui();
  const ok = results.filter(Boolean).length; console.log(`\n${ok}/${results.length} checks passed`); process.exit(ok === results.length ? 0 : 1);
})();
