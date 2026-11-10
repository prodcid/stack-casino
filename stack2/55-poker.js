/* ================= TEXAS HOLD'EM (no limit, you + 4 AI players, 2D) =================
   The AI decides from a Monte Carlo equity estimate of its own two cards against the board (it never sees yours),
   the pot odds and its personality. Rake: 5% of pots that see a flop, capped at 3 big blinds. You sit down with
   100 big blinds; the stack is saved (s2.pk) and goes back to your balance when you leave the table. */
function eval5(cs){const r=cs.map(c=>rk(c)===0?14:rk(c)+1).sort((a,b)=>b-a),fl=cs.every(c=>su(c)===su(cs[0])),cnt={};r.forEach(v=>cnt[v]=(cnt[v]||0)+1);
 const g=Object.entries(cnt).map(([v,n])=>[+v,n]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]),u=[...new Set(r)];let s=0;if(u.length===5){if(r[0]-r[4]===4)s=r[0];else if(r[0]===14&&r[1]===5)s=5}
 const cat=s&&fl?8:g[0][1]===4?7:g[0][1]===3&&g[1][1]===2?6:fl?5:s?4:g[0][1]===3?3:g[0][1]===2&&g[1][1]===2?2:g[0][1]===2?1:0;const k=s?[s]:g.map(x=>x[0]);return cat*1e10+k.reduce((a,v,i)=>a+v*Math.pow(15,4-i),0)}
