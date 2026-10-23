/* ================= TEXAS HOLD'EM (no limit, you + 4 AI players, 2D) =================
   The AI decides from a Monte Carlo equity estimate of its own two cards against the board (it never sees yours),
   the pot odds and its personality. Rake: 5% of pots that see a flop, capped at 3 big blinds. You sit down with
   100 big blinds; the stack is saved (s2.pk) and goes back to your balance when you leave the table. */
function eval5(cs){const r=cs.map(c=>rk(c)===0?14:rk(c)+1).sort((a,b)=>b-a),fl=cs.every(c=>su(c)===su(cs[0])),cnt={};r.forEach(v=>cnt[v]=(cnt[v]||0)+1);
 const g=Object.entries(cnt).map(([v,n])=>[+v,n]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]),u=[...new Set(r)];let s=0;if(u.length===5){if(r[0]-r[4]===4)s=r[0];else if(r[0]===14&&r[1]===5)s=5}
 const cat=s&&fl?8:g[0][1]===4?7:g[0][1]===3&&g[1][1]===2?6:fl?5:s?4:g[0][1]===3?3:g[0][1]===2&&g[1][1]===2?2:g[0][1]===2?1:0;const k=s?[s]:g.map(x=>x[0]);return cat*1e10+k.reduce((a,v,i)=>a+v*Math.pow(15,4-i),0)}
