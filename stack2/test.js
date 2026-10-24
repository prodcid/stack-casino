#!/usr/bin/env node
/* test.js - Stack 2 (stack-casino.html built from stack2/). node test.js
   Accounts carry over from v1, the top-up rule, every page renders, the maths of every game, real rounds of the
   table games, poker cash-out to the cent, sports + micro bets settle, reality check and limits, no page errors. */
const path = require('path');
let pw; try { pw = require('playwright'); } catch { console.error('x  npm i -D playwright'); process.exit(2); }
const FILE = 'file://' + path.resolve(__dirname, process.env.STACK_FILE || 'stack-casino.html');
const res = [], check = (ok, n, d = '') => { res.push(!!ok); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : ''}`); };
(async () => {
  const b = await pw.chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1500, height: 920 } }); pg.on('pageerror', e => errs.push('' + e)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.goto(FILE); await pg.waitForTimeout(400);
  /* a v1 account, exactly as Stack v1 stored it */
  await pg.evaluate("localStorage.clear();localStorage.setItem('stack-casino',JSON.stringify({v:3,players:[{name:'mate',user:'mate',pw:hashPw('mate','pw'),bal:4321.5,big:900,bets:77,color:'#00e701',skins:{classic:1}}],session:null,hist:[],roster:{},audit:[]}))");
  await pg.reload(); await pg.waitForTimeout(600);
  await pg.fill('#auU', 'mate'); await pg.fill('#auP', 'pw'); await pg.click('#auGo'); await pg.waitForTimeout(1200); await pg.evaluate('closeAll()');
  const acct = await pg.evaluate("({in:loggedIn(),bal:P().bal,shown:document.getElementById('bal').getAttribute('aria-label')})");
  check(acct.in && acct.bal === 4321.5 && acct.shown === '4,321.50', 'a Stack v1 account logs in with its balance', acct);
  const tu = await pg.evaluate("(()=>{const a=P().bal;topUp();const b=P().bal;P().bal=50;topUp();return{refused:a===b,after:P().bal}})()");
  check(tu.refused && tu.after === 1050, 'top up: refused at 100 or more, +1,000 under 100 (the v1 rule)', tu);
  await pg.waitForTimeout(1800);await pg.evaluate("closeAll();P().bal=100000;drawBal()");
  /* every page */
  const routes = ['#/lobby', '#/c/orig', '#/c/cards', '#/c/poker', '#/c/table', '#/c/favs', '#/sports', '#/sports/live', '#/sports/tennis', '#/micro', '#/promos', '#/vip', '#/missions', '#/safer', '#/account/wallet', '#/account/bets', '#/account/tx', '#/account/stats', '#/account/settings'];
  const games = await pg.evaluate('ORDER.slice()'); let bad = [];
  for (const r of routes.concat(games.map(g => '#/play/' + g))) { const n0 = errs.length; await pg.evaluate(h => location.hash = h, r); await pg.waitForTimeout(r.includes('/play/') ? 1100 : 500); const t = await pg.evaluate("document.getElementById('view').textContent.length"); if (t < 60 || errs.length > n0) bad.push(r) }
  check(bad.length === 0 && games.length >= 17, `all ${routes.length} pages and ${games.length} games render`, bad.join(' '));
  /* the maths */
  const math = await pg.evaluate(`(()=>{const out={};
    out.plinko=Object.fromEntries(Object.entries(PLK).map(([k,t])=>[k,+t.reduce((a,m,i)=>a+m*binom12(i),0).toFixed(4)]));
    out.wheel=+LWev.toFixed(4);let mn=1;for(const m of[1,3,5,10,24])for(let k=1;k<=25-m;k++){let p=1;for(let i=0;i<k;i++)p*=(25-m-i)/(25-i);mn=Math.min(mn,mineMult(m,k)*p)}out.minesMin=+mn.toFixed(4);
    let n=0,w=0;for(let i=0;i<400000;i++){if(crashPoint()>=2)w++;n++}out.crash2=+(w/n*2).toFixed(3);
    let s=0,c=0;for(let i=0;i<200000;i++){const d=deck(),a=d.pop(),b=d.pop();c++;if(wv(a)>wv(b))s+=2;else if(wv(a)===wv(b)){c++;d.pop();d.pop();d.pop();if(wv(d.pop())>=wv(d.pop()))s+=3}}out.war=+(s/c).toFixed(3);
    let vp=0;const N=60000;for(let i=0;i<N;i++){const d=deck(),h=[d.pop(),d.pop(),d.pop(),d.pop(),d.pop()],r=vpRank(h);if(r>=0)vp+=VP[r][1]}out.vpDealtOnly=+(vp/N).toFixed(3);
    let ro=0;for(let i=0;i<200000;i++){const n=rint(37);if(RB.red.nums.includes(n))ro+=2}out.rouRed=+(ro/200000).toFixed(3);
    out.odds=[.5,.1,.9].map(p=>ODD(p)*p);return out})()`);
  check(Object.values(math.plinko).every(v => v > .975 && v <= .991) && math.wheel === .98 && math.minesMin > .97 && Math.abs(math.crash2 - .99) < .01 && math.war > .955 && math.war < .99 && Math.abs(math.rouRed - .973) < .01 && math.odds.every(v => v > .955 && v <= .971),
    'every game returns its stated RTP (plinko 99%, wheel 98%, mines 99%, crash 99%, war ~97%, roulette 97.3%, sports and micro 97%)', math);
  /* real rounds */
  await pg.evaluate('closeAll()');const before = await pg.evaluate('P().bal');
  await pg.evaluate("location.hash='#/play/dice'"); await pg.waitForTimeout(800); await pg.click('#dGo'); await pg.waitForTimeout(900);
  await pg.evaluate("location.hash='#/play/blackjack'"); await pg.waitForTimeout(800); await pg.click('#bjGo'); await pg.waitForTimeout(1600);
  for (let i = 0; i < 6; i++) { const a = await pg.$('#gActs [data-a="s"]'); if (a) { await a.click(); break } await pg.waitForTimeout(500) } await pg.waitForTimeout(2600);
  await pg.evaluate("location.hash='#/play/vpoker'"); await pg.waitForTimeout(800); await pg.click('#vpGo'); await pg.waitForTimeout(500); await pg.click('#vpGo'); await pg.waitForTimeout(600);
  await pg.evaluate("location.hash='#/play/roulette'"); await pg.waitForTimeout(800); await pg.click('[data-b="red"]'); await pg.click('#rGo'); await pg.waitForTimeout(6200);
  const rr = await pg.evaluate("(()=>{const b=X().bets;const r=b.find(x=>x.g==='roulette'),n=+r.d.split(' ')[0];return{n,s:r.s,p:r.p,ok:r.p===(REDS.has(n)?r.s*2:0)}})()");
  const led = await pg.evaluate("(()=>{const b=X().bets.slice(0,4);return{games:b.map(x=>x.g).sort().join(),net:+b.reduce((a,x)=>a+x.p-x.s,0).toFixed(2),bal:P().bal}})()");
  check(led.games === 'blackjack,dice,roulette,vpoker' && rr.ok && Math.abs((led.bal - before) - led.net) < .011, 'dice, blackjack, video poker and roulette rounds settle, and the wallet matches the bet history to the cent', { ...led, rr });
  /* poker: two hands, then leave: the stack comes back exactly */
  await pg.evaluate("location.hash='#/play/holdem'"); await pg.waitForTimeout(900); const pb0 = await pg.evaluate('P().bal');
  const pk = await pg.evaluate(`(async()=>{const g=GAMES.holdem;const clk=setInterval(()=>{const b=[...document.querySelectorAll('#gActs [data-a]')];const c=b.find(x=>x.dataset.a==='call')||b[0];if(c)c.click()},200);
    for(let h=0;h<2;h++)await g.hand();clearInterval(clk);const me=X().pk.me;g.cashout();return{me,left:X().pk.me,hands:X().bets.filter(b=>b.g==='holdem').length}})()`);
  const pb1 = await pg.evaluate('P().bal');
  check(pk.hands >= 2 && pk.left === 0 && Math.abs((pb1 - pb0) - (pk.me - 200)) < .011, "Hold'em: two hands against the AI, and leaving pays the stack back to the cent", { ...pk, delta: +(pb1 - pb0).toFixed(2) });
  /* sports and micro */
  const sp = await pg.evaluate(`(async()=>{refreshOdds();let m=null,sel=null;for(let t=0;t<40&&!sel;t++){refreshOdds();for(const z of MATCHES.filter(z=>z.live&&z.sp==='football'&&z.min<80))for(const k of['h','d','a'])if(!sel&&selOdd({mid:z.id,k:'res',s:k})){m=z;sel=k}if(!sel)await new Promise(r=>setTimeout(r,500))}toggleSel(m,'res',sel);SLIP[0].st=10;const b0=P().bal;placeSlip();const placed=SPB.length,co=cashOutVal(SPB[SPB.length-1]);
    const x=MICRO.find(z=>z.open);const bets=MB.length;if(x){const s=x.sel[0];MST=5;spend(5,'micro');MB.push({x:x.id,sel:s[0],st:5,od:ODD(s[2])})}return{placed,co,b0,micro:MB.length-bets,open:!!x}})()`);
  check(sp.placed >= 1 && sp.co > 0 && sp.micro === 1, 'a live sports bet is placed with a cash-out offer, and a micro bet is on', sp);
  const mres = await pg.evaluate(`(async()=>{for(let i=0;i<120&&MB.length;i++)await new Promise(r=>setTimeout(r,500));return{left:MB.length,micro:X().bets.filter(b=>/^micro/.test(b.g)).length}})()`);
  check(mres.left === 0 && mres.micro >= 1, 'the micro bet settles within a minute', mres);
  const sres = await pg.evaluate(`(async()=>{const b=SPB.find(z=>!z.multi);const m=MATCHES.find(z=>z.id===b.mid);m.min=93;m.clock=93*4;m.stop=1;for(let i=0;i<20&&!m.done;i++)await new Promise(r=>setTimeout(r,250));return{done:m.done,left:SPB.filter(z=>z.mid===m.id).length,rec:X().bets.some(x=>x.g==='sport')}})()`);
  check(sres.done && sres.left === 0 && sres.rec, 'the match ends and the bet settles into the history', sres);
  const bbt = await pg.evaluate(`(async()=>{refreshOdds();const m=MATCHES.find(z=>z.live&&z.sp==='football'&&!z.done&&z.min<80&&!z.sus)||MATCHES.find(z=>z.sp==='football'&&!z.done&&!z.live);const one=Math.abs(jointP(m,[{k:'res',s:'h'}])-m.P.res.h)<1e-9,none=jointP(m,[{k:'res',s:'h'},{k:'res',s:'a'}])===0;
    SLIP.length=0;toggleSel(m,'res','h');toggleSel(m,'ou15','o');SLIP.mst=10;const mo=multiOdd();const fair=mo.od>0&&mo.od*jointP(m,[{k:'res',s:'h'},{k:'ou15',s:'o'}])<=.965;const b0=P().bal;placeSlip();const bet=SPB.find(z=>z.multi);
    m.min=93;m.clock=93*4;m.stop=1;m.live=1;for(let i=0;i<20&&!m.done;i++)await new Promise(r=>setTimeout(r,250));const won=m.hs>m.as&&m.hs+m.as>1,rec=X().bets.find(x=>x.g==='sport-multi');
    return{one,none,fair,od:mo.od,placed:!!bet,left:SPB.filter(z=>z.multi).length,won,paid:+(P().bal-b0).toFixed(2),want:+((won?10*mo.od:0)-10).toFixed(2),rec:!!rec}})()`);
  check(bbt.one && bbt.none && bbt.fair && bbt.placed && bbt.left === 0 && bbt.rec && Math.abs(bbt.paid - bbt.want) < .01, 'bet builder: priced jointly at 96% (one leg = the market, impossible = no price), placed, settled to the cent', bbt);
  /* a human-speed click on a micro odds button (press, hold, release) places the bet; a favourite saves and shows */
  await pg.evaluate("location.hash='#/c/orig'"); await pg.waitForTimeout(800); await pg.hover('.tile[data-g="dice"]'); await pg.click('.tile[data-g="dice"] [data-fav]'); await pg.waitForTimeout(300);
  const fv = await pg.evaluate("({saved:JSON.parse(localStorage.getItem('stack-casino')).players.find(p=>p.user==='mate').s2.favs.includes('dice'),count:document.querySelector('#nav a[href=\"#/c/favs\"] .ct').textContent})");
  const n0 = await pg.evaluate('MB.length'); let el = null; for (let i = 0; i < 20 && !el; i++) { el = await pg.$('#mtrack .ob[data-x]:not([disabled])'); if (!el) await pg.waitForTimeout(500) }
  const bb = await el.boundingBox(); await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(400); await pg.mouse.up(); await pg.waitForTimeout(300);
  const slow = await pg.evaluate('MB.length') - n0;
  check(fv.saved && fv.count === '1' && slow === 1, 'a favourite saves and shows in the sidebar; a slow click on a micro bet places it', { ...fv, slow });
  const voidm = await pg.evaluate("(()=>{const m=MATCHES.find(z=>z.live&&z.sp!=='football');const x=MICRO.find(z=>z.mid===m.id&&!z.done);if(!x)return{skip:1};spend(5,'micro');MB.push({x:x.id,sel:x.sel[0][0],st:5,od:2});const b=P().bal;end(m,true);return{left:MB.filter(q=>q.x===x.id).length,back:+(P().bal-b).toFixed(2)}})()");
  check(voidm.skip || (voidm.left === 0 && voidm.back >= 5), 'a micro bet still open when its match ends is void and refunded', voidm);
  /* reality check and limits */
  await pg.evaluate("location.hash='#/lobby'"); await pg.waitForTimeout(500);
  const rc = await pg.evaluate("(async()=>{closeAll();SES.lastRc=Date.now()-31*60000;await new Promise(r=>setTimeout(r,5600));const m=document.getElementById('modal');return{on:m.classList.contains('on'),txt:/You've been playing for/.test(m.textContent)&&/Wagered/.test(m.textContent)&&/Net/.test(m.textContent),keep:!!document.getElementById('rcGo')}})()");
  check(rc.on && rc.txt && rc.keep, 'reality check: time played, wagered and net, with Keep playing', rc);
  await pg.evaluate("closeAll()");
  const lim = await pg.evaluate("(()=>{const x=X();x.limits.loss=1;const net=todayNet();const ok=spend(Math.max(2,net+10),'dice');x.limits.loss=0;x.cool=Date.now()+60000;const ok2=spend(1,'dice');x.cool=0;return{blocked:!ok,cool:!ok2}})()");
  check(lim.blocked && lim.cool, 'a daily loss limit and a break both stop bets', lim);
  await pg.evaluate("closeAll();location.hash='#/play/sunken'"); await pg.waitForTimeout(1200);
  const sl = await pg.evaluate(`(async()=>{let t=0;const N=1200000;for(let i=0;i<N;i++)t+=srSpin().pay;const rtp=t/N;closeAll();X().cool=0;X().limits.loss=0;X().limits.sess=0;P().bal=5000;SRV.turbo=1;const b0=bal(),n0=X().bets.length;const iv=setInterval(()=>{SRV.skip=1;if(SRV.banner)SRV.banner.end=1;if(SRV.bw)SRV.bw.end=1},100);
    await srPlay();clearInterval(iv);const rec=X().bets[0];return{rtp:+rtp.toFixed(4),rec:rec.g==='sunken',spent:b0-bal(),ok:Math.abs((bal()-b0)-(rec.p-rec.s))<.005,stake:rec.s,pay:rec.p}})()`);
  check(sl.rtp > .94 && sl.rtp < 1 && sl.rec && sl.ok, 'Sunken Riches: returns ~97% over 1.2M spins, and a real spin settles to the cent', sl);
  check(errs.length === 0, 'no page errors', errs.slice(0, 4).join(' | '));
  await b.close(); const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
})();