function best7(cs){let b=0;const n=cs.length;for(let a=0;a<n;a++)for(let c=a+1;c<n;c++){const h=cs.filter((_,i)=>i!==a&&i!==c);if(h.length===5){const v=eval5(h);if(v>b)b=v}else if(h.length<5){const v=eval5(cs.slice(0,5));if(v>b)b=v}}return n===5?eval5(cs):b}
function bestN(cs){if(cs.length<5)return{v:0,cards:[]};let b={v:-1,cards:[]};const n=cs.length;const go=(st,pick)=>{if(pick.length===5){const h=pick.map(i=>cs[i]),v=eval5(h);if(v>b.v)b={v,cards:h};return}for(let i=st;i<n;i++)go(i+1,pick.concat(i))};go(0,[]);return b}
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
   <div class="gstage pkstage" style="min-height:680px"><div id="pkT" class="pktable"></div><div id="pkAct" class="pkactbar"></div><div class="res" id="gres"></div></div></div>`;
  h.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{if(this.busy)return;if(x.pk.me>0)this.cashout();PK.lv=x.pk.lv=+b.dataset.lv;PK.bots=null;save();route()});
  $('pkLeave').onclick=()=>{if(this.busy)return toast('Finish the hand first','','lt');this.cashout();route()};this.table();this.btns()},
 cashout(){const x=X();if(x.pk.me>0){P().bal=Math.round((P().bal+x.pk.me)*100)/100;drawBal(1);tx('poker',x.pk.me,"Left the Hold'em table");toast('Cashed out',fmt(x.pk.me)+' back to your balance');x.pk.me=0;save()}},
 leave(){if(!this.busy)this.cashout()},
 btns(){const b=$('pkB');if(!b)return;b.innerHTML=this.busy?'':BTN(X().pk.me<PKB[PK.lv][1]?`Sit down · ${fmt(PKB[PK.lv][1]*100)}`:'Deal next hand','f lg w','id="pkGo"');if($('pkGo'))$('pkGo').onclick=()=>this.hand()},
 seats:[[430,456],[112,322],[226,104],[634,104],[748,322]],
 table(P,board,pot,show){const t=$('pkT');if(!t)return;const [sb,bb]=PKB[PK.lv];if(!PK.bots){const names=BOTS.slice().sort(()=>R()-.5);PK.bots=[1,2,3,4].map((s,i)=>({seat:s,name:names[i][0],tight:names[i][1],agg:names[i][2],stack:bb*(80+rint(80))}))}
  const ps=P||[{seat:0,name:'You',stack:X().pk.me,bot:0}].concat(PK.bots.map(b=>({...b,bot:1})));const hl=this.hl||null,cx=430,cy=250;
  const col=n=>`hsl(${[...n].reduce((a,c)=>a+c.charCodeAt(0)*37,0)%360} 52% 40%)`,me0=ps.find(p=>!p.bot);let strength='';
  if(me0&&me0.cards&&me0.cards.length===2&&!me0.fold)strength=board&&board.length>=3?hname(bestN(me0.cards.concat(board)).v):rk(me0.cards[0])===rk(me0.cards[1])?'Pocket pair':su(me0.cards[0])===su(me0.cards[1])?'Suited':'';
  t.innerHTML=`<div class="pkrail"></div><div class="pkfelt"><div class="pklogo">STACK POKER ROOM<small>No-limit Texas Hold'em · ${fmt(sb)}/${fmt(bb)}</small></div></div><div class="shoe pkshoe"><i></i><i></i><i></i></div>${ambBtn()}
   <div class="pkboard">${[0,1,2,3,4].map(bi=>board&&board[bi]!=null?cardH(board[bi],{k:dealKey('pkB'+bi),cls:hl?(hl.has(board[bi])?'hl':'dim'):''}):'<div class="pkslot"></div>').join('')}</div>
   <div class="pkpot">${pot?chipsH(pot,{lab:0,max:8,sz:30}):''}<div><span>Pot</span><b>${fmt(pot||0)}</b></div></div>
   ${ps.map(p=>{const [x,y]=this.seats[p.seat],me=!p.bot,turn=p.act==='Your move'||(p.act||'').startsWith('Thinking'),win=(p.act||'').startsWith('Wins');const bx=me?x+160:x+(cx-x)*.3,by=me?y-30:y+(cy-y)*.3+(p.seat>=2&&p.seat<=3?14:0),dbx=x+(cx-x)*.3+(p.seat===0?-80:p.seat<3?34:-34),dby=y+(cy-y)*.3;
    const ac=p.act&&!turn?`<div class="pkact ${/Fold/.test(p.act)?'f':/Raise|All in/.test(p.act)?'r':/Wins/.test(p.act)?'w':''}">${p.act}</div>`:turn?`<div class="pkact t">${me?'Your move':'Thinking'}<i></i></div>`:'';
    return `<div class="pks s${p.seat}${me?' me':''}${p.fold?' fold':''}${turn?' turn':''}${win?' win':''}" data-seat="${p.seat}" style="left:${x}px;top:${y}px">
     <div class="pkc">${(p.cards||[]).map((c,ci)=>cardH(c,{sm:!me,back:p.bot&&!show,k:dealKey('pk'+p.seat+'-'+ci),cls:hl&&show&&!p.fold?(hl.has(c)?'hl':'dim'):''})).join('')}</div>
     <div class="pkplate"><div class="pkav" style="--a:${me?'#b8862a':col(p.name)}">${me?'YOU':esc(p.name.slice(0,2).toUpperCase())}</div><div class="pkinfo"><b>${esc(p.name)}</b><span>${fmt(p.stack)}</span></div></div>${ac}${me&&strength?`<div class="pkstr">${strength}</div>`:''}</div>
     ${p.bet?`<div class="pkbet" style="left:${bx}px;top:${by}px">${chipsH(p.bet,{lab:0,max:6,sz:30})}<span>${fmt(p.bet)}</span></div>`:''}${PK.btn===p.seat?`<div class="pkdb" style="left:${dbx}px;top:${dby}px">DEALER</div>`:''}`}).join('')}`},
 async sweep(){const t=$('pkT');if(!t)return;const pot=t.querySelector('.pkpot'),bs=[...t.querySelectorAll('.pkbet')];if(!bs.length||!pot)return;const pb=pot.getBoundingClientRect();
  bs.forEach(b=>{const r=b.getBoundingClientRect();b.animate([{transform:'translate(-50%,-50%)'},{transform:`translate(calc(-50% + ${pb.left+pb.width/2-r.left-r.width/2}px),calc(-50% + ${pb.top+pb.height/2-r.top-r.height/2}px)) scale(.8)`,opacity:.5}],{duration:430,easing:'cubic-bezier(.5,0,.3,1)',fill:'forwards'})});sfx('collect');await wait(460)},
 log(s){const l=$('pkLog');if(l)l.insertAdjacentHTML('afterbegin',`<div>${s}</div>`)},
 async hand(){const x=X(),[sb,bb]=PKB[PK.lv];if(x.pk.me<bb){const buy=bb*100;if(!canStake(buy))return;P().bal=Math.round((P().bal-buy)*100)/100;drawBal(-1);x.pk.me+=buy;tx('poker',-buy,"Sat down at Hold'em");save()}if($('pkMe'))$('pkMe').textContent=fmt(x.pk.me);
  this.busy=1;this.btns();for(const b of PK.bots)if(b.stack<bb){const n=pickA(BOTS.filter(z=>!PK.bots.some(q=>q.name===z[0])));this.log(`${n[0]} takes ${b.name}'s seat`);Object.assign(b,{name:n[0],tight:n[1],agg:n[2],stack:bb*(80+rint(80))})}
  const ORD=[1,2,0,3,4];PK.btn=ORD[(ORD.indexOf(PK.btn)+1)%5];const order=[];for(let k=1;k<=5;k++)order.push(ORD[(ORD.indexOf(PK.btn)+k)%5]);
  const PL=order.map(s=>s===0?{seat:0,name:'You',stack:x.pk.me,bot:0}:{...PK.bots.find(b=>b.seat===s),bot:1}).map(p=>({...p,cards:[],bet:0,tot:0,fold:0,allin:0,act:''}));const me=PL.find(p=>!p.bot),start=x.pk.me;
  const d=deck();let pot=0,board=[];DEALN++;this.hl=null;const put=(p,a)=>{a=Math.min(a,p.stack);p.stack-=a;p.bet+=a;p.tot+=a;if(p.stack<=0)p.allin=1;sfx('chip')};
  const draw=(show)=>this.table(PL,board,pot+PL.reduce((a,p)=>a+p.bet,0),show);
  put(PL[0],sb);PL[0].act='SB';put(PL[1],bb);PL[1].act='BB';sfx('shuffle');draw();await wait(400);
  for(let r=0;r<2;r++)for(const p of PL){p.cards.push(d.pop());sfx('deal');draw();await wait(210)}await wait(300);
  const live=()=>PL.filter(p=>!p.fold);
  for(let street=0;street<4;street++){if(street){await this.sweep();for(const p of PL){pot+=p.bet;p.bet=0;p.act=p.fold?'Fold':p.allin?'All in':''}draw();await wait(250);sfx('muck');await wait(300);const n=street===1?3:1;for(let k=0;k<n;k++){board.push(d.pop());sfx('deal');draw();await wait(street===1?260:420)}await wait(350)
    this.log(`${['','Flop','Turn','River'][street]}: ${board.map(c=>RK[rk(c)]+SU[su(c)]).join(' ')}`)}
   if(live().length<2)break;if(PL.filter(p=>!p.fold&&!p.allin).length<2&&PL.every(p=>p.fold||p.allin||p.bet>=Math.max(...PL.map(q=>q.bet))))continue;
   await this.round(PL,street,board,pot,bb,draw);if(live().length<2)break}
  await this.sweep();for(const p of PL){pot+=p.bet;p.bet=0}const L=live();let rake=0;if(board.length>=3&&L.length>1)rake=Math.min(Math.round(pot*.05*100)/100,bb*3);
  if(L.length>1)for(const p of L)p.score=best7(p.cards.concat(board));
  const lv=[...new Set(PL.map(p=>p.tot))].filter(v=>v>0).sort((a,b)=>a-b);let prev=0,first=1;const won={};
  for(const v of lv){let amt=PL.reduce((a,p)=>a+Math.max(0,Math.min(p.tot,v)-prev),0);const el=L.filter(p=>p.tot>=v);prev=v;if(!el.length||amt<=0)continue;if(first&&rake){amt-=rake;first=0}
   const best=Math.max(...el.map(p=>p.score||0)),ws=el.filter(p=>(p.score||0)===best),sh=Math.floor(amt/ws.length*100)/100;ws.forEach((p,k)=>{const a=k===0?Math.round((amt-sh*(ws.length-1))*100)/100:sh;p.stack+=a;won[p.seat]=(won[p.seat]||0)+a})}
  for(const p of PL)if(won[p.seat])p.act=`Wins ${fmt(won[p.seat])}${L.length>1?' · '+hname(p.score):''}`;
  if(L.length>1){this.hl=new Set();for(const p of PL)if(won[p.seat])bestN(p.cards.concat(board)).cards.forEach(c=>this.hl.add(c))}draw(L.length>1);await wait(L.length>1?1500:500);
  {const t=$('pkT'),pe=t&&t.querySelector('.pkpot');for(const p of PL)if(won[p.seat]&&t)chipFly(pe,t.querySelector(`.pks[data-seat="${p.seat}"] .pkplate`),won[p.seat],650)}await wait(200);pot=0;draw(L.length>1);
  const w=PL.filter(p=>won[p.seat]);this.log(`<b>${w.map(p=>p.name).join(' & ')}</b> win${w.length>1||!w[0].bot?'':'s'} ${fmt(Object.values(won).reduce((a,b)=>a+b,0))}${rake?` · rake ${fmt(rake)}`:''}`);
  for(const p of PL){if(p.bot)PK.bots.find(b=>b.seat===p.seat).stack=Math.round(p.stack*100)/100;else x.pk.me=Math.round(p.stack*100)/100}
  const net=x.pk.me-start,got=won[0]||0;x.wag+=me.tot;x.n++;x.vip+=me.tot;x.rake+=me.tot*.002;SES.wag+=me.tot;SES.bets++;SES.won+=got;/* a hand's stake is what you put in, its payout what came back */
  record('holdem',me.tot,got,w.some(p=>!p.bot)?`Won the pot${L.length>1?' with '+hname(me.score||0):''}`:me.fold?'Folded':'Lost the pot');
  outcome(net>0);if(net>0){sfx('win');showRes(true,`+${fmt(net)}`);winFx(got,got/Math.max(1,me.tot))}else if(net<0)showRes(false,`${fmt(net)}`);save();if($('pkMe'))$('pkMe').textContent=fmt(x.pk.me);
  await wait(2600);this.busy=0;this.hl=null;this.table();this.btns()},
 async round(P,street,board,pot0,bb,draw){let max=Math.max(...P.map(p=>p.bet)),minR=bb;const acted=new Set();let i=street?0:2%P.length;const need=p=>!p.fold&&!p.allin&&(p.bet<max||!acted.has(p));
  for(let g=0;g<60;g++){if(P.filter(p=>!p.fold).length<2||!P.some(need))return;const p=P[i%P.length];i++;if(!need(p))continue;const pot=pot0+P.reduce((a,q)=>a+q.bet,0),toCall=Math.min(max-p.bet,p.stack);let a;
   if(p.bot){p.act='Thinking…';draw();await wait(650+R()*900+(toCall>pot*.5?700:0));a=this.bot(p,P,board,pot,toCall,max,minR,bb)}else{p.act='Your move';draw();a=await this.me(p,pot,toCall,max,minR,bb)}
   if(a.t==='fold'){p.fold=1;p.act='Fold';sfx('muck')}else if(a.t==='call'){const c=Math.min(max-p.bet,p.stack);p.act=c?(p.stack-c<=0?'All in':'Call'):'Check';if(c){p.stack-=c;p.bet+=c;p.tot+=c;if(p.stack<=0)p.allin=1;sfx('chip')}else sfx('tick')}
   else{const to=Math.min(a.to,p.bet+p.stack),inc=to-max;if(inc>=minR)minR=inc;max=Math.max(max,to);const c=to-p.bet;p.stack-=c;p.bet+=c;p.tot+=c;if(p.stack<=0)p.allin=1;p.act=p.allin?'All in':'Raise';sfx('chips');acted.clear()}
   if(p.bot)this.log(`${p.name}: ${p.act}${p.bet?' '+fmt(p.bet):''}`);acted.add(p);draw()}},
 bot(p,P,board,pot,toCall,max,minR,bb){const opp=P.filter(q=>!q.fold&&q!==p).length,eq=equity(p.cards,board,opp),r=R(),odds=toCall/(pot+toCall||1),minTo=max+minR,rt=f=>Math.max(minTo,Math.round((max+(pot+toCall)*f)/bb)*bb);
  if(toCall<=0){if(eq>.62-(p.agg-.5)*.15&&r<.55+p.agg*.4)return{t:'raise',to:rt(.45+r*.5)};if(r<p.agg*.12)return{t:'raise',to:rt(.5)};return{t:'call'}}
  if(eq>.78&&r<.35+p.agg*.5)return{t:'raise',to:rt(.6+r*.6)};if(eq>=odds*(.85+p.tight*.45))return{t:'call'};if(r<p.agg*.04&&toCall<pot*.6)return{t:'raise',to:rt(.7)};return{t:'fold'}},
 me(p,pot,toCall,max,minR,bb){return new Promise(res=>{const minTo=Math.min(max+minR,p.bet+p.stack),all=p.bet+p.stack,half=Math.max(minTo,Math.round((max+(pot+toCall)*.5)/bb)*bb),full=Math.max(minTo,Math.round((max+pot+toCall)/bb)*bb);
  const L=[];if(toCall>0)L.push(['fold','Fold',0,'F']);L.push(['call',toCall>0?(toCall>=p.stack?'All in '+fmt(p.stack):'Call '+fmt(toCall)):'Check',1,toCall>0?'C':'K']);
  if(all>max){if(minTo<all)L.push(['r:'+minTo,(max?'Min raise ':'Bet ')+fmt(minTo),0,'R']);if(half<all&&half>minTo)L.push(['r:'+half,'½ pot · '+fmt(half),0,'H']);if(full<all&&full>half)L.push(['r:'+full,'Pot · '+fmt(full),0,'P']);L.push(['r:'+all,'All in · '+fmt(p.stack),0,'A'])}
  const box=$('pkAct'),canR=all>max&&minTo<all,v0=Math.min(all,half);if(!box)return res({t:'fold'});
  box.innerHTML=`<div class="pkacts" id="gActs">${L.map(([k,l,f,key])=>BTN(l+(key?` <span class="mono" style="opacity:.6;color:inherit">${key}</span>`:''),f?'f':'',`data-a="${k}"`)).join('')}</div>${canR?`<div class="pkslide"><span>Raise to</span><input type="range" id="pkR" min="${minTo}" max="${all}" step="${bb}" value="${v0}"><b id="pkRv">${fmt(v0)}</b>${BTN('Raise','f','id="pkRgo"')}</div>`:''}`;
  const done=k=>{box.innerHTML='';removeEventListener('keydown',kd);res(k==='fold'?{t:'fold'}:k==='call'?{t:'call'}:{t:'raise',to:+k.slice(2)})};
  const kd=e=>{if(e.target.tagName==='INPUT'&&e.target.type!=='range')return;const it=L.find(x=>x[3]&&x[3].toLowerCase()===e.key.toLowerCase());if(it){e.preventDefault();done(it[0])}};addEventListener('keydown',kd);
  box.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{sfx('click');done(b.dataset.a)});
  if(canR){const r=$('pkR');r.oninput=()=>{$('pkRv').textContent=fmt(+r.value)};$('pkRgo').onclick=()=>{sfx('chips');done('r:'+Math.min(all,Math.max(minTo,+r.value)))}}})}});
