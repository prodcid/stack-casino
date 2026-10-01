#!/usr/bin/env node
/* test-tables.js - Stack Tables (the Vegas table games) checks.
   node test-tables.js sim   Node only: every bet on every table returns what its label says - main bets in the house
                             band (96-99%), the authentic sucker bets at their known (labelled) returns - by exact
                             enumeration where it's cheap and simulation of full rounds (basic strategy blackjack,
                             optimal Three Card Poker, Casino Hold'em with the table's hint) where it isn't
   node test-tables.js ui    Playwright: the lobby, every table loads its 3D scene and plays a full round on the wallet
                             (chips placed on the felt, cards dealt, wheel/dice/ball resolved, payout matches the maths),
                             sounds decoded, the dealer animates, saving, inside Stack as a frame game, no console errors */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(__dirname, 'stack-tables.html'), CASINO = path.resolve(__dirname, 'stack-casino.html');
const mode = process.argv[2] || 'sim', results = [];
const pass = (n, d = '') => { results.push(true); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push(false); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const check = (ok, n, d) => (ok ? pass : fail)(n, d);
const pct = x => (x * 100).toFixed(2) + '%';
function core() { const src = fs.readFileSync(FILE, 'utf8'), m = { exports: {} }; new Function('module', src.slice(src.indexOf('/*==CORE==*/'), src.indexOf('/*==END CORE==*/')))(m); return m.exports; }
const inBand = r => r >= .96 - 1e-9 && r <= .995;
function sim() {
  console.log('\n-- v2: Casino War and Andar Bahar (one fresh deck a round, played out) --');
  { const v = c => { const r = c % 13; return r === 0 ? 14 : r + 1 }, deal = n => { const d = [...Array(52).keys()]; for (let i = 51; i > 51 - n; i--) { const j = Math.random() * (i + 1) | 0;[d[i], d[j]] = [d[j], d[i]] } return d.slice(52 - n).reverse() };
    let main = 0, back = 0, tie = 0, tieB = 0; const N = 2e6; for (let k = 0; k < N; k++) { const [p, q, , , , p2, q2] = deal(7); main++; tieB++; if (v(p) === v(q)) tie += 16; if (v(p) > v(q)) back += 2; else if (v(p) === v(q)) { back -= 1; if (v(p2) >= v(q2)) back += 3 } }
    check(inBand(back / main), 'Casino War, always going to war (per main bet)', pct(back / main)); check(Math.abs(tie / tieB - .941) < .01, 'Casino War tie at 15 to 1 is the labelled 94.1% sucker bet', pct(tie / tieB));
    let a = 0; const M = 1e6; for (let k = 0; k < M; k++) { const d = deal(52), jr = d[0] % 13; for (let i = 1, side = 0; i < 52; i++, side ^= 1) if (d[i] % 13 === jr) { if (!side) a++; break } }
    check(inBand(a / M * 1.9) && inBand((1 - a / M) * 2), 'Andar Bahar: Andar 0.9 to 1 and Bahar 1 to 1 both in band', `${pct(a / M * 1.9)} / ${pct((1 - a / M) * 2)}`); }
  const K = core();
  console.log('\n-- blackjack (6 decks, H17, 3:2, basic strategy) --');
  { let staked = 0, back = 0; const N = +process.argv[3] || 400000; let S = K.newShoe(6);
    for (let r = 0; r < N; r++) { if (K.needShuffle(S)) S = K.newShoe(6);
      const p = [K.draw(S)], d = [K.draw(S)]; p.push(K.draw(S)); d.push(K.draw(S)); staked += 1;
      if (K.isBJ(d)) { back += K.isBJ(p) ? 1 : 0; continue; } if (K.isBJ(p)) { back += 2.5; continue; }
      let hands = [{ c: p, bet: 1, split: false }], splits = 0;
      for (let i = 0; i < hands.length; i++) { const h = hands[i];
        for (;;) { const t = K.bjTotal(h.c).t; if (t >= 21) break; if (h.splitAce) break;
          const a = K.bjAdvice(h.c, d[0], h.c.length === 2 && (!h.split || K.BJ.das), h.c.length === 2 && splits < K.BJ.maxSplits && K.bjVal(h.c[0]) === K.bjVal(h.c[1]));
          if (a === 'S') break; if (a === 'D') { h.bet *= 2; staked += 1; h.c.push(K.draw(S)); break; }
          if (a === 'P') { splits++; staked += 1; const ace = K.bjVal(h.c[0]) === 11; const n = { c: [h.c.pop(), K.draw(S)], bet: 1, split: true, splitAce: ace }; h.c.push(K.draw(S)); h.split = true; h.splitAce = ace; hands.push(n); continue; }
          h.c.push(K.draw(S)); } }
      const live = hands.some(h => K.bjTotal(h.c).t <= 21); if (live) K.dealerPlays(d, S); const dt = K.bjTotal(d).t;
      for (const h of hands) { const t = K.bjTotal(h.c).t; if (t > 21) continue; if (dt > 21 || t > dt) back += h.bet * 2; else if (t === dt) back += h.bet; } }
    const r = back / staked; check(r > .982 && r < .999, 'blackjack with basic strategy', pct(r) + ` over ${N.toLocaleString()} rounds (per unit staked)`); }
  { /* side bets, exactly: two cards from a 6-deck shoe; 21+3 enumerated over the dealer's up card too */
    const n = 312; let pp = 0; for (let a = 0; a < 52; a++) for (let b = 0; b < 52; b++) { const w = 6 * (a === b ? 5 : 6) / (n * (n - 1)); const r = K.ppResult(a, b); if (r) pp += w * (K.PP_PAY[r] + 1); }
    check(inBand(pp), 'Perfect Pairs (25 / 12 / 7)', pct(pp));
    let t3 = 0, tw = 0; for (let a = 0; a < 52; a++) for (let b = 0; b < 52; b++) for (let c = 0; c < 52; c++) { const cnt = [a, b, c].reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {}); let w = 1, left = n; for (const k in cnt) { for (let j = 0; j < cnt[k]; j++) w *= (6 - j); } w /= n * (n - 1) * (n - 2); tw += w; const r = K.t3Result([a, b, c]); if (r) t3 += w * (K.T3_PAY[r] + 1); }
    check(inBand(t3 / tw), '21+3 (flush 5, straight 10, trips 35, straight flush 40, suited trips 100)', pct(t3 / tw)); }
  console.log('\n-- roulette --');
  { const bets = [['straight', [17]], ['split', [17, 20]], ['street', [16, 17, 18]], ['corner', [16, 17, 19, 20]], ['six line', [13, 14, 15, 16, 17, 18]], ['first four', [0, 1, 2, 3]], ['dozen', K.R_OUTSIDE.doz2], ['column', K.R_OUTSIDE.col1], ['red', K.R_OUTSIDE.red]];
    const rets = bets.map(([k, nums]) => { const b = Object.assign(K.rBet(k, nums), { amt: 1 }); let s = 0; for (let n = 0; n <= 36; n++) s += K.rPayout([b], n, 'eu') / 37; return [k, s]; });
    check(rets.every(([, r]) => Math.abs(r - 36 / 37) < 1e-9), 'European: every bet returns 97.30% exactly', rets.map(([k, r]) => k + ' ' + pct(r)).join(' · '));
    const red = Object.assign(K.rBet('red', K.R_OUTSIDE.red), { amt: 1 }); let fr = 0; for (let n = 0; n <= 36; n++) fr += K.rPayout([red], n, 'french') / 37;
    check(Math.abs(fr - (18 * 2 + .5) / 37) < 1e-9 && inBand(fr), 'French La Partage: even-money bets get half back on zero', pct(fr));
    check(Math.abs(K.lightRTP() - 36 / 37) < .001, 'Lightning straight-up (29:1 plus 1-5 lucky numbers at 50-500x) matches 97.3%', pct(K.lightRTP()));
    let paid = 0, got = 0; for (let i = 0; i < 3000000; i++) { const lk = K.lightDraw(), n = Math.floor(Math.random() * 37); paid++; got += K.rPayout([Object.assign(K.rBet('straight', [n === 17 ? 17 : 17]), { amt: 1 })], n, 'lightning', lk); }
    check(Math.abs(got / paid - K.lightRTP()) < .016, 'Lightning played out (3M spins; the 500x tail is wide) agrees', pct(got / paid));
    const vo = K.CALLS.voisins.reduce((a, [, c]) => a + c, 0), ti = K.CALLS.tiers.reduce((a, [, c]) => a + c, 0), or = K.CALLS.orphelins.reduce((a, [, c]) => a + c, 0);
    const cover = new Set([].concat(...['voisins', 'tiers', 'orphelins'].map(k => [].concat(...K.CALLS[k].map(([n]) => n)))));
    check(vo === 9 && ti === 6 && or === 5 && cover.size === 37, 'call bets: voisins 9 chips, tiers 6, orphelins 5, together cover the whole wheel'); }
  console.log('\n-- baccarat and dragon tiger (8 decks, played out) --');
  { let S = K.newShoe(8, .9); const R = { player: 0, banker: 0, tie: 0, ppair: 0 }, N = 600000;
    for (let i = 0; i < N; i++) { if (K.needShuffle(S)) S = K.newShoe(8, .9); const r = K.bacDeal(S);
      for (const k in R) R[k] += K.bacSettle({ [k]: 1 }, r).ret; }
    check(Math.abs(R.player / N - .9876) < .004, 'Player', pct(R.player / N)); check(Math.abs(R.banker / N - .9894) < .004, 'Banker (5% commission)', pct(R.banker / N));
    check(Math.abs(R.tie / N - .8564) < .02, 'Tie 8:1 (labelled sucker bet)', pct(R.tie / N)); check(Math.abs(R.ppair / N - .8964) < .02, 'Player Pair 11:1 (labelled sucker bet)', pct(R.ppair / N));
    let D = 0, T = 0; S = K.newShoe(8, .9); for (let i = 0; i < N; i++) { if (K.needShuffle(S)) S = K.newShoe(8, .9); const d = K.draw(S), t = K.draw(S); D += K.dtSettle({ dragon: 1 }, d, t).ret; T += K.dtSettle({ tie: 1 }, d, t).ret; }
    check(inBand(D / N), 'Dragon Tiger: Dragon (a tie takes half)', pct(D / N)); check(Math.abs(T / N - .896) < .02, 'Dragon Tiger: Tie 11:1 (labelled sucker bet)', pct(T / N)); }
  console.log('\n-- poker tables (played out) --');
  { let a = 0, pp = 0, staked = 0; const N = 400000; for (let i = 0; i < N; i++) { const d = K.shuffle(Array.from({ length: 52 }, (_, i) => i)), pc = d.slice(0, 3), dc = d.slice(3, 6);
      const play = K.tcpAdvice(pc) === 'play'; const r = K.tcpSettle(1, play, 0, pc, dc); a += r.ret; staked += play ? 2 : 1; pp += K.tcpSettle(0, false, 1, pc, dc).ret; }
    check(Math.abs(1 + (a - staked) / N - .9663) < .006, 'Three Card Poker ante + play, optimal (per ante)', pct(1 + (a - staked) / N) + ` · ${pct(a / staked)} per unit staked`);
    check(inBand(pp / N), 'Three Card Poker Pair Plus (1 / 4 / 6 / 30 / 40)', pct(pp / N)); }
  { let back = 0, stk = 0; const N = 200000; for (let i = 0; i < N; i++) { const d = K.shuffle(Array.from({ length: 52 }, (_, i) => i)), pc = d.slice(0, 2), dc = d.slice(2, 4), board = d.slice(4, 9);
      const call = K.cheAdvice(pc, board.slice(0, 3)) === 'call'; stk += call ? 3 : 1; back += K.cheSettle(1, call, pc, dc, board).ret; }
    check(inBand(back / stk), "Casino Hold'em with the table's call/fold hint (per unit staked)", pct(back / stk) + ` · ${pct(1 + (back - stk) / N)} per ante`); }
  console.log('\n-- money wheel, sic bo, craps (exact) --');
  { const segs = K.MW_SEG, rets = K.MW.map(([m]) => [m, segs.filter(s => s === m).length * m / segs.length]);
    check(segs.length === 49 && rets.every(([, r]) => Math.abs(r - 48 / 49) < 1e-9), 'Money Wheel: every symbol returns 97.96%', rets.map(([m, r]) => '×' + m + ' ' + pct(r)).join(' · ')); }
  { const all = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) all.push([a, b, c]);
    const bets = [{ t: 'small' }, { t: 'big' }, { t: 'odd' }, { t: 'even' }, { t: 'anyTriple' }, { t: 'triple', n: 4 }, { t: 'double', n: 2 }, { t: 'combo', a: 1, b: 5 }, { t: 'single', n: 3 }].concat(Array.from({ length: 14 }, (_, i) => ({ t: 'total', n: i + 4 })));
    const rets = bets.map(b => [b.t + (b.n || ''), all.reduce((s, d) => s + K.sbWin(b, d), 0) / 216]);
    check(rets.every(([, r]) => inBand(r)), 'Sic Bo: every bet 96-99%', rets.map(([k, r]) => k + ' ' + pct(r)).join(' · ')); }
  { const P = s => { let n = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) n++; return n / 36; };
    const oneRoll = t => { let r = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) r += K.crRoll({ t, amt: 1 }, a, b, 0).ret / 36; return r; };
    /* pass line, exactly */ let pass = P(7) + P(11); for (const p of [4, 5, 6, 8, 9, 10]) pass += P(p) * P(p) / (P(p) + P(7)); pass *= 2;
    let dp = (P(2) + P(3)) * 2 + P(12); for (const p of [4, 5, 6, 8, 9, 10]) dp += P(p) * P(7) / (P(p) + P(7)) * 2;
    check(Math.abs(pass - .9859) < .0005, 'Craps Pass Line', pct(pass)); check(Math.abs((dp - P(12)) / (1 - P(12)) - .9864) < .002, "Craps Don't Pass (per resolved bet)", pct((dp - P(12)) / (1 - P(12))));
    const place = n => { const [a, b] = K.CR_PLACE[n]; return P(n) / (P(n) + P(7)) * (1 + a / b); };
    check(inBand(place(6)) && inBand(place(5)), 'Place 6/8 (7:6) and 5/9 (7:5)', pct(place(6)) + ' · ' + pct(place(5)));
    check(Math.abs(place(4) - .9333) < .001, 'Place 4/10 (9:5, labelled)', pct(place(4)));
    check(inBand(oneRoll('field')), 'Field (2 pays 2:1, 12 pays 3:1)', pct(oneRoll('field')));
    check(Math.abs(oneRoll('any7') - 5 / 6) < 1e-9 && oneRoll('yo') < .9, 'props are labelled sucker bets (any 7 83.3%, yo 88.9%)', pct(oneRoll('any7')) + ' · ' + pct(oneRoll('yo'))); }
}
async function ui() {
  const playwright = require('playwright'); const b = await playwright.chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] }), errs = [];
  const pg = await b.newPage({ viewport: { width: 1600, height: 900 } }); pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.goto('file://' + FILE); await pg.waitForTimeout(500); await pg.evaluate('localStorage.clear()'); await pg.reload();
  await pg.waitForFunction('typeof BOOTED!=="undefined"&&BOOTED', null, { timeout: 30000 }); await pg.waitForTimeout(800);
  console.log('\n-- lobby --');
  check(await pg.evaluate("document.querySelectorAll('#lobby .tcard').length===TABLES.length&&TABLES.length===12"), 'the lobby lists all 12 tables (one roulette, plus Hold\'em, Casino War, Andar Bahar)');
  await pg.waitForFunction("Object.keys(THUMBS).length>=12", null, { timeout: 60000 });
  check(await pg.evaluate("[...document.querySelectorAll('#lobby .tcard .im')].every(e=>/data:image/.test(e.style.backgroundImage))"), 'every table card shows a live render of the table and its dealer');
  await pg.click('[data-r="2"]'); await pg.waitForTimeout(400); check(await pg.evaluate("save.room===2&&/Private VIP/i.test(document.querySelector('.room.on').textContent)"), 'rooms switch (Private VIP: $1K to $1M)');
  await pg.click('[data-r="0"]'); await pg.waitForTimeout(300);
  console.log('\n-- every table plays a round on the wallet --');
  /* wallet audit: every dollar in and out goes through spend/credit */
  await pg.evaluate("window.__io={out:0,in:0};const s0=spend,c0=credit;spend=n=>{const ok=s0(n);if(ok)__io.out+=Math.round(n*100)/100;return ok};credit=n=>{if(n>0)__io.in+=Math.round(n*100)/100;c0(n)}");
  const bets = { bj: "placeChip('m1',25);placeChip('pp1',5);placeChip('t31',5)", 'rou-eu': "placeChip('n17',5);placeChip('red',25);placeChip('doz2',10)", war: "placeChip('war',25);placeChip('tie',5)", ab: "placeChip('andar',25)",
    bac: "placeChip('banker',25);placeChip('tie',5)", dt: "placeChip('dragon',25)", tcp: "placeChip('ante',25);placeChip('pp',5)", che: "placeChip('ante',25)", mw: "placeChip('x2',25);placeChip('x12',5)", sb: "placeChip('small',25);placeChip('s10',5);placeChip('n3',5)", cr: "placeChip('pass',25);placeChip('field',5)" };
  for (const t of await pg.evaluate("TABLES.map(t=>t.g+(t.v?'-'+t.v:'')).filter(k=>k!=='pk')")) {
    await pg.evaluate(`StackFrame.open('${t}')`); await pg.waitForTimeout(700);
    const b0 = await pg.evaluate('getBal()'); await pg.evaluate("__io.out=0;__io.in=0"); await pg.evaluate(bets[t]); const placed = await pg.evaluate('betTotal()');
    const res = await pg.evaluate(`(async()=>{const clicker=setInterval(()=>{const a=document.querySelector('#acts [data-a]');if(a)a.click()},300);let moved=false;const mv=setInterval(()=>{for(const s of['l','r']){const c=DL.hands[s].cur;if(c&&c.distanceTo(restPt(s))>.03)moved=true}},80);
      const t0=performance.now();await go();clearInterval(clicker);clearInterval(mv);return{phase:TB.phase,ms:Math.round(performance.now()-t0),moved,left:Object.keys(TB.bets).length}})()`);
    const b1 = await pg.evaluate('getBal()'), io = await pg.evaluate('__io'), persist = t === 'cr';
    const audit = Math.abs((b1 - b0) - (io.in - io.out)) < .011;
    check(res.phase === 'bet' && audit && placed > 0 && (persist || res.left === 0) && res.moved, `${t}: a full round, the dealer works it, and the wallet balances to the cent`, `staked ${placed} · back ${io.in.toFixed(2)} · ${res.ms} ms`);
    if (t === 'bj') { const hd = await pg.evaluate("document.querySelectorAll('#hands .hgrp').length"); }
    if (t === 'rou-eu') { const r = await pg.evaluate("(()=>{const n=RHIST()[0];const want=(n===17?180:0)+(rColor(n)==='red'?50:0)+(n>=13&&n<=24?30:0);return{n,want}})()");
      check(Math.abs(io.in - r.want) < .011, 'roulette pays exactly what the layout says for the number that came up', `landed ${r.n}, paid ${io.in}`); }
  }
  console.log('\n-- v2: the card overlay, the wheel pointer, poker --');
  { await pg.evaluate("StackFrame.open('che')"); await pg.waitForTimeout(700); await pg.evaluate("placeChip('ante',25)");
    pg.evaluate('go()').catch(() => {}); await pg.waitForFunction("document.querySelector('#acts [data-a]')", null, { timeout: 20000 });
    const hd = await pg.evaluate("({on:$('hands').classList.contains('on'),groups:[...document.querySelectorAll('#hands .hgrp h4 span')].map(e=>e.textContent),imgs:document.querySelectorAll('#hands img').length,w:document.querySelector('#hands img').getBoundingClientRect().width})");
    await pg.click('#acts [data-a="fold"]'); await pg.waitForFunction("TB.phase==='bet'", null, { timeout: 30000 });
    check(hd.on && hd.groups.join() === 'DEALER,BOARD,YOU' && hd.imgs === 7 && hd.w >= 56, "every hand shows big on screen (Casino Hold'em: dealer, board, you)", JSON.stringify(hd)); }
  { await pg.evaluate("StackFrame.open('mw')"); await pg.waitForTimeout(700); await pg.evaluate("placeChip('x2',5)"); await pg.evaluate('go()');
    const wp = await pg.evaluate("(()=>{const step=TAU/49,i=Math.round(((MWH.a%TAU)+TAU)%TAU/step)%49;return{under:MW_SEG[i],res:save.hist.mw[0],arrow:!!MWH.arrow}})()");
    check(wp.arrow && wp.under === wp.res, 'the Money Wheel has a pointer, and the segment under it is the result', JSON.stringify(wp)); }
  { await pg.evaluate("StackFrame.open('pk')"); await pg.waitForTimeout(800); await pg.evaluate("__io.out=0;__io.in=0"); const b0 = await pg.evaluate('getBal()');
    const pk = await pg.evaluate(`(async()=>{const clicker=setInterval(()=>{const b=[...document.querySelectorAll('#acts [data-a]')];const c=b.find(x=>x.dataset.a==='call')||b[0];if(c)c.click()},250);const st=[];
      for(let h=0;h<3;h++){await go();st.push({me:save.pk.me,bots:Object.values(PK.bots).every(b=>b.stack>=0)})}clearInterval(clicker);const hands=save.pk.hands,me=save.pk.me;StackFrame.lobby();return{st,hands,me,left:save.pk.me}})()`);
    const b1 = await pg.evaluate('getBal()'), io = await pg.evaluate('__io');
    check(pk.hands >= 3 && pk.st.every(x => x.me >= 0 && x.bots) && pk.left === 0 && Math.abs((b1 - b0) - (io.in - io.out)) < .011 && Math.abs(io.in - pk.me) < .011,
      "Hold'em: three full hands against the AI, and leaving the table cashes your stack back to the cent", JSON.stringify({ hands: pk.hands, cashed: io.in, bought: io.out })); }
  console.log('\n-- keyboard --');
  { await pg.evaluate("StackFrame.open('bj')"); await pg.waitForTimeout(600); await pg.click('[data-ch="2"]'); await pg.keyboard.press('2'); await pg.evaluate("placeChip('m1',25)");
    const chip = await pg.evaluate('TB.chip'); await pg.keyboard.press('x'); const dbl = await pg.evaluate("TB.bets.m1"); await pg.keyboard.press('z'); const und = await pg.evaluate("TB.bets.m1");
    await pg.keyboard.press('Space'); await pg.waitForFunction("document.querySelector('#acts [data-a]')", null, { timeout: 15000 }); await pg.keyboard.press('s');
    await pg.waitForFunction("TB.phase==='bet'", null, { timeout: 30000 });
    check(chip === 1 && dbl === 50 && und === 25, 'keys 1-6 pick a chip, X doubles, Z undoes', JSON.stringify({ chip, dbl, und }));
    pass('Space deals and S stands (a round played through on keys alone)'); }
  console.log('\n-- sound, dealer, saving --');
  check(await pg.evaluate("AU.ready&&Object.keys(AU.buf).length>=50"), 'all 50 recorded casino sounds decode', String(await pg.evaluate('Object.keys(AU.buf).length')));
  await pg.evaluate("StackFrame.open('bj')"); await pg.waitForTimeout(600);
  const face = await pg.evaluate("(()=>{const c=document.getElementById('dl'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=40)if(d[i]>0)n++;return n})()");
  check(face > 1000, 'the dealer is drawn over the live table', face + ' px');
  await pg.evaluate("dealerExpr('big',3000);dealerSay('test')"); await pg.waitForTimeout(400); check(await pg.evaluate("DL.expr.smile>.5&&document.getElementById('bubble').classList.contains('on')"), 'the dealer smiles and talks');
  const hs = await pg.evaluate("(save.hist.bac||[]).length"); await pg.evaluate("persist()"); await pg.waitForTimeout(500); await pg.reload(); await pg.waitForFunction('typeof BOOTED!=="undefined"&&BOOTED', null, { timeout: 30000 });
  check(await pg.evaluate(`(save.hist.bac||[]).length===${hs}&&${hs}>0&&(save.hist.eu||[]).length>=1`), 'history (roads, last numbers) survives a reload');
  console.log('\n-- inside Stack --');
  const cp = await b.newPage({ viewport: { width: 1600, height: 950 } }); cp.on('pageerror', e => errs.push('casino: ' + e)); cp.on('dialog', d => d.accept().catch(() => {}));
  await cp.goto('file://' + CASINO); await cp.waitForTimeout(600); await cp.waitForSelector('#authGate.show'); await cp.click('[data-am="signup"]'); const u = 'ut' + Date.now() % 1e6; await cp.fill('#auU', u); await cp.fill('#auP', 'pw123'); await cp.fill('#auP2', 'pw123'); await cp.click('#auGo'); await cp.waitForFunction('loggedIn()');
  await cp.evaluate("P().bal=5000;renderBal();go('lobby')"); await cp.waitForTimeout(500);
  check(await cp.evaluate("document.querySelectorAll('#tilesTables .ttbl').length===13&&!!document.querySelector('#tblBan .b3go')&&[...document.querySelectorAll('#side [data-g^=\"tb-\"]')].length===12"), 'Stack home: the Tables row (12 tables + Stack Pool), the banner and 12 sidebar entries');
  check(await cp.evaluate("!document.querySelector('#tilesCasino [data-go=\"roulette\"]')&&!document.querySelector('#tilesCasino [data-go=\"craps\"]')&&!!document.querySelector('#tilesCasino [data-go=\"poker\"]')"), 'the old solo roulette and craps left the casino row; video poker moved in');
  await cp.evaluate("go('tb-sb')"); await cp.waitForFunction("FG.tables.ready&&FG.tables.frame.contentWindow.eval('CUR&&CUR.g')==='sb'", null, { timeout: 40000 });
  const w = await cp.evaluate("(async()=>{const w=FG.tables.frame.contentWindow,b0=P().bal;w.placeChip('big',50);const b1=P().bal;await w.go();return{b0,b1,after:P().bal,shown:w.document.getElementById('bal').textContent,top:getComputedStyle(w.document.getElementById('topup')).display}})()");
  check(w.b0 - w.b1 === 50 && w.top === 'none' && /\$/.test(w.shown), 'a sidebar entry opens that table; bets come off the Stack wallet and wins go back', JSON.stringify(w));
  await cp.evaluate("go('tb-bj')"); await cp.waitForFunction("FG.tables.frame.contentWindow.eval('CUR&&CUR.g')==='bj'&&FG.tables.frame.contentWindow.eval('TB.phase')==='bet'", null, { timeout: 40000 }); await cp.waitForTimeout(400);
  await cp.evaluate("FG.tables.frame.contentWindow.placeChip('m1',25)"); await cp.keyboard.press('Space'); await cp.waitForTimeout(800);
  check(await cp.evaluate("FG.tables.frame.contentWindow.eval('TB.phase')") === 'play', 'inside Stack, opening a table from the sidebar gives it the keyboard (Space deals)');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  await b.close();
}

(async () => { if (mode === 'sim') sim(); else await ui(); const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0); })();
