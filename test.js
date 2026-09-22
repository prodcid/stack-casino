#!/usr/bin/env node
/* test.js â€” browser regression for the single-file build.
   node test.js            everything
   node test.js solo       single-player games + tickets + cosmetics
   node test.js admin      admin portal: stats, user table, suspend, audit
   node test.js mp         two-window multiplayer, all party tables
   node test.js rtp        maths only (fast, no clicking)
   node test.js strip      The Strip full game + money-conservation audit
   Needs: npm i -D playwright && npx playwright install chromium
*/
const path = require('path');
const FILE = process.env.STACK_FILE || 'stack-casino.html';
const URL = 'file://' + path.resolve(FILE);
let playwright;
try { playwright = require('playwright'); }
catch { console.error('x  playwright missing.  npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const results = [];
const pass = (n, d = '') => { results.push([true, n, d]); console.log(`  ok   ${n}${d ? '  ' + d : ''}`); };
const fail = (n, d = '') => { results.push([false, n, d]); console.log(`  FAIL ${n}${d ? '  ' + d : ''}`); };
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

/* PeerJS stand-in: wires two pages straight to each other, no network. */
const MOCK = `
window.Peer=class{constructor(id){this.id=id||('anon'+Math.random());this.h={};window.__peer=this;setTimeout(()=>this.h.open&&this.h.open(this.id),20)}
 on(e,f){this.h[e]=f} connect(){const c=window.__mk();window.__conn=c;setTimeout(()=>window.__netOut(JSON.stringify({type:'connect'})),20);return c} destroy(){} reconnect(){}};
window.__mk=()=>({open:false,h:{},on(e,f){this.h[e]=f},send(d){window.__netOut(JSON.stringify({type:'data',d}))},close(){}});
window.__netIn=(s)=>{const m=JSON.parse(s);
 if(m.type==='connect'){const c=window.__mk();window.__conn=c;window.__peer.h.connection(c);setTimeout(()=>{c.open=true;c.h.open&&c.h.open();window.__netOut(JSON.stringify({type:'opened'}))},15)}
 else if(m.type==='opened'){const c=window.__conn;c.open=true;c.h.open&&c.h.open()}
 else if(m.type==='data'){const c=window.__conn;c&&c.h.data&&c.h.data(m.d)}};`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The app is gated behind login. Sign each page in with its own account so that
   multiplayer tests use two genuinely distinct identities. */
async function signIn(pg, user) {
  await pg.waitForSelector('#authGate.show', { timeout: 8000 });
  await pg.click('[data-am="signup"]');
  await pg.fill('#auU', user);
  await pg.fill('#auP', 'pw123');
  await pg.fill('#auP2', 'pw123');
  await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()', null, { timeout: 8000 });
  await pg.waitForTimeout(150);
}

async function newPage(ctx, errs, tag, withMock) {
  const pg = await ctx.newPage();
  if (withMock) await pg.addInitScript(MOCK);
  pg.on('pageerror', e => errs.push(`${tag}: ${e}`));
  pg.on('dialog', d => d.accept().catch(() => {}));
  await pg.goto(URL);
  await pg.waitForTimeout(500);
  if (await pg.evaluate('!loggedIn()')) await signIn(pg, 'u' + tag);
  return pg;
}
const tap = async (pg, sel, wait = 400) => {
  try { await pg.click(sel, { timeout: 2500 }); } catch {}
  await pg.waitForTimeout(wait);
};

/* ---------------- solo ---------------- */
async function solo(ctx, errs) {
  console.log('\nSINGLE PLAYER');
  const pg = await newPage(ctx, errs, 'solo', false);
  await pg.evaluate("P().bal=900000;renderBal()");

  const games = [
    ['plinko', [['#plGo', 1500]]],
    ['bj', [['#bjDeal', 2100], ['#bjStand', 2300]]],
    ['poker', [['#pkGo', 800], ['#pkGo', 2100]]],
    ['slots', [['#slGo', 4000]]],
    ['chicken', [['#ckGo', 600], ['#ckGo', 1300], ['#ckCash', 800]]],
    ['balloon', [['#bpGo', 2000], ['#bpGo', 1300]]],
    ['wheel', [['#whGo', 5200]]],
    ['mines', [['#mnGo', 300], ['#mnRand', 450], ['#mnGo', 800]]],
    ['dice', [['#dcGo', 1400]]],
    ['roulette', [['[data-k="red"]', 150], ['#rGo', 6500]]],
    ['keno', [['#knAuto', 300], ['#knGo', 3000]]],
    ['hilo', [['#hlGo', 600], ['#hlHi', 800], ['#hlCash', 700]]],
    ['bacc', [['.bspot[data-b="b"]', 200], ['#bGo', 4000]]],
    ['tower', [['#twGo', 400], ['#twRand', 600], ['#twGo', 800]]],
    ['limbo', [['#lbGo', 1400]]],
    ['craps', [['[data-b="pass"]', 150], ['#crRoll', 1900]]],
    ['moles', [['#moGo', 500], ['.mohole[data-h="0"]', 900], ['.mohole[data-h="1"]', 900]]],
  ];
  for (const [view, acts] of games) {
    const n0 = errs.length;
    await pg.evaluate(`go('${view}')`); await pg.waitForTimeout(300);
    for (const [sel, w] of acts) await tap(pg, sel, w);
    errs.length === n0 ? pass(view) : fail(view, errs.slice(n0).join(' | '));
  }

  for (const k of ['crown', 'deep', 'neon', 'gold']) {
    const n0 = errs.length;
    await pg.evaluate(`go('scratch');SC.kind='${k}';scPickUI();scIdle()`); await pg.waitForTimeout(300);
    await tap(pg, '#scGo', 500);
    for (let i = 0; i < 4; i++) {
      if (await pg.evaluate("SC.phase!=='play'")) break;
      await tap(pg, '#scRevealStage', 1300);
    }
    const done = await pg.evaluate("SC.phase") === 'done';
    (errs.length === n0 && done) ? pass('ticket ' + k) : fail('ticket ' + k, done ? errs.slice(n0).join(' | ') : 'did not settle');
  }

  const n0 = errs.length;
  await pg.evaluate("go('locker')"); await pg.waitForTimeout(300);
  for (const t of ['skins', 'frames', 'plates']) { await pg.evaluate(`lkTab='${t}';lkTabs()`); await pg.waitForTimeout(400); }
  errs.length === n0 ? pass('cosmetics') : fail('cosmetics', errs.slice(n0).join(' | '));

  // mobile smoke: nothing should throw at phone width
  const n1 = errs.length;
  await pg.setViewportSize({ width: 390, height: 844 });
  for (const v of ['lobby', 'balloon', 'craps', 'scratch', 'roulette']) { await pg.evaluate(`go('${v}')`); await pg.waitForTimeout(350); }
  errs.length === n1 ? pass('mobile 390px') : fail('mobile 390px', errs.slice(n1).join(' | '));
  await pg.close();
}






/* ---------------- party presence / join / side bets ---------------- */
async function coop(browser, errs) {
  console.log('\nPARTY HUD');
  const [A, B] = await connectPair(browser, errs);
  if (await A.evaluate("NET.status") !== 'connected') { fail('coop: no connection'); await A.close(); await B.close(); return; }

  // B wanders off into Moles; A should be told about it
  await B.evaluate("go('moles')");
  await A.waitForTimeout(500);
  const seen = await A.evaluate("[CO.theirGame, !!document.querySelector('#coHud.show')]");
  (seen[0] === 'moles' && seen[1]) ? pass('presence shows their game', 'moles')
                                   : fail('presence shows their game', JSON.stringify(seen));

  // mid-round is reported as busy, and an invite is HELD rather than interrupting
  await B.evaluate("P().bal=10000;renderBal();$('moBet').value='10';moStart()");
  await A.waitForTimeout(500);
  const busy = await A.evaluate("CO.theirBusy");
  busy ? pass('mid-round reads as busy') : fail('mid-round reads as busy');

  await A.evaluate("coJoin()");
  await B.waitForTimeout(500);
  const held = await B.evaluate("[!!CO.held, !!CO.inReq]");
  (held[0] && !held[1]) ? pass('invite waits while they are mid-round')
                        : fail('invite waits while they are mid-round', JSON.stringify(held));

  // end B's round -> the invite should surface
  await B.evaluate("MO.phase='idle';MO.busy=false;coPresSend()");
  await B.waitForTimeout(600);
  const surfaced = await B.evaluate("[!!CO.inReq, !!CO.held]");
  (surfaced[0] && !surfaced[1]) ? pass('invite arrives once the round ends')
                                : fail('invite arrives once the round ends', JSON.stringify(surfaced));

  await B.evaluate("coAccept()");
  await A.waitForTimeout(600);
  const joined = await A.evaluate("[CO.on, CO.game]");
  (joined[0] && joined[1] === 'moles') ? pass('both land in the same game', 'moles')
                                       : fail('both land in the same game', JSON.stringify(joined));

  // B starts a round -> A gets a priced side-bet offer
  await B.evaluate("MO.moles=5;$('moBet').value='10';moStart()");
  await A.waitForTimeout(600);
  const offer = await A.evaluate("CO.offer?[CO.offer.q, CO.offer.label]:null");
  (offer && Math.abs(offer[0] - 5/7) < 1e-9) ? pass('side-bet offer priced from live odds', (offer[0]*100).toFixed(1) + '%')
                                             : fail('side-bet offer priced from live odds', JSON.stringify(offer));

  // A backs YES; stake leaves A's wallet only
  const bal = await A.evaluate("P().bal");
  const bBal = await B.evaluate("P().bal");
  await A.evaluate("$('coStake').value='20';coBet('yes')");
  await A.waitForTimeout(250);
  const took = await A.evaluate(`Math.round((${bal}-P().bal)*100)/100`);
  const bUnchanged = await B.evaluate(`Math.abs(P().bal-${bBal})<0.001`);
  (took === 20 && bUnchanged) ? pass('side bet is house-banked, not player-vs-player')
                              : fail('side bet is house-banked', 'took ' + took + ', theirs changed: ' + !bUnchanged);

  // force a hit on B -> A's YES must pay at 0.97/q
  const before = await A.evaluate("P().bal");
  await B.evaluate(`(()=>{const el=document.querySelector('.mohole[data-h="0"]');MO.set=new Set([0]);moWhack(0,el)})()`);
  await A.waitForTimeout(1400);
  const paidA = await A.evaluate(`Math.round((P().bal-${before})*100)/100`);
  const want = Math.round(20 * (0.97 / (5/7)) * 100) / 100;
  Math.abs(paidA - want) < 0.02 ? pass('winning side bet pays 0.97/q', paidA + ' (want ' + want + ')')
                                : fail('winning side bet pays 0.97/q', paidA + ' vs ' + want);

  // leaving the game ends the session for both
  await A.evaluate("go('lobby')");
  await B.waitForTimeout(500);
  const ended = await B.evaluate("CO.on");
  !ended ? pass('leaving the game ends the session') : fail('leaving the game ends the session');

  await A.close(); await B.close();
}


/* ---------------- fight night ---------------- */
async function fight(ctx, errs) {
  console.log('\nFIGHT NIGHT');
  const pg = await newPage(ctx, errs, 'fn', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=1000000;renderBal();go('fight')");
  await pg.waitForTimeout(700);

  // every fight must terminate, and only in legal ways
  const sanity = await pg.evaluate(`(()=>{
    let ko=0,dec=0,draw=0,bad=0,rds={1:0,2:0,3:0};
    for(let i=0;i<3000;i++){
      const S=fnState(FN_F[i%6].id, FN_F[(i*3+1)%6].id);
      const r=fnPlayOut(S,Math.random);
      if(!r){bad++;continue}
      if(r.ko){ko++; if(r.rd<1||r.rd>3)bad++; else rds[r.rd]++;}
      else if(r.win==='d')draw++; else dec++;
      if(!['a','b','d'].includes(r.win))bad++;
      if(!r.ko && r.rd!==0)bad++;
    }
    return [bad, ko, dec, draw, rds];
  })()`);
  sanity[0] === 0 ? pass('every fight resolves legally',
      sanity[1] + ' KO, ' + sanity[2] + ' decision, ' + sanity[3] + ' draw')
    : fail('every fight resolves legally', sanity[0] + ' malformed');
  // A believable card: mostly decisions, a real minority of stoppages, and
  // stoppages possible in EVERY round - otherwise the round 1/2 markets are
  // permanently suspended and there is nothing to bet on.
  const koPct = sanity[1]/3000*100, decPct = sanity[2]/3000*100;
  (koPct > 22 && koPct < 50 && decPct > 40 && sanity[4][1] > 60 && sanity[4][2] > 60)
    ? pass('outcome mix looks like boxing',
           koPct.toFixed(1) + '% KO, ' + decPct.toFixed(1) + '% decision, stoppages by round ' + JSON.stringify(sanity[4]))
    : fail('outcome mix looks like boxing', JSON.stringify(sanity));

  // market books must be complete
  const books = await pg.evaluate(`(()=>{
    const P=FN.prices;
    return [['winner',P.wa+P.wd+P.wb],['distance',P.ko+P.dist],
            ['method',P.ako+P.adc+P.bko+P.bdc+P.wd],
            ['stoppage',P.r1+P.r2+P.r3+P.dist]];
  })()`);
  const badBook = books.find(b => Math.abs(b[1]-1) > 0.02);
  badBook ? fail('market books sum to 1', badBook[0] + ' = ' + badBook[1].toFixed(3))
          : pass('market books sum to 1', books.map(b=>b[0]).join(', '));

  // THE test: prices come from the same engine the player watches, so realised
  // returns must land on 97%. Price once, then settle against fresh fights.
  const rtp = await pg.evaluate(`(()=>{
    const out=[];
    for(const k of ['wa','wb','ko','dist','adc','r3']){
      const P=fnPrices(fnState('raz','cyc'),60000);   // the book's price
      const price=P[k]; if(!(price>0))continue;
      const odds=0.97/price;
      let ret=0;const N=40000;
      for(let i=0;i<N;i++){
        const r=fnPlayOut(fnState('raz','cyc'),Math.random);
        if(r && FN_MK[k].f(r)) ret+=odds;
      }
      // tolerance from the estimator's own variance, not a guess: an all-or-
      // nothing payout at probability p has relative SE ~ 1/sqrt(pN)
      const se=97*Math.sqrt((1-price)/(price*N));
      out.push([k, ret/N*100, Math.max(0.6, 4*se)]);
    }
    return out;
  })()`);
  const rtpBad = rtp.find(r => Math.abs(r[1]-97) > r[2]);
  rtpBad ? fail('realised RTP sits on 97%', rtpBad[0] + ' = ' + rtpBad[1].toFixed(2) + '% (tol ' + rtpBad[2].toFixed(2) + ')')
         : pass('realised RTP sits on 97%', rtp.map(r=>r[0]+' '+r[1].toFixed(1)).join(', '));

  // accumulator legs are correlated; joint counting must beat the naive product
  // 'ham wins' and 'ham by KO' are nested, so the product rule is badly wrong
  // by construction - exactly the case a naive book gets wrong.
  const joint = await pg.evaluate(`(()=>{
    fnPrices(fnState('ham','gho'),40000);
    const jt=fnJointP(['wa','ako']);
    const naive=FN.prices.wa*FN.prices.ako;
    let both=0;const N=40000;
    for(let i=0;i<N;i++){const r=fnPlayOut(fnState('ham','gho'),Math.random);
      if(r&&r.win==='a'&&r.ko)both++}
    return [jt,naive,both/N];
  })()`);
  const jErr=Math.abs(joint[0]-joint[2]), nErr=Math.abs(joint[1]-joint[2]);
  (jErr < 0.02 && nErr > jErr)
    ? pass('acca legs priced jointly', 'joint off ' + (jErr*100).toFixed(2) + 'pp vs product ' + (nErr*100).toFixed(2) + 'pp')
    : fail('acca legs priced jointly', JSON.stringify(joint));

  // no price below evens may ever be offered
  const minOdds = await pg.evaluate(`(()=>{
    let worst=99,n=0;
    for(let i=0;i<40;i++){
      const S=fnState(FN_F[i%6].id,FN_F[(i*5+2)%6].id);
      for(let t=0;t<30;t++)fnTick(S,Math.random);
      const P=fnPrices(S,1500);
      for(const k in FN_MK){const o=fnOdds(P[k]);
        if(P[k]>0&&fnLive(o)){n++;worst=Math.min(worst,o)}}
    }
    return [worst,n];
  })()`);
  (minOdds[0] > 1.0 && minOdds[1] > 100)
    ? pass('no sub-evens price offered', 'lowest ' + minOdds[0].toFixed(3) + ' over ' + minOdds[1] + ' quotes')
    : fail('no sub-evens price offered', JSON.stringify(minOdds));

  // stake in, correct payout out
  const flow = await pg.evaluate(`(()=>{
    FN.open=[];FN.sel=[];FN.mode='single';FN.phase='idle';
    const S=FN.state;
    FN.sel.push({key:'wa',p:FN.prices.wa,o:fnOdds(FN.prices.wa),label:'x'});
    fnSlipRender();$('fnStake').value='100';
    const b4=P().bal; fnPlaceBet();
    const took=Math.round((b4-P().bal)*100)/100;
    S.over=true;S.res={win:'a',ko:true,rd:2};
    const b5=P().bal; fnSettle();
    const paid=Math.round((P().bal-b5)*100)/100;
    return [took,paid,Math.round(100*fnOdds(FN.prices.wa)*100)/100];
  })()`);
  (flow[0]===100 && Math.abs(flow[1]-flow[2])<0.02)
    ? pass('stake taken and winner paid', flow[0]+' in, '+flow[1]+' out')
    : fail('stake taken and winner paid', JSON.stringify(flow));

  // the guide must be the BOXING one, and must actually explain the jargon
  await pg.evaluate("go('fight')"); await pg.waitForTimeout(200);
  await pg.click('#fnGuideBtn'); await pg.waitForTimeout(300);
  const g = await pg.evaluate(`(()=>{
    const open=!!document.querySelector('#fnGuide.show');
    const t=$('fnGuide').textContent;
    return [open, t.includes('the full scheduled length'), t.includes('Stoppage round'),
            !document.querySelector('#fbGuide.show')];
  })()`);
  (g[0] && g[1] && g[2] && g[3])
    ? pass('boxing guide opens and explains the distance')
    : fail('boxing guide opens and explains the distance', JSON.stringify(g));
  await pg.click('#fnGuideClose'); await pg.waitForTimeout(200);
  (await pg.evaluate("!document.querySelector('#fnGuide.show')"))
    ? pass('boxing guide closes') : fail('boxing guide closes');

  // Typing a stake must keep focus across every digit - the slip used to
  // rebuild on each keystroke and throw you out of the box.
  await pg.evaluate("FN.sel=[];FN.open=[];FN.phase='idle';fnPick('wa');fnUI()");
  await pg.waitForTimeout(200);
  await pg.click('#fnStake', { clickCount: 3 });
  await pg.keyboard.type('4567', { delay: 60 });
  const typed = await pg.evaluate("[ $('fnStake').value, document.activeElement && document.activeElement.id, $('fnSumStake').textContent ]");
  (typed[0] === '4567' && typed[1] === 'fnStake' && typed[2].replace(/,/g,'') === '4567.00')
    ? pass('stake box keeps focus while typing', 'typed 4567 in one go')
    : fail('stake box keeps focus while typing', JSON.stringify(typed));

  // and survives a live re-render mid-typing (odds tick while you type)
  await pg.evaluate("fnUI()");
  await pg.keyboard.type('8');
  const kept = await pg.evaluate("[ $('fnStake').value, document.activeElement && document.activeElement.id ]");
  (kept[0] === '45678' && kept[1] === 'fnStake')
    ? pass('focus survives a live odds refresh') : fail('focus survives a live odds refresh', JSON.stringify(kept));

  // history must say WHICH bet paid
  await pg.evaluate("FN.sel=[];fnUI()");
  const note = await pg.evaluate(`(()=>{
    FN.open=[{id:9,keys:['wa'],label:'x',stake:10,odds:2,state:'open'}];
    FN.state.over=true;FN.state.res={win:'a',ko:true,rd:1};
    fnSettle();
    return S.hist[0].note||'';
  })()`);
  note.includes(' wins') ? pass('history names the winning bet', note) : fail('history names the winning bet', note);

  errs.length === n0 ? pass('no fight console errors') : fail('no fight console errors', errs.slice(n0).join(' | '));
  await pg.close();
}


/* ---------------- stack cards ---------------- */
async function cards(ctx, errs) {
  console.log('\nSTACK CARDS');
  const pg = await newPage(ctx, errs, 'tc', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=5000;renderBal();go('cards')");
  await pg.waitForTimeout(900);

  const mounted = await pg.evaluate("!!document.querySelector('#tcgHost').shadowRoot && !!StackCards.root.querySelector('.tabs') && StackCards.root.offsetHeight>400");
  mounted ? pass('cards mount inside the casino') : fail('cards mount inside the casino');

  const bal = await pg.evaluate("StackCards.root.querySelector('#tcgBal').textContent.replace(/,/g,'')");
  bal === '5000' ? pass('cards show the casino wallet', bal) : fail('cards show the casino wallet', bal);

  // Isolation: the engine renders in a Shadow DOM so the 14 class names it shares
  // with the casino (.bal .flip .win .stage ...) cannot bleed in. The tell-tale
  // was the header bar: the Balloon Pump's .bal rule blew it up to 288px tall.
  const iso = await pg.evaluate(`[StackCards.root.querySelector('.bar').offsetHeight, getComputedStyle(document.querySelector('.main')).overflowY]`);
  (iso[0] < 100 && iso[1] === 'auto') ? pass('card game is isolated from casino CSS', 'header ' + iso[0] + 'px')
    : fail('card game is isolated from casino CSS', JSON.stringify(iso));

  // every card carries its set number
  const nums = await pg.evaluate(`(()=>{StackCards.go('binder');
    const all=[...StackCards.root.querySelectorAll('#tcg .grid .mini:not(.dialock):not(.diaslot) .cno')].map(e=>e.textContent);
    return [all.length, all[0], all[all.length-1], StackCards.SET.length]})()`);
  (nums[0] === nums[3] && nums[1] === '001/127' && nums[2] === '127/127')
    ? pass('every card is numbered', nums[1] + ' .. ' + nums[2]) : fail('every card is numbered', JSON.stringify(nums));

  // pulls save to the ACCOUNT and survive a reload
  await pg.evaluate(`(()=>{const X=StackCards._,SET=StackCards.SET,fa=SET.find(c=>c.t==='fa');
    const c=X.col;c[SET[0].id]={n:2,f:1};const i=X.newInst(fa.id);c.inst.push(i);(c[fa.id]||(c[fa.id]={n:0,f:0})).n++;
    window.StackBridge.save(c)})()`);
  await pg.reload(); await pg.waitForTimeout(900);
  const kept = await pg.evaluate("(()=>{const c=P().cards||{};return [c[0]&&c[0].n,c[0]&&c[0].f,(c.inst||[]).length]})()");
  (kept[0] === 2 && kept[1] === 1 && kept[2] === 1) ? pass('collection saved to the account', JSON.stringify(kept))
    : fail('collection saved to the account', JSON.stringify(kept));

  // ...and another account gets its own, empty binder
  const sep = await pg.evaluate(`(()=>{const mine=P().user;
    const a={user:'other',name:'other',pass:hashPw('other','pw123'),bal:1000,color:'#fff'};ensureCos(a);ensureStats(a);
    S.players.push(a);S.cur=S.players.length-1;tcgReload();
    const col=StackCards.collection,theirs=(col.inst||[]).length+Object.keys(col).filter(k=>/^[0-9]+$/.test(k)).length;
    S.cur=acctIdx(mine);tcgReload();
    return [theirs,(StackCards.collection.inst||[]).length]})()`);
  (sep[0] === 0 && sep[1] === 1) ? pass('each account has its own binder') : fail('each account has its own binder', JSON.stringify(sep));

  // grading: leaves the binder, comes back after the timer, notifies you elsewhere
  const g = await pg.evaluate(`(()=>{const X=StackCards._,i=X.col.inst.find(x=>x.st==='raw');
    const before=X.col[i.id].n;X.sendGrade(i);const gone=X.col[i.id].n===before-1&&i.st==='grading';
    return [gone,Math.round((i.due-Date.now())/1000),i.u]})()`);
  (g[0] && g[1] >= 58 && g[1] <= 60) ? pass('grading takes the card for a minute', g[1] + 's') : fail('grading takes the card for a minute', JSON.stringify(g));

  await pg.evaluate("go('dice')"); await pg.waitForTimeout(200);
  await pg.evaluate(`(()=>{const i=StackCards._.col.inst.find(x=>x.u==='${g[2]}');i.due=Date.now()-1;StackCards.tick()})()`);
  await pg.waitForTimeout(400);
  const back = await pg.evaluate(`(()=>{const i=StackCards._.col.inst.find(x=>x.u==='${g[2]}');
    return [i.st,i.grade,!!document.querySelector('[data-g="cards"] .nbadge'),[...document.querySelectorAll('.toast')].some(t=>/back from STK/.test(t.textContent))]})()`);
  (back[0] === 'back' && back[1] >= 1 && back[1] <= 10 && back[2] && back[3])
    ? pass('it comes back graded and pings you in another game', 'STK ' + back[1])
    : fail('it comes back graded and pings you in another game', JSON.stringify(back));

  // open the mailer -> it becomes a slab with the PSA-style label
  await pg.evaluate("go('cards')"); await pg.waitForTimeout(400);
  await pg.evaluate("StackCards.go('graded')"); await pg.waitForTimeout(400);
  await pg.click('#tcg [data-open]'); await pg.waitForTimeout(500);
  const box = await (await pg.$('#tcg #sz')).boundingBox();
  await pg.mouse.move(box.x + 4, box.y + box.height / 2); await pg.mouse.down();
  for (let k = 0; k < 3; k++) { await pg.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 6 }); await pg.mouse.move(box.x + 4, box.y + box.height / 2, { steps: 6 }); }
  await pg.mouse.up(); await pg.waitForTimeout(2800);
  const slab = await pg.evaluate(`(()=>{const i=StackCards._.col.inst.find(x=>x.u==='${g[2]}');
    const lab=StackCards.root.querySelector('#tcg .slabrise .sl-label');
    return [i.st,!!lab,lab?lab.querySelector('.sl-gn').textContent:'',lab?lab.querySelector('.sl-l4').textContent:'',/^STK [0-9]{8}$/.test(i.cert||'')]})()`);
  (slab[0] === 'slab' && slab[1] && slab[2] === String(back[1]) && /^#[0-9]{3}\/127$/.test(slab[3]) && slab[4])
    ? pass('mailer opens into a graded slab', 'grade ' + slab[2] + ', ' + slab[3]) : fail('mailer opens into a graded slab', JSON.stringify(slab));

  // PSA-like spread from pack-fresh copies: mostly 8-10, gems uncommon but real
  const dist = await pg.evaluate(`(()=>{const X=StackCards._;const h={};let gem=0,low=0;const N=4000;
    for(let k=0;k<N;k++){const i=X.newInst(0);const gr=X.stkGrade(i);h[gr]=(h[gr]||0)+1;if(gr===10)gem++;if(gr<7)low++}
    return {gem:gem/N*100,low:low/N*100,nine:(h[9]||0)/N*100}})()`);
  (dist.gem > 5 && dist.gem < 40 && dist.nine > 15 && dist.low < 25)
    ? pass('grade spread looks like real pack-fresh pops', dist.gem.toFixed(0)+'% gem, '+dist.nine.toFixed(0)+'% 9, '+dist.low.toFixed(0)+'% under 7')
    : fail('grade spread looks like real pack-fresh pops', JSON.stringify(dist));

  // wear must scale with condition: a wrecked copy draws far more than a gem
  const wear = await pg.evaluate(`(()=>{const X=StackCards._;
    const a=X.newInst(0);a.cd={ctr:50,dir:1,co:9.9,ed:9.9,su:9.9};const b=X.newInst(0);b.cd={ctr:75,dir:1,co:2.5,ed:2.5,su:2.5};
    const n=h=>(h.match(/<(circle|ellipse|path|rect)/g)||[]).length;return [n(X.wearHTML(a,0)),n(X.wearHTML(b,0))]})()`);
  (wear[1] > wear[0] * 4) ? pass('wear scales with condition', wear[0] + ' marks vs ' + wear[1]) : fail('wear scales with condition', JSON.stringify(wear));

  // OBSIDIAN: a black slot closes every line; complete the line and you can craft it
  const ob = await pg.evaluate(`(()=>{const X=StackCards._,c=X.col;
    const own=k=>X.lineOf(k).forEach(x=>{if(X.HI(x.t))c.inst.push(X.newInst(x.id));c[x.id]=c[x.id]||{n:0,f:0};c[x.id].n++});
    own('owl');X.lineOf('hare').slice(0,2).forEach(x=>{c[x.id]={n:1,f:0}});
    StackCards.go('binder');
    const r=StackCards.root,locks=r.querySelectorAll('.grid .obslock').length,ready=r.querySelectorAll('.grid .obslock.ready').length;
    const hareSlot=[...r.querySelectorAll('.grid .obslock em')].map(e=>e.textContent).find(t=>t.startsWith('2 /'));
    const shows=r.querySelector('.grid .obslock .tilt');           // the design must stay hidden
    const first=X.craft('owl'),again=X.craft('owl');
    const o=X.OBS.find(x=>x.line==='owl');
    return {locks,ready,hareSlot,hidden:!shows,first,again,have:c[o.id]&&c[o.id].n,gradeable:X.HI('obs'),num:X.numOf(o)}})()`);
  (ob.locks === 25 && ob.ready === 1 && ob.hareSlot === '2 / 5' && ob.hidden)
    ? pass('each line ends in a hidden Obsidian slot', 'hare shows ' + ob.hareSlot) : fail('each line ends in a hidden Obsidian slot', JSON.stringify(ob));
  (ob.first === true && ob.again === false && ob.have === 1)
    ? pass('a finished line crafts its Obsidian once', ob.num) : fail('a finished line crafts its Obsidian once', JSON.stringify(ob));
  !ob.gradeable ? pass('Obsidian is not part of grading') : fail('Obsidian is not part of grading');
  await pg.waitForTimeout(1800);
  await pg.evaluate("(()=>{const b=StackCards.root.querySelector('#rwOk');b&&b.click()})()");
  await pg.waitForTimeout(600);

  // its sky is knocked out so the animated backdrop shows behind the creature
  const sky = await pg.evaluate(`(()=>{const X=StackCards._,o=X.OBS[0],raw=X.artSrc(o.art),st=X.stripSky(raw);
    const n=h=>(h.match(/<rect width="200" height="280"/g)||[]).length;
    const el=StackCards.root.querySelector('.grid .obsown .ob1');
    return [n(raw),n(st),el?getComputedStyle(el).animationName:'']})()`);
  (sky[1] < sky[0] && sky[2] === 'obspin') ? pass('Obsidian sky is live and animated', sky[0] + ' -> ' + sky[1] + ' backdrop rects')
    : fail('Obsidian sky is live and animated', JSON.stringify(sky));

  // every binder card stays clickable - a card-less slot used to crash the wiring
  const clickable = await pg.evaluate(`(()=>{StackCards.go('binder');const m=[...StackCards.root.querySelectorAll('.grid .mini:not(.miss)')];
    return [m.length, m.filter(x=>typeof x.onclick==='function').length]})()`);
  (clickable[0] > 0 && clickable[0] === clickable[1]) ? pass('every owned card is clickable', clickable[1] + ' tiles')
    : fail('every owned card is clickable', JSON.stringify(clickable));

  // graded filters: a row of chips per filter, slabs grouped into labelled rows
  const gf = await pg.evaluate(`(()=>{const X=StackCards._,SET=StackCards.SET,c=X.col;
    const hi=SET.filter(x=>X.HI(x.t));[10,10,9,8.5,7].forEach((g,k)=>{const i=X.newInst(hi[k*5].id);i.st='slab';i.grade=g;i.cert='STK 2000000'+k;c.inst.push(i)});
    X.GF.rar='all';X.GF.gr='all';X.GF.by='grade';StackCards.go('graded');
    const r=StackCards.root,chipRows=r.querySelectorAll('.gfbar .gfg').length,rows=[...r.querySelectorAll('.grow h5')].map(h=>h.firstChild.textContent.trim());
    X.GF.gr='10';StackCards.go('graded');const tens=r.querySelectorAll('.grow .smini').length;
    X.GF.gr='all';X.GF.by='rarity';StackCards.go('graded');const rrows=r.querySelectorAll('.grow').length;
    X.GF.by='grade';return {chipRows,rows,tens,rrows,obsChip:!!r.querySelector('[data-gf="rar:obs"]')}})()`);
  (gf.chipRows === 3 && gf.rows[0] && gf.rows[0].startsWith('GEM MT') && gf.tens >= 2 && gf.rrows >= 1 && !gf.obsChip)
    ? pass('graded filters sort slabs into rows', gf.rows.join(' / ')) : fail('graded filters sort slabs into rows', JSON.stringify(gf));

  // generic creatures are centred: derived placement, not hand-typed offsets
  const ctr = await pg.evaluate(`(()=>{const X=StackCards._;
    return ['golemFA','knightSIR','slimeFA','koiFA'].map(k=>{const m=X.artSrc(k).match(/<g transform="translate\\(([-0-9.]+) [-0-9.]+\\) scale\\(([0-9.]+)\\)">/);return m?[k,+m[1],+m[2]]:[k,null]})})()`);
  // centre of a biped/blob is 60 local units, a fish 62.86: x + c*s must be ~100
  const cOf = k => /koi/.test(k) ? 62.857 : 60;
  const off = ctr.map(([k, x, sc]) => x == null ? 999 : Math.abs(x + cOf(k) * sc - 100));
  Math.max(...off) < 0.2 ? pass('generic creatures are centred', ctr.map(r => r[0] + '@' + r[1]).join(' '))
    : fail('generic creatures are centred', JSON.stringify(ctr));

  // zoomed binder card: a real mouse drag must spin the ZOOMED card, not the binder tile under it
  await pg.evaluate(`(()=>{const c=StackCards._.col;for(let i=1;i<40;i++)c[i]=c[i]||{n:1,f:0};StackCards.go('binder')})()`);
  const zr = await pg.evaluate(`(()=>{const m=StackCards.root.querySelector('.mini[data-id="30"]');m.scrollIntoView({block:'center'});const q=m.getBoundingClientRect();return [q.x+q.width/2,q.y+q.height/2]})()`);
  await pg.mouse.move(zr[0], zr[1]); await pg.waitForTimeout(150); await pg.mouse.click(zr[0], zr[1]); await pg.waitForTimeout(500);
  const zc = await pg.evaluate(`(()=>{const q=StackCards.root.querySelector('.zoom .tilt').getBoundingClientRect();return [q.x+q.width/2,q.y+q.height/2]})()`);
  await pg.mouse.move(zc[0], zc[1]); await pg.mouse.down();
  for (let i = 0; i < 15; i++) { await pg.mouse.move(zc[0] + i * 12, zc[1]); await pg.waitForTimeout(30); }
  const zl = await pg.evaluate(`(()=>{const R=StackCards.root;return {live:[...R.querySelectorAll('.live')].map(e=>e.closest('.zoom')?'zoom':'binder'),tf:R.querySelector('.zoom .tilt').style.transform}})()`);
  await pg.mouse.up();
  (zl.live.join() === 'zoom' && /rotate/.test(zl.tf)) ? pass('dragging a zoomed binder card spins it') : fail('dragging a zoomed binder card spins it', JSON.stringify(zl));
  // a grade coming back while zoomed must not rebuild the view under you
  await pg.evaluate(`(()=>{const X=StackCards._,i=X.newInst(X.OBS?StackCards.SET.find(x=>X.HI(x.t)).id:1);i.st='grading';i.due=Date.now()-1;X.col.inst.push(i);StackCards.tick();StackCards.root.querySelectorAll('.grid .mini').forEach(m=>m.onpointerenter&&m.onpointerenter())})()`);
  const still = await pg.evaluate(`(()=>{const R=StackCards.root;return !!R.querySelector('.zoom .tilt.live')})()`);
  still ? pass('zoom keeps the engine (grading, binder hover)') : fail('zoom keeps the engine (grading, binder hover)');
  await pg.evaluate("(()=>{const z=StackCards.root.querySelector('.zoom');z&&z.click()})()"); await pg.waitForTimeout(300);

  // SIGNED & ERROR cards: individual copies, shown in their own binder row, gradeable at Full Art+
  const vr = await pg.evaluate(`(()=>{const X=StackCards._,S=StackCards.SET,c=X.col;
    const com=S.find(x=>x.t==='c'),fa=S.filter(x=>x.t==='fa')[3];
    const n0=(c[com.id]||{n:0}).n,f0=(c[fa.id]||{n:0}).n;
    X.addCard({c:com,foil:false,v:'sig',ins:X.newInst(com.id)});X.addCard({c:fa,foil:false,v:'miscut',ins:X.newInst(fa.id)});
    const sig=c.inst.find(i=>i.id===com.id&&i.v==='sig'),err=c.inst.find(i=>i.id===fa.id&&i.v==='miscut');
    StackCards.go('binder');const R=StackCards.root,row=R.querySelector('.vrow');
    const shown=row?[...row.querySelectorAll('.mini')].map(m=>m.dataset.u):[];
    const sigFront=!!(row&&row.querySelector('.mini[data-u="'+sig.u+'"] .front.v-sig .vsig svg path'));
    const errFront=!!(row&&row.querySelector('.mini[data-u="'+err.u+'"] .front.v-miscut .mcut'));
    const odds=Object.keys(X.VAR).length;
    return {comCount:(c[com.id]||{n:0}).n-n0,faCount:c[fa.id].n-f0,shown:shown.includes(sig.u)&&shown.includes(err.u),sigFront,errFront,odds,
      owns:StackCards.root&&true,sigU:sig.u,errU:err.u}})()`);
  (vr.comCount === 0 && vr.faCount === 1 && vr.shown && vr.sigFront && vr.errFront)
    ? pass('signed and error copies render in their own binder row') : fail('signed and error copies render in their own binder row', JSON.stringify(vr));
  const vg = await pg.evaluate(`(()=>{const X=StackCards._,c=X.col,i=c.inst.find(x=>x.u==='${vr.errU}');
    i.st='slab';i.grade=9;i.cert='STK 30000001';StackCards.go('graded');
    const lab=[...StackCards.root.querySelectorAll('.sl-l3')].map(e=>e.textContent).find(t=>t.includes('MISCUT'));
    i.st='raw';delete i.grade;delete i.cert;return lab||''})()`);
  vg.includes('ERROR') ? pass('graded error card says so on the slab', vg.trim()) : fail('graded error card says so on the slab', vg);
  // a signed common trades as its own copy without touching the plain stack
  const vt = await pg.evaluate(`(()=>{const X=StackCards._,c=X.col,i=c.inst.find(x=>x.u==='${vr.sigU}'),n=c[i.id].n;
    const inSnap=X.snapshot().inst.some(x=>x.u===i.u),out=X.takeItems([{k:'i',u:i.u}]),n1=c[i.id].n;X.giveItems(out);
    return {inSnap,n,n1,n2:c[i.id].n,back:!!c.inst.find(x=>x.u===i.u)}})()`);
  (vt.inSnap && vt.n === vt.n1 && vt.n === vt.n2 && vt.back) ? pass('signed common trades as its own copy', 'plain stack untouched') : fail('signed common trades as its own copy', JSON.stringify(vt));

  // DIAMOND EDITION: Infernax Mono Rare only, blue stones on the edges, named on the slab
  const dm = await pg.evaluate(`(()=>{const X=StackCards._,S=StackCards.SET,inf=S[X.DIA_ID];let other=0,hit=0;
    for(let k=0;k<4000;k++){S.forEach(c=>{if(c.id!==X.DIA_ID&&X.rollVar(c)==='dia')other++});if(X.rollVar(inf)==='dia')hit++}
    const i=X.newInst(inf.id);X.addCard({c:inf,foil:false,v:'dia',ins:i});StackCards.go('binder');
    const el=StackCards.root.querySelector('.vrow .mini[data-u="'+i.u+'"]');
    const stones=el?el.querySelectorAll('.front.v-dia .dstones ellipse').length:0,glints=el?el.querySelectorAll('.dstones .dg').length:0;
    i.st='slab';i.grade=9;i.cert='STK 40000001';StackCards.go('graded');
    const lab=[...StackCards.root.querySelectorAll('.sl-l3')].map(e=>e.textContent).find(t=>t.includes('DIAMOND'))||'';
    return {name:inf.name,t:inf.t,other,rate:hit/4000,stones,glints,lab}})()`);
  (dm.name === 'Infernax' && dm.t === 'bwr' && dm.other === 0 && dm.rate > 0.06 && dm.rate < 0.14)
    ? pass('diamond only rolls on the Infernax Mono Rare', 'rate ' + dm.rate.toFixed(3)) : fail('diamond only rolls on the Infernax Mono Rare', JSON.stringify(dm));
  (dm.stones > 100 && dm.glints > 10 && dm.lab.includes('DIAMOND'))
    ? pass('diamond edges render and grade', dm.stones + ' stones, ' + dm.glints + ' glints') : fail('diamond edges render and grade', JSON.stringify(dm));

  // TRADE UP: 10 spares in, 1 of the next rarity out, never your last copy or a special
  const tu = await pg.evaluate(`(()=>{const X=StackCards._,S=StackCards.SET,c=X.col;
    S.filter(x=>x.t==='c').slice(0,6).forEach(x=>{c[x.id]={n:3,f:0}});
    const owned0=S.filter(x=>x.t==='c'&&c[x.id]&&(c[x.id].n||c[x.id].f)).length;
    const spare0=X.spareStacks('c').reduce((a,t)=>a+t.max,0);
    X.TU.t='c';X.TU.sel=[];X.tuAuto(X.spareStacks('c'));const picked=X.TU.sel.length;
    const specials0=c.inst.filter(X.isVar).length,tu0=c.tu||0;
    const out=X.tuSign();
    const owned1=S.filter(x=>x.t==='c'&&c[x.id]&&(c[x.id].n||c[x.id].f)).length;
    const spare1=X.spareStacks('c').reduce((a,t)=>a+t.max,0)+(out&&out.c.t==='c'?1:0);
    // not enough spares: refuses
    S.filter(x=>x.t==='fa').forEach(x=>{c.inst=c.inst.filter(i=>!(i.id===x.id&&i.st==='raw'&&!X.isVar(i)))});
    X.TU.t='fa';X.TU.sel=[];X.tuAuto(X.spareStacks('fa'));const short=X.TU.sel.length,refused=X.tuSign()===null;
    document.querySelectorAll('.rwov').forEach(e=>e.remove());(StackCards.root.querySelector('.rwov')||{remove(){}}).remove();
    return {picked,tier:out&&out.c.t,spare:[spare0,spare1],owned:[owned0,owned1],specials:[specials0,c.inst.filter(X.isVar).length-(out&&out.v&&!X.HI(out.c.t)?1:0)],tu:(c.tu||0)-tu0,short,refused}})()`);
  (tu.picked === 10 && tu.tier === 'h' && tu.spare[0] - tu.spare[1] === 10 && tu.owned[0] === tu.owned[1] && tu.specials[0] === tu.specials[1] && tu.tu === 1)
    ? pass('trade up turns 10 spare commons into a holo', 'last copies and specials untouched') : fail('trade up turns 10 spare commons into a holo', JSON.stringify(tu));
  (tu.short < 10 && tu.refused) ? pass('trade up refuses without 10 spares') : fail('trade up refuses without 10 spares', JSON.stringify(tu));
  await pg.evaluate("StackCards.go('tradeup')"); await pg.waitForTimeout(300);
  const tuv = await pg.evaluate("(()=>{const R=StackCards.root;return [R.querySelectorAll('.tuslot').length,R.querySelectorAll('[data-tu]').length,!!R.querySelector('#tuGo')]})()");
  (tuv[0] === 11 && tuv[1] === 4 && tuv[2]) ? pass('trade up tab renders') : fail('trade up tab renders', JSON.stringify(tuv));

  // STORE + BOOSTER BOX: buy -> desk -> cut the wrap -> push the tab -> 36 packs -> open one
  await pg.evaluate("StackCards.go('store')"); await pg.waitForTimeout(400);
  const sf = await pg.evaluate("(()=>{const R=StackCards.root;return [!!R.querySelector('.st-feature .bx3 .wr'),!!R.querySelector('#stBuy'),R.querySelectorAll('.st-fe .front.fe').length]})()");
  (sf[0] && sf[1] && sf[2] === 3) ? pass('store front shows a sealed box and the shelves') : fail('store front shows a sealed box and the shelves', JSON.stringify(sf));
  await pg.evaluate("StackCards.root.querySelector('#stBuy').click()"); await pg.waitForTimeout(600);
  // wait for the box to finish dropping onto the desk before measuring the cut line
  await pg.waitForFunction("(()=>{const b=StackCards.root&&StackCards.root.querySelector('#bx');return !!b&&b.getAnimations().every(a=>a.playState==='finished')})()", null, { timeout: 5000 });
  const cr = await pg.evaluate("(()=>{const r=StackCards.root.querySelector('#wrCut').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()");
  await pg.mouse.move(cr[0] - 6, cr[1] + cr[3] / 2); await pg.mouse.down();
  for (let i = 0; i <= 30; i++) { await pg.mouse.move(cr[0] + cr[2] * i / 30, cr[1] + cr[3] / 2); await pg.waitForTimeout(12); }
  await pg.mouse.up(); await pg.waitForTimeout(1900);
  const bx1 = await pg.evaluate("(()=>{const X=StackCards._;return [X.DESK.phase,X.boxBy(X.DESK.u).st,!!StackCards.root.querySelector('.bxwrap')]})()");
  (bx1[0] === 'boxed' && bx1[1] === 'boxed' && !bx1[2]) ? pass('box cutter slices the wrap off') : fail('box cutter slices the wrap off', JSON.stringify(bx1));
  const tb = await pg.evaluate("(()=>{const r=StackCards.root.querySelector('#bxTab').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()");
  await pg.mouse.click(tb[0], tb[1]); await pg.waitForTimeout(1900);
  const bx2 = await pg.evaluate("(()=>{const X=StackCards._,R=StackCards.root;return [X.DESK.phase,X.boxBy(X.DESK.u).st,R.querySelectorAll('#bx .bpk').length,getComputedStyle(R.querySelector('#bx')).getPropertyValue('--lid').trim()]})()");
  (bx2[0] === 'open' && bx2[1] === 'open' && bx2[2] === 36 && bx2[3] === '104deg') ? pass('tab opens the lid onto 36 packs') : fail('tab opens the lid onto 36 packs', JSON.stringify(bx2));
  await pg.evaluate("(()=>{const X=StackCards._;X.boxPackOpen(0)})()"); await pg.waitForTimeout(900);
  const tear = await pg.evaluate("(()=>{const R=StackCards.root,X=StackCards._;return [!!R.querySelector('#pk'),!!R.querySelector('#toBox'),!R.querySelector('#buy'),X.boxLeft(X.boxBy(X.BOXCTX.u))]})()");
  (tear[0] && tear[1] && tear[2] && tear[3] === 36) ? pass('picked pack goes to the tear screen, still in the box until torn') : fail('picked pack goes to the tear screen, still in the box until torn', JSON.stringify(tear));
  await pg.evaluate("(()=>{const p=StackCards.root.querySelector('#pk');p.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))})()"); await pg.waitForTimeout(700);
  const aft = await pg.evaluate("(()=>{const X=StackCards._,b=X.col.boxes[X.col.boxes.length-1];return [X.boxLeft(b),b.packs[0]]})()");
  (aft[0] === 35 && aft[1] === 0) ? pass('tearing it takes that pack out of the box', '35 left') : fail('tearing it takes that pack out of the box', JSON.stringify(aft));
  await pg.evaluate("StackCards.go('store')"); await pg.waitForTimeout(300);

  errs.length === n0 ? pass('no stack cards console errors') : fail('no stack cards console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- stack cards: trading ---------------- */
async function cardtrade(browser, errs) {
  console.log('\nSTACK CARDS TRADING');
  const [A, B] = await connectPair(browser, errs);
  if (await A.evaluate("NET.status") !== 'connected') { fail('trade: no connection'); await A.close(); await B.close(); return; }
  const seed = `(()=>{const X=StackCards._,SET=StackCards.SET,c=X.col;
    c[SET[1].id]={n:3,f:0};const sir=SET.find(x=>x.t==='sir');const i=X.newInst(sir.id);c.inst.push(i);(c[sir.id]||(c[sir.id]={n:0,f:0})).n++;
    window.StackBridge.save(c);return i.u})()`;
  await A.evaluate("go('cards')"); await B.evaluate("go('cards')"); await A.waitForTimeout(700);
  const aU = await A.evaluate(seed);
  const bU = await B.evaluate(seed);

  await A.evaluate("StackCards.go('trade')"); await A.waitForTimeout(900);
  const sees = await A.evaluate(`!!StackCards.root.querySelector('#tcg .ttile[data-k="i:${bU}"]')`);
  sees ? pass("you can see your mate's binder") : fail("you can see your mate's binder");

  await A.evaluate(`StackCards.root.querySelector('#tcg .ttile[data-side="give"][data-k="i:${aU}"]').click()`);
  await A.waitForTimeout(150);
  await A.evaluate(`StackCards.root.querySelector('#tcg .ttile[data-side="want"][data-k="i:${bU}"]').click()`);
  await A.waitForTimeout(150);
  await A.click('#tcg #tSend'); await A.waitForTimeout(700);
  const esc = await A.evaluate(`[!StackCards._.col.inst.some(i=>i.u==='${aU}'), Object.keys(StackCards._.col.escrow||{}).length]`);
  (esc[0] && esc[1] === 1) ? pass('your side is held in escrow while they decide') : fail('your side is held in escrow while they decide', JSON.stringify(esc));

  const offered = await B.evaluate("!!StackCards.root.querySelector('#tcg .tofr')");
  offered ? pass('they get the offer') : fail('they get the offer');
  await B.click('#tcg #tAcc'); await B.waitForTimeout(900);

  const aHas = await A.evaluate(`[StackCards._.col.inst.some(i=>i.u==='${bU}'), StackCards._.col.inst.some(i=>i.u==='${aU}'), Object.keys(StackCards._.col.escrow||{}).length]`);
  const bHas = await B.evaluate(`[StackCards._.col.inst.some(i=>i.u==='${aU}'), StackCards._.col.inst.some(i=>i.u==='${bU}')]`);
  (aHas[0] && !aHas[1] && aHas[2] === 0 && bHas[0] && !bHas[1])
    ? pass('accepted trade swaps the exact copies', 'condition travels with the card')
    : fail('accepted trade swaps the exact copies', JSON.stringify({aHas, bHas}));

  await A.evaluate("StackCards.go('trade')"); await A.waitForTimeout(800);
  const cid = await A.evaluate("StackCards.SET[1].id");
  const before = await A.evaluate(`StackCards._.col[${cid}].n`);
  await A.evaluate(`StackCards.root.querySelector('#tcg .ttile[data-side="give"][data-k="r:${cid}:0"]').click()`);
  await A.waitForTimeout(150); await A.click('#tcg #tSend'); await A.waitForTimeout(700);
  const during = await A.evaluate(`StackCards._.col[${cid}].n`);
  await B.click('#tcg #tDec'); await B.waitForTimeout(800);
  const after = await A.evaluate(`StackCards._.col[${cid}].n`);
  (during === before - 1 && after === before) ? pass('declined offer returns your cards', before + ' -> ' + during + ' -> ' + after)
    : fail('declined offer returns your cards', [before, during, after].join(' -> '));

  await A.close(); await B.close();
}

/* ---------------- sportsbook ---------------- */
async function sports(ctx, errs) {
  console.log('\nSPORTSBOOK');
  const pg = await newPage(ctx, errs, 'fb', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=1000000;renderBal();go('sports')");
  await pg.waitForTimeout(500);

  const card = await pg.evaluate("FB.card.length");
  card === 1 ? pass('one fixture at a time') : fail('one fixture at a time', 'got ' + card);

  // Every market on a fixture must be a complete, non-overlapping book: the true
  // probabilities have to sum to 1, or the odds are simply wrong.
  const books = await pg.evaluate(`(()=>{
    const m=FB.card[0], P=fbProbs(m,FB_MINS,0,0);
    const r=[
      ['1X2', P.home+P.draw+P.away],
      ['O/U', P.ov+P.un],
      ['BTTS', P.btts+P.nbtts],
      ['CS grid', Object.values(P.cs).reduce((a,b)=>a+b,0)]
    ];
    return r.map(([n,v])=>[n, Math.abs(v-1)]);
  })()`);
  const badBook = books.find(b => b[1] > 0.005);
  badBook ? fail('market books sum to 1', badBook[0] + ' off by ' + badBook[1].toFixed(4))
          : pass('market books sum to 1', books.map(b=>b[0]).join(', '));

  // The pricing model must match the GENERATOR exactly. Simulate thousands of
  // matches from the same engine the game uses and compare realised frequency
  // with the priced probability - a Poisson approximation would drift here.
  const model = await pg.evaluate(`(()=>{
    const m=FB.card[0], P=fbProbs(m,FB_MINS,0,0);
    const N=20000; let h=0,d=0,a=0,ov=0,bt=0;
    for(let i=0;i<N;i++){
      const mm={h:m.h,a:m.a,lam:m.lam,seed:(i*2654435761)>>>0};
      fbSim(mm);
      const [H,A]=mm.ft;
      if(H>A)h++;else if(H===A)d++;else a++;
      if(H+A>=3)ov++;
      if(H>0&&A>0)bt++;
    }
    return [[P.home,h/N],[P.draw,d/N],[P.away,a/N],[P.ov,ov/N],[P.btts,bt/N]];
  })()`);
  const worst = model.reduce((w,[pp,ff]) => Math.max(w, Math.abs(pp-ff)), 0);
  worst < 0.015 ? pass('priced odds match the simulator', 'max gap ' + (worst*100).toFixed(2) + 'pp')
                : fail('priced odds match the simulator', 'max gap ' + (worst*100).toFixed(2) + 'pp');

  // single bets must return exactly 97%
  const single = await pg.evaluate(`(()=>{
    const m=FB.card[0], P=fbProbs(m,FB_MINS,0,0);
    return ['home','draw','away','ov','un','btts','nbtts']
      .map(k=>P[k]*fbOdds(P[k])*100);
  })()`);
  const sBad = single.find(v => Math.abs(v-97) > 0.01);
  sBad === undefined ? pass('every single returns 97%') : fail('every single returns 97%', String(sBad));

  // accumulators must ALSO return 97% - the edge is applied once, not per leg.
  // Compounding would give 0.97^n (a 5-fold would be 86%) and breach the rule.
  const acca = await pg.evaluate(`(()=>{
    const m=FB.card[0], sets=[['home','ov'],['home','btts'],['home','ov','btts'],['away','un','nbtts']];
    return sets.map(ks=>{ const p=fbJointP(m,ks,FB_MINS,0,0); return p>0?p*fbOdds(p)*100:97; });
  })()`);
  const aBad = acca.find(v => Math.abs(v-97) > 0.01);
  aBad === undefined ? pass('accumulators return 97%', '2 and 3-leg combinations')
                     : fail('accumulators return 97%', String(aBad));

  // Legs within one match are CORRELATED, so multiplying their individual
  // probabilities misprices the ticket. The joint probability must match what
  // the simulator actually produces, and must differ from the naive product.
  const joint = await pg.evaluate(`(()=>{
    const m=FB.card[0];
    const P=fbProbs(m,FB_MINS,0,0);
    const jt=fbJointP(m,['home','ov'],FB_MINS,0,0);
    const naive=P.home*P.ov;
    const N=20000; let both=0;
    for(let i=0;i<N;i++){
      const mm={h:m.h,a:m.a,lam:m.lam,seed:(i*2246822519)>>>0}; fbSim(mm);
      const [H,A]=mm.ft;
      if(H>A && H+A>=3) both++;
    }
    return [jt, naive, both/N];
  })()`);
  const jtErr = Math.abs(joint[0]-joint[2]), naiveErr = Math.abs(joint[1]-joint[2]);
  (jtErr < 0.015 && naiveErr > jtErr)
    ? pass('correlated legs priced jointly, not multiplied',
           'joint off by ' + (jtErr*100).toFixed(2) + 'pp, naive product off by ' + (naiveErr*100).toFixed(2) + 'pp')
    : fail('correlated legs priced jointly', JSON.stringify(joint));

  // cash out must be value-neutral: E[cash value] == E[holding]
  const co = await pg.evaluate(`(()=>{
    const m=FB.card[0];
    const P0=fbProbs(m,FB_MINS,0,0), price=fbOdds(P0.home), stake=100;
    // average the fair cash value at minute 45 across many simulated first halves
    const N=6000; let sum=0;
    for(let i=0;i<N;i++){
      const mm={h:m.h,a:m.a,lam:m.lam,seed:(i*40503+7)>>>0}; fbSim(mm);
      let ch=0,ca=0;
      for(const e of mm.events) if(e.type==='goal'&&e.t<=45){ch=e.ch;ca=e.ca;}
      const Pn=fbProbs(m,45,ch,ca);
      sum += stake*price*Pn.home;
    }
    return [sum/N, stake*price*P0.home];
  })()`);
  Math.abs(co[0]-co[1]) / co[1] < 0.03
    ? pass('cash out is value-neutral', co[0].toFixed(2) + ' vs hold ' + co[1].toFixed(2))
    : fail('cash out is value-neutral', co[0].toFixed(2) + ' vs ' + co[1].toFixed(2));

  // placing a bet takes the stake; settlement pays the right amount
  const flow = await pg.evaluate(`(()=>{
    FB.sel=[];FB.mode='single';FB.open=[];
    const m=FB.card[0];const {p,o}=fbPriceOf(m,'home');
    FB.sel.push({mi:0,key:'home',p,o,label:'x',match:'y',min:0});
    fbSlipRender();$('fbStake').value='100';
    const before=P().bal; fbPlace();
    const took=Math.round((before-P().bal)*100)/100;
    // force the match to a home win and settle
    const mm=FB.card[0]; mm.phase='done'; mm.ch=3; mm.ca=0;
    const b4=P().bal; fbSettle();
    const paid=Math.round((P().bal-b4)*100)/100;
    return [took, paid, Math.round(100*o*100)/100];
  })()`);
  (flow[0] === 100 && Math.abs(flow[1]-flow[2]) < 0.02)
    ? pass('stake taken and winner paid', flow[0] + ' in, ' + flow[1] + ' out')
    : fail('stake taken and winner paid', JSON.stringify(flow));

  // Cash-out buttons must show profit or loss against the stake, colour-coded.
  const cashUI = await pg.evaluate(`(()=>{
    const m=FB.card[0];
    FB.open=[];
    // price the bets at kick-off, THEN run the match on - otherwise they are
    // priced against a finished scoreline and one of them is worth nothing
    m.phase='live';m.min=0;m.ch=0;m.ca=0;FB.live=0;
    const mk=(key,stake)=>{const {p,o}=fbPriceOf(m,key);
      FB.open.push({id:Math.random(),legs:[{mi:0,key,p,o,label:fbLabel(m,key),match:'x'}],
       stake,odds:o,acca:false,state:'open'})};
    mk('home',100); mk('un',100);
    m.min=62;m.ch=2;m.ca=0;      // 2-0 up: home is winning, under 2.5 is losing
    fbRender();
    return [...document.querySelectorAll('#fbOpen button[data-co]')].map(x=>{
      const i=x.querySelector('i');
      return [x.className, i?i.textContent[0]:'?'];
    });
  })()`);
  const up = cashUI.find(c => c[0] === 'up'), dn = cashUI.find(c => c[0] === 'down');
  (up && up[1] === '+' && dn && dn[1] === 'âˆ’')
    ? pass('cash out shows coloured +/- against stake', 'up and down both rendered')
    : fail('cash out shows coloured +/- against stake', JSON.stringify(cashUI));
  await pg.evaluate("FB.open=[];FB.card[0].phase='pre';FB.card[0].min=0;FB.card[0].ch=0;FB.card[0].ca=0;FB.live=-1;fbRender()");

  // Bets must not pile up across matches: the next fixture starts with a clean
  // slate, and anything somehow still open is refunded rather than dropped.
  const cleared = await pg.evaluate(`(()=>{
    FB.open=[];FB.profit=0;
    const m=FB.card[0];
    m.phase='live';m.min=0;m.ch=0;m.ca=0;FB.live=0;
    const {p,o}=fbPriceOf(m,'home');
    FB.open.push({id:1,legs:[{mi:0,key:'home',p,o,label:'x',match:'y'}],stake:50,odds:o,acca:false,state:'open'});
    FB.open.push({id:2,legs:[{mi:0,key:'away',p,o,label:'x',match:'y'}],stake:50,odds:o,acca:false,state:'lost',ret:0});
    const before=P().bal;
    m.phase='done';FB.live=-1;
    fbAdvance();
    return [FB.open.length, Math.round((P().bal-before)*100)/100, FB.card[0].phase];
  })()`);
  (cleared[0] === 0 && cleared[1] === 50 && cleared[2] === 'pre')
    ? pass('bets clear between matches', 'unsettled stake refunded')
    : fail('bets clear between matches', JSON.stringify(cleared));

  // A settled market prices below 1.00 (BTTS "yes" at 1-1 is already certain, so
  // 0.97/1 = 0.97). Offering that is a guaranteed loss, so every ENABLED price
  // must clear 1.00 - checked across a whole match, minute by minute.
  const suspended = await pg.evaluate(`(()=>{
    let worst=99, offered=0;
    const m=FB.card[0]; fbSim(m);
    for(let t=0;t<=FB_MINS;t+=5){
      let ch=0,ca=0;
      for(const e of m.events) if(e.type==='goal'&&e.t<=t){ch=e.ch;ca=e.ca;}
      const P=fbProbs(m,FB_MINS-t,ch,ca);
      for(const k of ['home','draw','away','ov','un','btts','nbtts']){
        const o=fbOdds(P[k]);
        if(P[k]>0 && fbLive(o)){ offered++; worst=Math.min(worst,o); } }
      for(const k in P.cs){ const o=fbOdds(P.cs[k]);
        if(P.cs[k]>0 && fbLive(o)){ offered++; worst=Math.min(worst,o); } }
    }
    return [worst, offered];
  })()`);
  (suspended[0] > 1.0 && suspended[1] > 50)
    ? pass('settled markets are suspended', 'lowest live price ' + suspended[0].toFixed(3) + ' across ' + suspended[1] + ' quotes')
    : fail('settled markets are suspended', JSON.stringify(suspended));

  // Layout: the stage must never spill over the control column, and nothing in
  // the slip may overflow its 300px panel. A bare `1fr` track and flex centring
  // once pushed the fixture list straight over the bet slip.
  for (const w of [920, 1000, 1100, 1280, 1440, 1600, 1920]) {
    await pg.setViewportSize({ width: w, height: 860 });
    await pg.waitForTimeout(250);
    const g = await pg.evaluate(`(()=>{
      const c=document.querySelector('#sportsView .ctrl').getBoundingClientRect();
      const s=document.querySelector('#sportsView .stage').getBoundingClientRect();
      const sh=document.querySelector('#sportsView .shell').getBoundingClientRect();
      const ctrl=document.querySelector('#sportsView .ctrl');
      const cs=getComputedStyle(ctrl);
      const inner=ctrl.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
      let over=0;
      ctrl.querySelectorAll('*').forEach(el=>{ if(el.getBoundingClientRect().width>inner+1) over++; });
      return [+(c.right-s.left).toFixed(1), +(s.right-sh.right).toFixed(1), over];
    })()`);
    (g[0] <= 0.5 && g[1] <= 0.5 && g[2] === 0)
      ? pass('layout clean at ' + w + 'px')
      : fail('layout clean at ' + w + 'px', 'overlap ' + g[0] + ', spill ' + g[1] + ', ' + g[2] + ' overflowing');
  }
  await pg.setViewportSize({ width: 1320, height: 980 });

  // the guide must actually open
  await pg.evaluate("go('sports')"); await pg.waitForTimeout(200);
  await pg.click('#fbGuideBtn'); await pg.waitForTimeout(300);
  const guideOpen = await pg.evaluate("!!document.querySelector('#fbGuide.show') && $('fbGuide').textContent.includes('Multiply your stake')");
  guideOpen ? pass('betting guide opens') : fail('betting guide opens');
  await pg.click('#fbGuideClose'); await pg.waitForTimeout(200);
  const guideShut = await pg.evaluate("!document.querySelector('#fbGuide.show')");
  guideShut ? pass('betting guide closes') : fail('betting guide closes');

  errs.length === n0 ? pass('no sportsbook console errors') : fail('no sportsbook console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- long shot ---------------- */
async function longshot(ctx, errs) {
  console.log('\nLONG SHOT');
  const pg = await newPage(ctx, errs, 'ls', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=100000;renderBal();go('shot')");
  await pg.waitForTimeout(500);

  const box = await pg.evaluate("(()=>{const r=$('lsCv').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()");

  // Drag from the cannon up and to the right - the natural gesture. This used to
  // produce a zero-power flat shot that landed at the cannon's feet.
  await pg.evaluate("$('lsBet').value='10';lsStart()");
  await pg.waitForTimeout(250);
  const cannon = await pg.evaluate("(()=>{const r=$('lsCv').getBoundingClientRect();return{x:r.x+lsX(LS_CX)/(SHOT.cv.width/r.width), y:r.y+lsY(LS_CY)/(SHOT.cv.height/r.height)}})()");
  await pg.mouse.move(cannon.x, cannon.y);
  await pg.mouse.down();
  await pg.mouse.move(cannon.x + box.w * 0.45, cannon.y - box.h * 0.42, { steps: 8 });
  const aim = await pg.evaluate("SHOT.aim?{vx:SHOT.aim.vx,vy:SHOT.aim.vy,sp:SHOT.aim.sp}:null");
  (aim && aim.vy > 200 && aim.sp > 300) ? pass('drag up-right builds a real shot', 'vy=' + Math.round(aim.vy) + ' sp=' + Math.round(aim.sp))
    : fail('drag up-right builds a real shot', JSON.stringify(aim));

  await pg.mouse.up();
  await pg.waitForTimeout(150);
  const flew = await pg.evaluate("SHOT.phase==='fly'||SHOT.phase==='done'");
  flew ? pass('release fires') : fail('release fires', await pg.evaluate("SHOT.phase"));

  // it must actually travel, not drop at the cannon
  await pg.waitForTimeout(2200);
  const land = await pg.evaluate("SHOT.land");
  // cannon sits at x=74; the old bug landed it there every time
  land > 250 ? pass('ball travels downrange', 'landed at ' + Math.round(land))
             : fail('ball travels downrange', 'landed at ' + Math.round(land) + ' (cannon is at 74)');

  // a tap must NOT fire a dud and eat the stake
  await pg.waitForTimeout(1600);
  await pg.evaluate("SHOT.phase='idle';SHOT.shot=null;$('lsBet').value='10';lsStart()");
  await pg.waitForTimeout(200);
  const balBefore = await pg.evaluate("P().bal");
  // a genuine click: press and release at the same point, no movement
  await pg.mouse.move(cannon.x + box.w * 0.3, cannon.y - box.h * 0.3);
  await pg.mouse.down();
  await pg.mouse.up();
  await pg.waitForTimeout(250);
  const tap = await pg.evaluate("[ 'aim', SHOT.phase, 0 ]");
  tap[2] = await pg.evaluate(`Math.round((${balBefore}-P().bal)*100)/100`);
  (tap[1] === 'aim' && tap[2] === 0) ? pass('a tap cancels instead of firing a dud')
                                     : fail('a tap cancels instead of firing a dud', JSON.stringify(tap));

  errs.length === n0 ? pass('no long shot console errors') : fail('no long shot console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- moles ---------------- */
async function moles(ctx, errs) {
  console.log('\nMOLES');
  const pg = await newPage(ctx, errs, 'moles', false);
  const n0 = errs.length;
  await pg.evaluate("P().bal=100000;renderBal();go('moles')");
  await pg.waitForTimeout(400);

  // board shape must match the real game
  const holes = await pg.evaluate("document.querySelectorAll('#moHoles .mohole').length");
  holes === 7 ? pass('7 holes') : fail('7 holes', 'got ' + holes);

  // default should be a setting that plays, not one that ends instantly
  const dflt = await pg.evaluate("(()=>{const b=$('moCount').querySelector('.on');return [MO.moles, +b.dataset.v]})()");
  (dflt[0] === 5 && dflt[1] === 5) ? pass('defaults to 5 moles', '71.4% per swing')
                                   : fail('defaults to 5 moles', JSON.stringify(dflt));

  // the headline number from the real game, exactly
  const max = await pg.evaluate("(()=>{MO.moles=1;return moMult(8)})()");
  Math.abs(max - 5649504.98) < 0.01 ? pass('max win matches Stake', max.toLocaleString())
                                    : fail('max win matches Stake', String(max));

  // the edge must be applied once, not compounded per step
  const once = await pg.evaluate("(()=>{MO.moles=3;const p=3/7;return Math.abs(moMult(4)-(0.98/Math.pow(p,4)))<0.02})()");
  once ? pass('edge applied once, not per step') : fail('edge applied once, not per step');

  // a forced win streak pays exactly bet x multiplier
  const paid = await pg.evaluate(`(()=>{
    MO.moles=3;MO.phase='idle';MO.busy=false;
    const before=P().bal;
    MO.bet=100;MO.hits=3;MO.mult=moMult(3);MO.phase='play';
    const expect=Math.round(MO.bet*MO.mult*100)/100;
    moCash(false);
    return [Math.round((P().bal-before)*100)/100, expect];
  })()`);
  paid[0] === paid[1] ? pass('cash out pays bet x multiplier', paid[0] + '')
                      : fail('cash out pays bet x multiplier', paid[0] + ' vs ' + paid[1]);

  // a miss must cost the stake and reset the round
  await pg.waitForTimeout(600);
  const bust = await pg.evaluate(`(()=>{
    MO.phase='idle';MO.busy=false;MO.hits=0;MO.mult=1;
    const before=P().bal;
    $('moBet').value='50';moStart();
    const staked=Math.round((before-P().bal)*100)/100;
    // force every hole empty, then whack one
    MO.set=new Set();
    const el=document.querySelector('.mohole[data-h="0"]');
    moWhack(0,el);
    return staked;
  })()`);
  bust === 50 ? pass('miss costs the stake') : fail('miss costs the stake', 'staked ' + bust);
  await pg.waitForTimeout(1400);
  const reset = await pg.evaluate("MO.phase==='idle' && MO.hits===0 && MO.mult===1");
  reset ? pass('round resets after a miss') : fail('round resets after a miss');

  // cash out must be impossible before a hit lands
  const guard = await pg.evaluate(`(()=>{
    MO.phase='idle';MO.busy=false;MO.hits=0;MO.mult=1;
    $('moBet').value='10';moStart();
    const before=P().bal;moCash(false);
    return Math.round((P().bal-before)*100)/100;
  })()`);
  guard === 0 ? pass('cannot cash out with zero hits') : fail('cannot cash out with zero hits', 'gained ' + guard);

  // The moles RESHUFFLE: hitting one does not remove it from the board. This is
  // required by the maths - a constant p is the only way 0.98/p^8 gives Stake's
  // published max win - and it is the thing players find counter-intuitive.
  const shuf = await pg.evaluate(`(()=>{
    MO.moles=3;MO.phase='idle';MO.busy=false;MO.hits=0;MO.mult=1;
    const sizes=[];
    for(let i=0;i<40;i++){ moDeal(); sizes.push(MO.set.size); }
    return [Math.min(...sizes), Math.max(...sizes)];
  })()`);
  (shuf[0] === 3 && shuf[1] === 3) ? pass('mole count constant every redeal', '3 every time')
                                   : fail('mole count constant every redeal', JSON.stringify(shuf));

  // and the redeal must actually move them, not re-place the same set
  const moved = await pg.evaluate(`(()=>{
    MO.moles=3;let diff=0;
    for(let i=0;i<60;i++){ moDeal(); const a=[...MO.set].sort().join(); moDeal();
      if([...MO.set].sort().join()!==a) diff++; }
    return diff;
  })()`);
  moved > 40 ? pass('redeal moves the moles', moved + '/60 layouts changed')
             : fail('redeal moves the moles', moved + '/60');

  // the new sound engine must not throw when driven hard
  const snd = await pg.evaluate(`(()=>{try{SND.init();
    ['click','tick','chip','card','thud','lose','taunt'].forEach(k=>SND[k]());
    SND.peg(3);SND.win(5);SND.big();SND.swing(.3);SND.pop(-.2);SND.whack(4,.1);
    SND.squeak(0);SND.dud(.5);SND.cash(12);SND.hover(0);
    SND.tone(440,.1);SND.noise(.05,.1,1200);
    for(let i=0;i<=10;i++)SND.reel(i/10);SND.reelStop();
    return 'ok'}catch(e){return String(e)}})()`);
  snd === 'ok' ? pass('sound engine runs clean') : fail('sound engine runs clean', snd);

  errs.length === n0 ? pass('no moles console errors') : fail('no moles console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- admin portal ---------------- */
async function admin(ctx, errs) {
  console.log('\nADMIN PORTAL');
  const pg = await newPage(ctx, errs, 'adm', false);
  const n0 = errs.length;

  // stats must actually accrue from play, not sit at zero
  await pg.evaluate("P().bal=5000;renderBal();go('dice')");
  await tap(pg, '#dcGo', 1500);
  const w = await pg.evaluate("P().wagered");
  w > 0 ? pass('wagering is recorded', w.toFixed(2)) : fail('wagering is recorded', 'wagered=' + w);

  const created = await pg.evaluate("P().created");
  created > 0 ? pass('account creation date set') : fail('account creation date set');

  // playtime ticker
  await pg.evaluate("playTick();playTick()");
  const pm = await pg.evaluate("P().playMs");
  pm >= 20000 ? pass('playtime accrues', (pm / 1000) + 's') : fail('playtime accrues', 'playMs=' + pm);

  // unlock without touching the prompt
  await pg.evaluate("ADM.on=true;buildNav();go('admin')");
  await pg.waitForTimeout(400);
  const listed = await pg.evaluate("!!document.querySelector('#admTable tr[data-u]')");
  listed ? pass('user table renders') : fail('user table renders');

  const statCount = await pg.evaluate("document.querySelectorAll('#admStats .admstat').length");
  statCount === 6 ? pass('headline stats render') : fail('headline stats render', 'got ' + statCount);

  // a second account, then admin actions against it
  await pg.evaluate(`(()=>{const a={user:'victim',name:'victim',pass:hashPw('victim','pw123'),bal:500,
    color:'#ffc800',created:Date.now()-86400000,lastSeen:Date.now(),playMs:60000,sessions:3,
    wagered:200,won:150,bets:9,big:20};ensureCos(a);ensureStats(a);S.players.push(a);save(true);admRender()})()`);
  await pg.waitForTimeout(250);

  const two = await pg.evaluate("document.querySelectorAll('#admTable tr[data-u]').length");
  two === 2 ? pass('second account listed') : fail('second account listed', 'rows=' + two);

  // select it and confirm the drawer opens with their real figures
  await pg.evaluate("ADM.sel='victim';admRender()");
  await pg.waitForTimeout(200);
  const drawer = await pg.evaluate("$('admDrawer').textContent");
  drawer.includes('victim') ? pass('detail drawer opens') : fail('detail drawer opens');

  // suspend -> that account must not be able to log back in
  await pg.evaluate("(()=>{const u=admUsers().find(x=>x.key==='victim');S.players[u.idx].suspended=true;S.players[u.idx].suspendMsg='nope';save(true)})()");
  await pg.evaluate("logout()");
  await pg.waitForSelector('#authGate.show', { timeout: 6000 });
  await pg.fill('#auU', 'victim'); await pg.fill('#auP', 'pw123');
  await pg.click('#auGo'); await pg.waitForTimeout(400);
  const blocked = await pg.evaluate("!loggedIn() && (AUTH.err||'').includes('nope')");
  blocked ? pass('suspended account cannot log in') : fail('suspended account cannot log in', await pg.evaluate("AUTH.err"));

  // unsuspend -> back in
  await pg.evaluate("(()=>{const i=acctIdx('victim');S.players[i].suspended=false;S.players[i].suspendMsg='';save(true)})()");
  await pg.fill('#auU', 'victim'); await pg.fill('#auP', 'pw123');
  await pg.click('#auGo');
  await pg.waitForFunction('loggedIn()', null, { timeout: 6000 }).catch(() => {});
  (await pg.evaluate("loggedIn() && P().user==='victim'")) ? pass('unsuspend restores access') : fail('unsuspend restores access');

  // audit trail records what was done
  await pg.evaluate("audit('test action','victim','detail')");
  const logged = await pg.evaluate("S.audit.length>0 && S.audit[S.audit.length-1].action==='test action'");
  logged ? pass('audit trail records actions') : fail('audit trail records actions');

  // admin state must not leak to a player who has not unlocked it
  const navHidden = await pg.evaluate("(()=>{ADM.on=false;buildNav();return !document.querySelector('[data-g=\"admin\"]')})()");
  navHidden ? pass('admin hidden when locked') : fail('admin hidden when locked');

  errs.length === n0 ? pass('no admin console errors') : fail('no admin console errors', errs.slice(n0).join(' | '));
  await pg.close();
}

/* ---------------- multiplayer ---------------- */
async function connectPair(browser, errs) {
  const vp = { viewport: { width: 1320, height: 980 } };
  const ctxA = await browser.newContext(vp), ctxB = await browser.newContext(vp);
  const A = await newPage(ctxA, errs, 'A', true);
  const B = await newPage(ctxB, errs, 'B', true);
  await A.exposeFunction('__netOut', s => B.evaluate(x => window.__netIn(x), s).catch(() => {}));
  await B.exposeFunction('__netOut', s => A.evaluate(x => window.__netIn(x), s).catch(() => {}));
  await A.reload(); await B.reload(); await A.waitForTimeout(700);
  // reload must restore both sessions from storage - no second login
  for (const [pg, who] of [[A, 'uA'], [B, 'uB']]) {
    const back = await pg.evaluate('loggedIn() && P().user');
    back === who ? pass('session restored ' + who) : fail('session restored ' + who, 'got ' + back);
  }
  await A.evaluate("P().bal=500000;renderBal();go('party')");
  await B.evaluate("P().color='#ffc800';P().bal=500000;renderBal();go('party')");
  await tap(A, '#pHost', 400);
  await B.fill('#pCode', await A.evaluate("NET.code"));
  await tap(B, '#pJoin', 900);
  return [A, B];
}

async function mp(browser, errs) {
  console.log('\nMULTIPLAYER');
  const [A, B] = await connectPair(browser, errs);
  const ok = await A.evaluate("NET.status") === 'connected' && await B.evaluate("NET.status") === 'connected';
  ok ? pass('peer connect') : fail('peer connect');
  if (!ok) { await A.close(); await B.close(); return; }

  // identity: joining a party must not rename the guest after the host
  const idA = await A.evaluate("[myProf().name, (NET.remote||{}).name]");
  const idB = await B.evaluate("[myProf().name, (NET.remote||{}).name]");
  const distinct = idA[0] === 'uA' && idB[0] === 'uB' && idA[1] === 'uB' && idB[1] === 'uA';
  distinct ? pass('identities distinct') : fail('identities distinct', `A=${JSON.stringify(idA)} B=${JSON.stringify(idB)}`);

  for (const g of ['hs', 'rn', 'vt', 'bj', 'pk', 'cr', 'db', 'cf']) {
    const n0 = errs.length;
    await A.evaluate(`act({a:'pick',g:'${g}'})`); await A.waitForTimeout(900);
    const synced = (await A.evaluate("PS.g")) === g && (await B.evaluate("PS.g")) === g;
    (errs.length === n0 && synced) ? pass('table ' + g) : fail('table ' + g, synced ? errs.slice(n0).join(' | ') : 'not synced');
  }

  // hidden-information leak checks â€” the guest must never receive secrets
  await A.evaluate("act({a:'pick',g:'vt'})"); await A.waitForTimeout(400);
  await tap(A, '#vtGo', 200); await tap(B, '#vtGo', 1300);
  const vtLeak = await B.evaluate("JSON.stringify((PS.d.lockers||[]).filter(l=>!l.open)[0]||{})");
  vtLeak === '{"open":false}' ? pass('vault: closed lockers hidden') : fail('vault: closed lockers hidden', vtLeak);

  // the vault round above is still live and (correctly) blocks a table switch â€” clear it first
  await A.evaluate("if(PG&&PG.vt){clearTimeout(PG.vt.to);PG.vt=vtNew();push()}"); await A.waitForTimeout(400);
  await A.evaluate("act({a:'pick',g:'pk'})"); await A.waitForTimeout(600);
  await tap(A, '#mpPkDeal', 2500);
  let pkLeak = 'no deal';
  for (let i = 0; i < 12; i++) {
    const ready = await B.evaluate("!!(PS.d.hole&&PS.d.hole.H&&PS.d.hole.H.length===2&&PS.d.hole.G&&PS.d.hole.G.length===2)");
    if (ready) {
      pkLeak = await B.evaluate("JSON.stringify(PS.d.hole[PS.me==='H'?'G':'H'].map(c=>c.r!=null))+'|'+JSON.stringify(PS.d.hole[PS.me].map(c=>c.r!=null))");
      break;
    }
    await B.waitForTimeout(500);
  }
  pkLeak === '[false,false]|[true,true]'
    ? pass("hold'em: their cards hidden, mine visible")
    : fail("hold'em: their cards hidden, mine visible", pkLeak);

  const n0 = errs.length;
  await A.evaluate("sendTaunt('\u{1F525}')"); await B.waitForTimeout(400);
  await A.evaluate("send({t:'rain',name:P().name,amt:1000});rainCash(P().name,1000)"); await B.waitForTimeout(800);
  await A.evaluate("DEV=true;devRender();send({t:'dev',bal:777,by:'Alex'})"); await B.waitForTimeout(500);
  const devOk = await B.evaluate("P().bal") === 777;
  (errs.length === n0 && devOk) ? pass('taunt + rain + dev override') : fail('taunt + rain + dev override', devOk ? '' : 'dev balance not applied');
  await A.close(); await B.close();
}

/* ---------------- The Strip: full game + money audit ---------------- */
async function strip(browser, errs) {
  console.log('\nTHE STRIP (full game, money audited every turn)');

  // The Strip is documented and audited here but is not currently in the build:
  // no 'st' entry in PT, no hostInit state, no renderer. Skip loudly rather than
  // fail â€” this suite is worth keeping for when the table is actually built.
  const probe = await browser.newContext();
  const pp = await probe.newPage();
  await pp.goto(URL);
  const hasStrip = await pp.evaluate("typeof PT!=='undefined' && PT.some(t=>t[0]==='st')");
  await probe.close();
  if (!hasStrip) {
    console.log('  SKIPPED  The Strip is not in this build (no "st" table in PT).');
    return;
  }

  const [A, B] = await connectPair(browser, errs);
  if (await A.evaluate("NET.status") !== 'connected') { fail('strip: no connection'); await A.close(); await B.close(); return; }
  const a0 = await A.evaluate("P().bal"), b0 = await B.evaluate("P().bal");
  await A.evaluate("act({a:'pick',g:'st'})"); await A.waitForTimeout(400);
  await tap(A, '#stGo', 200); await tap(B, '#stGo', 1600);
  const ante = await A.evaluate("PS.d.ante");
  let leak = null, bought = 0, bets = 0, ups = 0;

  for (let t = 0; t < 320; t++) {
    if (await A.evaluate("PS.d.phase!=='turn'")) break;
    const tot = await A.evaluate("PS.d.cash.H+PS.d.cash.G+PS.d.pot");
    if (Math.abs(tot - ante * 2) > 2) { leak = `turn ${t}: cash+pot ${tot} vs ${ante * 2}`; break; }
    const pend = await A.evaluate("PS.d.pend?PS.d.pend.k:null");
    if (pend) {
      const who = await A.evaluate("PS.d.pend.who");
      const pg = who === 'H' ? A : B;
      if (pend === 'buy' || pend === 'snipe') {
        const mult = pend === 'snipe' ? 1.25 : 1;
        const can = await pg.evaluate(`PS.d.cash[PS.me]>=Math.round(ST_GRP[ST_BOARD[PS.d.pend.i].g].price*PS.d.u*${mult})`);
        if (can && bought < 14) { await tap(pg, '[data-x="buy"]', 300); bought++; } else await tap(pg, '[data-x="pass"]', 300);
      } else if (pend === 'bet') {
        if (bets < 5) { await pg.evaluate("act({a:'bet',g:'st',k:['coin','high','jack'][Math.floor(Math.random()*3)],stake:Math.round(PS.d.u*0.6)})"); bets++; }
        else await tap(pg, '[data-x="pass"]', 300);
      }
      await A.waitForTimeout(700); continue;
    }
    const pg = (await A.evaluate("PS.d.turn")) === 'H' ? A : B;
    if (!(await pg.evaluate("PS.d.rolled"))) {
      if (ups < 8) {
        const did = await pg.evaluate(`(()=>{const d=PS.d,me=PS.me;
          for(const k in d.own){const i=+k;if(d.own[i]!==me)continue;const gi=ST_BOARD[i].g;
            if(d.setOf[gi]!==me)continue;const l=d.lvl[i]||0;if(l>=3)continue;
            const c=Math.round(ST_GRP[gi].price*d.u*ST_UPC[Math.min(2,l)]);
            if(d.cash[me]>=c){act({a:'upgrade',g:'st',i});return 1}}return 0})()`);
        if (did) { ups++; await pg.waitForTimeout(350); }
      }
      await tap(pg, '[data-x="roll"]', 1500);
    } else await tap(pg, '[data-x="end"]', 450);
  }
  await A.waitForTimeout(1800);
  leak ? fail('money conserved every turn', leak) : pass('money conserved every turn');

  const done = await A.evaluate("PS.d.phase") === 'done';
  done ? pass('game reached settlement', `${await A.evaluate("PS.d.turns")} turns, bought ${bought}, upgrades ${ups}, bets ${bets}`)
       : fail('game reached settlement');
  const a1 = await A.evaluate("P().bal"), b1 = await B.evaluate("P().bal");
  const sum = (a1 - a0) + (b1 - b0), want = -(ante * 2 * 0.03);
  near(sum, want, 0.05) ? pass('3% rake exact', `${sum.toFixed(2)} vs ${want.toFixed(2)}`)
                        : fail('3% rake exact', `${sum.toFixed(2)} vs ${want.toFixed(2)}`);
  await A.close(); await B.close();
}

/* ---------------- RTP (runs the page's own maths) ---------------- */
async function rtp(ctx, errs) {
  console.log('\nRTP  (tolerance is per-game: fat-tailed payouts swing more even at millions of samples)');
  const pg = await newPage(ctx, errs, 'rtp', false);
  const out = await pg.evaluate(`(()=>{
    const res=[];
    const N=2000000;
    // (Skyline's RTP rows lived here; the game is not in this build.)
    // Scratch tickets: generators are the real thing
    const tk=(fn,n)=>{let t=0,h=0;for(let i=0;i<n;i++){const d=fn();t+=d.total;if(d.total>0)h++}
      return [t/n*100,h/n*100];};
    [['crown',genCrown],['deep',genDeep],['neon',genNeon],['gold',genGold]].forEach(([k,f])=>{
      const [r,h]=tk(f,3000000);res.push(['ticket '+k,r,96,h,2.5]);});
    // Moles: 0.98/p^k must hold for every mole count and every cash-out point.
    // Exact expectation first - this covers the deep streaks that simulation
    // cannot reach (1 mole to 8 hits is 1 in 5,764,801, so no sane sample size
    // ever lands one and a Monte Carlo row there would just read 0.00%).
    {const holes=7;let worst=98,worstAt='';
     for(let moles=1;moles<=6;moles++)for(let k=1;k<=8;k++){
       const p=moles/holes,mult=.98/Math.pow(p,k);
       const ev=Math.pow(p,k)*mult*100;           // reach it with p^k, get paid mult
       if(Math.abs(ev-98)>Math.abs(worst-98)){worst=ev;worstAt=moles+'m@'+k}
     }
     res.push(['moles exact EV (worst '+worstAt+')',worst,98,null,0.02]);
     // then simulate the reachable cases, to prove the code matches the maths
     for(const moles of [1,3,6]){
       for(const stopAt of [1,3]){
         const p=moles/holes;const mult=k=>k<=0?1:.98/Math.pow(p,k);
         let ret=0;const N2=400000;
         for(let i=0;i<N2;i++){
           let k=0;
           while(k<stopAt){ if(Math.random()<p)k++; else {k=-1;break} }
           if(k>=stopAt)ret+=mult(stopAt);
         }
         // Tolerance from the estimator's own variance, not a guessed number.
         // Payout is all-or-nothing with q=p^k, so the relative standard error is
         // ~1/sqrt(qN) - at 1 mole and 3 hits that is 2.9%, and a fixed +/-1.2
         // band would fail roughly a third of runs for no reason. The exact-EV
         // row above is what pins the maths down; these rows prove the code
         // matches it. 4 sigma keeps false failures rare.
         const q=Math.pow(p,stopAt), se=98*Math.sqrt((1-q)/(q*N2));
         res.push(['moles '+moles+'m stop@'+stopAt,ret/N2*100,98,null,Math.max(0.5,+(4*se).toFixed(2))]);
       }
     }}
    // Long Shot: the skill game. 97% must be the CEILING - reached only by
    // flawless aim, and strictly lower for anyone worse. That is what stops a
    // good player beating the house on a game where skill genuinely counts.
    {const G=100, tiers=[55,33,16,6];
     const gust=()=>((Math.random()-.5)+(Math.random()-.5))*G;
     const qOf=h=>{const r=(G-h)/G;return 1-r*r};
     tiers.forEach((half,ti)=>{
       const q=qOf(half), payout=.97/q;
       let ret=0;const N2=300000;
       for(let i=0;i<N2;i++)if(Math.abs(gust())<=half)ret+=payout;
       res.push(['longshot t'+ti+' flawless aim',ret/N2*100,97,null,
         Math.max(0.35,+(4*97*Math.sqrt((1-q)/(q*N2))).toFixed(2))]);
     });
     // sloppy aim must return strictly LESS, at every tier
     {let worstOk=1;
      tiers.forEach(half=>{
        const q=qOf(half), payout=.97/q;
        let ret=0;const N2=200000;
        for(let i=0;i<N2;i++){
          const slop=(Math.random()*2-1)*25;      // 25 units of aiming error
          if(Math.abs(gust()+slop)<=half)ret+=payout;
        }
        if(ret/N2*100 >= 96.0) worstOk=0;          // must be clearly under 97
      });
      res.push(['longshot sloppy aim returns less',worstOk?97:80,97,null,1]);
     }}
    // Limbo
    {let t=0;const T=5;for(let i=0;i<N;i++){const u=Math.random();if(Math.max(1,Math.floor(99/u)/100)>=T)t+=T}
      res.push(['limbo @5x',t/N*100,99,null,0.8]);}
    // Tower
    {const m='med',c=TW_CFG[m],p=(c.d-c.t)/c.d,k=4,mu=twMult(k,m);let t=0;
      for(let i=0;i<N;i++){let ok=1;for(let j=0;j<k;j++)if(Math.random()>=p){ok=0;break}if(ok)t+=mu}
      res.push(['tower med, 4 floors',t/N*100,97,null,0.8]);}
    // Plinko
    {let t=0;for(let i=0;i<N;i++){let b=0;for(let k=0;k<12;k++)b+=Math.random()<.5?1:0;t+=PL_TABLE.med[b]}
      res.push(['plinko medium',t/N*100,99,null,0.5]);}
    return res;})()`);
  for (const [name, got, want, hit, tol] of out) {
    const t = tol || 1.5;
    const d = `${got.toFixed(2)}% (want ${want}% +/-${t})` + (hit != null ? `  hit ${hit.toFixed(1)}%` : '');
    Math.abs(got - want) <= t ? pass(name, d) : fail(name, d);
  }
  await pg.close();
}

async function clashbattle(browser, errs) {
  console.log('\nSTACK CLASH (party battle)');
  const [A, B] = await connectPair(browser, errs);
  if (await A.evaluate("NET.status") !== 'connected') { fail('clash: no connection'); await A.close(); await B.close(); return; }
  await A.evaluate("go('cards')"); await B.evaluate("go('cards')"); await A.waitForTimeout(400);
  await A.evaluate("StackCards.go('clash')"); await B.evaluate("StackCards.go('clash')"); await A.waitForTimeout(200);
  // both open the battle lobby and pick decks
  await A.evaluate("StackCards._.CL.screen='lobby';StackCards._.clLobbyInit()");
  await B.evaluate("StackCards._.CL.screen='lobby';StackCards._.clLobbyInit()");
  await A.waitForTimeout(500);
  const sees = await A.evaluate("[!!StackCards._.CL.lobby, StackCards._.CL.lobby&&StackCards._.CL.lobby.theirName]");
  (sees[0] && sees[1]) ? pass('battle lobby shows your mate', sees[1]) : fail('battle lobby shows your mate', JSON.stringify(sees));
  // both ready up
  await A.evaluate("StackCards.root.querySelector('#clLReady').click()");
  await B.evaluate("StackCards.root.querySelector('#clLReady').click()");
  await A.waitForTimeout(500);
  const hostSees = await B.evaluate("[StackCards._.CL.lobby.ready, StackCards._.CL.lobby.theirReady, !!StackCards.root.querySelector('#clLStart')]");
  const aHost = await A.evaluate("!!StackCards.root.querySelector('#clLStart')");
  const host = aHost ? A : B, join = aHost ? B : A;
  (hostSees[0] && hostSees[1]) ? pass('both ready syncs across the wire') : fail('both ready syncs across the wire', JSON.stringify(hostSees));
  // host starts the battle
  await host.evaluate("StackCards.root.querySelector('#clLStart').click()");
  await A.waitForTimeout(700);
  const hb = await host.evaluate("[StackCards._.CL.screen, StackCards._.CL.side, !!StackCards._.CL.game]");
  const jb = await join.evaluate("[StackCards._.CL.screen, StackCards._.CL.side, !!StackCards._.CL.game]");
  (hb[0] === 'board' && hb[1] === 0 && hb[2] && jb[0] === 'board' && jb[1] === 1 && jb[2]) ? pass('battle starts on both sides, host is player 1') : fail('battle starts on both sides', JSON.stringify([hb, jb]));
  // the active player plays a baby; it must appear on the other screen
  const turn = await host.evaluate("StackCards._.CL.game.turn");
  const sideA = await A.evaluate("StackCards._.CL.side");
  const active = turn === sideA ? A : B, passive = turn === sideA ? B : A;
  const played = await active.evaluate(`(()=>{const X=StackCards._,g=X.CL.game,sd=X.CL.side;const hi=g.players[sd].hand.findIndex(id=>StackCards.SET[id].stage===0);if(hi<0)return 'nobaby';let ln=[0,1,2].find(l=>X.clCanPlay(g,sd,hi,l));if(ln==null)return 'cant';X.CL.sel=hi;StackCards.root.querySelector('.cl-row.you .cllane[data-ln="'+ln+'"]').click();return 'ok:'+ln})()`);
  await A.waitForTimeout(500);
  const synced = await passive.evaluate(`(()=>{const g=StackCards._.CL.game,t=${turn};return g.players[t].lanes.some(x=>x)})()`);
  (played.indexOf('ok') === 0 && synced) ? pass('a move on your turn syncs to your mate', played) : fail('a move syncs to your mate', JSON.stringify([played, synced]));
  await A.close(); await B.close();
}

/* ---------------- run ---------------- */
(async () => {
  const which = (process.argv[2] || 'all').toLowerCase();
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 980 } });
  const errs = [];
  try {
    if (which === 'all' || which === 'solo') await solo(ctx, errs);
    if (which === 'all' || which === 'admin') await admin(ctx, errs);
    if (which === 'all' || which === 'moles') await moles(ctx, errs);
    if (which === 'all' || which === 'shot') await longshot(ctx, errs);
    if (which === 'all' || which === 'sports') await sports(ctx, errs);
    if (which === 'all' || which === 'fight') await fight(ctx, errs);
    if (which === 'all' || which === 'cards') await cards(ctx, errs);
    if (which === 'all' || which === 'cards' || which === 'trade') await cardtrade(browser, errs);
    if (which === 'all' || which === 'mp') await mp(browser, errs);
    if (which === 'all' || which === 'clash') await clashbattle(browser, errs);
    if (which === 'all' || which === 'coop') await coop(browser, errs);
    if (which === 'all' || which === 'strip') await strip(browser, errs);
    if (which === 'all' || which === 'rtp') await rtp(ctx, errs);
  } finally { await browser.close(); }

  console.log('\nCONSOLE ERRORS: ' + (errs.length ? '\n  ' + [...new Set(errs)].join('\n  ') : 'none'));
  const bad = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed` + (errs.length ? `, ${errs.length} console error(s)` : ''));
  process.exit(bad || errs.length ? 1 : 0);
})();