function best7(cs){let b=0;const n=cs.length;for(let a=0;a<n;a++)for(let c=a+1;c<n;c++){const h=cs.filter((_,i)=>i!==a&&i!==c);if(h.length===5){const v=eval5(h);if(v>b)b=v}else if(h.length<5){const v=eval5(cs.slice(0,5));if(v>b)b=v}}return n===5?eval5(cs):b}
const HN=['High card','Pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
const hname=v=>HN[Math.floor(v/1e10)];
function equity(hole,board,opp,n=140){const known=new Set(hole.concat(board)),rest=[];for(let c=0;c<52;c++)if(!known.has(c))rest.push(c);let w=0;
 for(let s=0;s<n;s++){for(let i=rest.length-1;i>0;i--){const j=rint(i+1);[rest[i],rest[j]]=[rest[j],rest[i]]}let k=0;const bd=board.slice();while(bd.length<5)bd.push(rest[k++]);const me=best7(hole.concat(bd));let best=0,ties=0;
  for(let o=0;o<opp;o++){const v=best7([rest[k++],rest[k++]].concat(bd));if(v>best){best=v;ties=0}if(v===me)ties++}if(me>best)w++;else if(me===best)w+=1/(ties+1)}return w/n}
const PKB=[[1,2],[5,10],[50,100]];const BOTS=[['Nova',.5,.55],['Marlowe',.7,.35],['Jinx',.35,.8],['Ruby',.6,.6],['Doc',.78,.28],['Vega',.45,.7],['Hollis',.65,.45],['Kiko',.4,.6]];
const PK={bots:null,btn:0,lv:0};
game('holdem',{name:"Texas Hold'em",cat:'poker',glyph:'AA',rtp:'Skill',tag:'POKER',inv:1,sim:()=>R()<.25?2+R()*3:0,
 rules:"No-limit Texas Hold'em against four AI players. Two cards each, five on the board, best five-card hand wins. Fold, check, call or raise any amount. You sit down with 100 big blinds from your balance and take whatever you have left when you leave. The house rakes 5% of pots that see a flop, capped at 3 big blinds. A skill game: the AI never sees your cards.",
 mount(h){const x=X();if(!x.pk)x.pk={me:0,lv:0};PK.lv=x.pk.lv||0;
  h.innerHTML=`<div class="gwrap" style="grid-template-columns:280px minmax(0,1fr)"><div class="gside"><div class="field"><label>Table</label><div class="chips">${PKB.map(([s,b],i)=>`<button class="chip${i===PK.lv?' on':''}" data-lv="${i}">${s}/${b}</button>`).join('')}</div></div>
   <div class="kv"><span>Your stack</span><b id="pkMe">${fmt(x.pk.me)}</b></div><div class="kv"><span>Buy-in</span>${fmt(PKB[PK.lv][1]*100)}</div><div class="kv"><span>Rake</span>5% · max ${fmt(PKB[PK.lv][1]*3)}</div><div id="pkB"></div>${BTN('Leave table','w','id="pkLeave"')}<div class="mono">Hand log</div><div id="pkLog" style="font-size:12px;max-height:200px;overflow:auto" class="mut"></div></div>
   <div class="gstage" style="min-height:620px"><div id="pkT" style="position:relative;width:860px;height:560px"></div><div class="res" id="gres"></div></div></div>`;
  h.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{if(this.busy)return;if(x.pk.me>0)this.cashout();PK.lv=x.pk.lv=+b.dataset.lv;PK.bots=null;save();route()});
  $('pkLeave').onclick=()=>{if(this.busy)return toast('Finish the hand first','','lt');this.cashout();route()};this.table();this.btns()},
 cashout(){const x=X();if(x.pk.me>0){P().bal=Math.round((P().bal+x.pk.me)*100)/100;drawBal(1);tx('poker',x.pk.me,"Left the Hold'em table");toast('Cashed out',fmt(x.pk.me)+' back to your balance');x.pk.me=0;save()}},
 leave(){if(!this.busy)this.cashout()},
 btns(){const b=$('pkB');if(!b)return;b.innerHTML=this.busy?'':BTN(X().pk.me<PKB[PK.lv][1]?`Sit down · ${fmt(PKB[PK.lv][1]*100)}`:'Deal next hand','f lg w','id="pkGo"');if($('pkGo'))$('pkGo').onclick=()=>this.hand()},
 seats:[[430,470],[110,330],[200,110],[660,110],[750,330]],
 table(P,board,pot,show){const t=$('pkT');if(!t)return;const [sb,bb]=PKB[PK.lv];if(!PK.bots){const names=BOTS.slice().sort(()=>R()-.5);PK.bots=[1,2,3,4].map((s,i)=>({seat:s,name:names[i][0],tight:names[i][1],agg:names[i][2],stack:bb*(80+rint(80))}))}
  const ps=P||[{seat:0,name:'You',stack:X().pk.me,bot:0}].concat(PK.bots.map(b=>({...b,bot:1})));
  t.innerHTML=`<div style="position:absolute;inset:40px 30px;border-radius:260px;border:2px solid var(--ink);background:var(--surface)"></div><div style="position:absolute;inset:58px 48px;border-radius:240px;border:1px dashed var(--line)"></div>
   <div style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center"><div style="display:flex;gap:8px;justify-content:center;min-height:80px">${(board||[]).map((c,bi)=>cardH(c,{sm:1,k:dealKey('pkB'+bi)})).join('')}</div><div class="mono" style="margin-top:10px">Pot</div><div class="dn" style="font-size:26px">${fmt(pot||0)}</div></div>
   ${ps.map(p=>{const [x,y]=this.seats[p.seat],me=!p.bot;return `<div style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);text-align:center;opacity:${p.fold?.35:1}">
    <div style="display:flex;justify-content:center;gap:4px;margin-bottom:6px">${(p.cards||[]).map((c,ci)=>cardH(c,{sm:1,back:p.bot&&!show,k:dealKey('pk'+p.seat+'-'+ci)})).join('')}</div>
    <div style="background:${me?'var(--ink)':'var(--surface)'};color:${me?'var(--surface)':'var(--ink)'};border:1.5px solid var(--ink);border-radius:12px;padding:6px 14px;min-width:120px;${p.act&&p.act.startsWith('Thinking')?'box-shadow:0 0 0 4px var(--line)':''}">
     <b style="font-size:13px">${PK.btn===p.seat?'Ⓓ ':''}${esc(p.name)}</b><div class="dn" style="font-size:15px">${fmt(p.stack)}</div></div>
    <div class="mono" style="margin-top:4px;min-height:14px;color:var(--ink)">${p.act||''}${p.bet?` · ${fmt(p.bet)}`:''}</div></div>`}).join('')}`},
 log(s){const l=$('pkLog');if(l)l.insertAdjacentHTML('afterbegin',`<div>${s}</div>`)},
 async hand(){const x=X(),[sb,bb]=PKB[PK.lv];if(x.pk.me<bb){const buy=bb*100;if(!canStake(buy))return;P().bal=Math.round((P().bal-buy)*100)/100;drawBal(-1);x.pk.me+=buy;tx('poker',-buy,"Sat down at Hold'em");save()}
  this.busy=1;this.btns();for(const b of PK.bots)if(b.stack<bb){const n=pickA(BOTS.filter(z=>!PK.bots.some(q=>q.name===z[0])));this.log(`${n[0]} takes ${b.name}'s seat`);Object.assign(b,{name:n[0],tight:n[1],agg:n[2],stack:bb*(80+rint(80))})}
  const ORD=[1,2,0,3,4];PK.btn=ORD[(ORD.indexOf(PK.btn)+1)%5];const order=[];for(let k=1;k<=5;k++)order.push(ORD[(ORD.indexOf(PK.btn)+k)%5]);
  const PL=order.map(s=>s===0?{seat:0,name:'You',stack:x.pk.me,bot:0}:{...PK.bots.find(b=>b.seat===s),bot:1}).map(p=>({...p,cards:[],bet:0,tot:0,fold:0,allin:0,act:''}));const me=PL.find(p=>!p.bot),start=x.pk.me;
  const d=deck();let pot=0,board=[];DEALN++;const put=(p,a)=>{a=Math.min(a,p.stack);p.stack-=a;p.bet+=a;p.tot+=a;if(p.stack<=0)p.allin=1;sfx('chip')};
  const draw=(show)=>this.table(PL,board,pot+PL.reduce((a,p)=>a+p.bet,0),show);
  put(PL[0],sb);PL[0].act='SB';put(PL[1],bb);PL[1].act='BB';sfx('shuffle');draw();await wait(400);
  for(let r=0;r<2;r++)for(const p of PL){p.cards.push(d.pop());sfx('deal');draw();await wait(120)}
  const live=()=>PL.filter(p=>!p.fold);
  for(let street=0;street<4;street++){if(street){for(const p of PL){pot+=p.bet;p.bet=0;p.act=p.fold?'Fold':p.allin?'All in':''}sfx('collect');const n=street===1?3:1;for(let k=0;k<n;k++){board.push(d.pop());sfx('flip');draw();await wait(280)}
    this.log(`${['','Flop','Turn','River'][street]}: ${board.map(c=>RK[rk(c)]+SU[su(c)]).join(' ')}`)}
   if(live().length<2)break;if(PL.filter(p=>!p.fold&&!p.allin).length<2&&PL.every(p=>p.fold||p.allin||p.bet>=Math.max(...PL.map(q=>q.bet))))continue;
   await this.round(PL,street,board,pot,bb,draw);if(live().length<2)break}
  for(const p of PL){pot+=p.bet;p.bet=0}const L=live();let rake=0;if(board.length>=3&&L.length>1)rake=Math.min(Math.round(pot*.05*100)/100,bb*3);
  if(L.length>1)for(const p of L)p.score=best7(p.cards.concat(board));
  const lv=[...new Set(PL.map(p=>p.tot))].filter(v=>v>0).sort((a,b)=>a-b);let prev=0,first=1;const won={};
  for(const v of lv){let amt=PL.reduce((a,p)=>a+Math.max(0,Math.min(p.tot,v)-prev),0);const el=L.filter(p=>p.tot>=v);prev=v;if(!el.length||amt<=0)continue;if(first&&rake){amt-=rake;first=0}
   const best=Math.max(...el.map(p=>p.score||0)),ws=el.filter(p=>(p.score||0)===best),sh=Math.floor(amt/ws.length*100)/100;ws.forEach((p,k)=>{const a=k===0?Math.round((amt-sh*(ws.length-1))*100)/100:sh;p.stack+=a;won[p.seat]=(won[p.seat]||0)+a})}
  for(const p of PL)if(won[p.seat])p.act=`Wins ${fmt(won[p.seat])}${L.length>1?' · '+hname(p.score):''}`;pot=0;sfx('chips');draw(L.length>1);
  const w=PL.filter(p=>won[p.seat]);this.log(`<b>${w.map(p=>p.name).join(' & ')}</b> win${w.length>1?'':'s'} ${fmt(Object.values(won).reduce((a,b)=>a+b,0))}${rake?` · rake ${fmt(rake)}`:''}`);
  for(const p of PL){if(p.bot)PK.bots.find(b=>b.seat===p.seat).stack=Math.round(p.stack*100)/100;else x.pk.me=Math.round(p.stack*100)/100}
  const net=x.pk.me-start,got=won[0]||0;x.wag+=me.tot;x.n++;x.vip+=me.tot;x.rake+=me.tot*.002;SES.wag+=me.tot;SES.bets++;SES.won+=got;/* a hand's stake is what you put in, its payout what came back */
  record('holdem',me.tot,got,w.some(p=>!p.bot)?`Won the pot${L.length>1?' with '+hname(me.score||0):''}`:me.fold?'Folded':'Lost the pot');
  outcome(net>0);if(net>0){sfx('win');showRes(true,`+${fmt(net)}`);winFx(got,got/Math.max(1,me.tot))}else if(net<0)showRes(false,`${fmt(net)}`);save();if($('pkMe'))$('pkMe').textContent=fmt(x.pk.me);
  await wait(2200);this.busy=0;this.table();this.btns()},
 async round(P,street,board,pot0,bb,draw){let max=Math.max(...P.map(p=>p.bet)),minR=bb;const acted=new Set();let i=street?0:2%P.length;const need=p=>!p.fold&&!p.allin&&(p.bet<max||!acted.has(p));
  for(let g=0;g<60;g++){if(P.filter(p=>!p.fold).length<2||!P.some(need))return;const p=P[i%P.length];i++;if(!need(p))continue;const pot=pot0+P.reduce((a,q)=>a+q.bet,0),toCall=Math.min(max-p.bet,p.stack);let a;
   if(p.bot){p.act='Thinking…';draw();await wait(450+R()*650);a=this.bot(p,P,board,pot,toCall,max,minR,bb)}else{p.act='Your move';draw();a=await this.me(p,pot,toCall,max,minR,bb)}
   if(a.t==='fold'){p.fold=1;p.act='Fold';sfx('card')}else if(a.t==='call'){const c=Math.min(max-p.bet,p.stack);p.act=c?(p.stack-c<=0?'All in':'Call'):'Check';if(c){p.stack-=c;p.bet+=c;p.tot+=c;if(p.stack<=0)p.allin=1;sfx('chip')}else sfx('tick')}
   else{const to=Math.min(a.to,p.bet+p.stack),inc=to-max;if(inc>=minR)minR=inc;max=Math.max(max,to);const c=to-p.bet;p.stack-=c;p.bet+=c;p.tot+=c;if(p.stack<=0)p.allin=1;p.act=p.allin?'All in':'Raise';sfx('chips');acted.clear()}
   if(p.bot)this.log(`${p.name}: ${p.act}${p.bet?' '+fmt(p.bet):''}`);acted.add(p);draw()}},
 bot(p,P,board,pot,toCall,max,minR,bb){const opp=P.filter(q=>!q.fold&&q!==p).length,eq=equity(p.cards,board,opp),r=R(),odds=toCall/(pot+toCall||1),minTo=max+minR,rt=f=>Math.max(minTo,Math.round((max+(pot+toCall)*f)/bb)*bb);
  if(toCall<=0){if(eq>.62-(p.agg-.5)*.15&&r<.55+p.agg*.4)return{t:'raise',to:rt(.45+r*.5)};if(r<p.agg*.12)return{t:'raise',to:rt(.5)};return{t:'call'}}
  if(eq>.78&&r<.35+p.agg*.5)return{t:'raise',to:rt(.6+r*.6)};if(eq>=odds*(.85+p.tight*.45))return{t:'call'};if(r<p.agg*.04&&toCall<pot*.6)return{t:'raise',to:rt(.7)};return{t:'fold'}},
 async me(p,pot,toCall,max,minR,bb){const minTo=Math.min(max+minR,p.bet+p.stack),all=p.bet+p.stack,half=Math.max(minTo,Math.round((max+(pot+toCall)*.5)/bb)*bb),full=Math.max(minTo,Math.round((max+pot+toCall)/bb)*bb);
  $('pkB').innerHTML=`<div id="gActs" style="display:flex;flex-direction:column;gap:6px"></div>`;
  const L=[];if(toCall>0)L.push(['fold','Fold',0,'F']);L.push(['call',toCall>0?(toCall>=p.stack?'All in '+fmt(p.stack):'Call '+fmt(toCall)):'Check',1,toCall>0?'C':'K']);
  if(all>max){if(minTo<all)L.push(['r:'+minTo,(max?'Raise to ':'Bet ')+fmt(minTo),0,'R']);if(half<all&&half>minTo)L.push(['r:'+half,'½ pot · '+fmt(half),0,'H']);if(full<all&&full>half)L.push(['r:'+full,'Pot · '+fmt(full),0,'P']);L.push(['r:'+all,'All in · '+fmt(p.stack),0,'A'])}
  const a=await acts2(L);if(a==='fold')return{t:'fold'};if(a==='call')return{t:'call'};return{t:'raise',to:+a.slice(2)}}});
