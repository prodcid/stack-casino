/* ================= CARD GAMES (2D, black and white; red suits are the inverted cards) ================= */
const RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],SU=['♠','♥','♦','♣'];
const rk=c=>c%13,su=c=>Math.floor(c/13)%4;
function deck(n=1){const d=[];for(let k=0;k<n;k++)for(let c=0;c<52;c++)d.push(c);for(let i=d.length-1;i>0;i--){const j=rint(i+1);[d[i],d[j]]=[d[j],d[i]]}return d}
/* SEEN remembers each card slot (o.k) and what it showed: a new card deals in, a back turning face up flips, the rest stay still */
const SEEN={};let DEALN=0;const dealKey=p=>p+'-'+DEALN;
function cardAnim(o,c){if(!o.k)return' nw';const sig=o.back||c==null?'b':String(c),was=SEEN[o.k];SEEN[o.k]=sig;return was===sig?'':was==='b'?' fl':' nw'}
const cardH=(c,o={})=>c==null||o.back?`<div class="pc back${o.sm?' sm':''}${cardAnim(o,null)}"></div>`:`<div class="pc${su(c)===1||su(c)===2?' red':''}${o.sm?' sm':''}${o.cls?' '+o.cls:''}${cardAnim(o,c)}" style="animation-delay:${o.d||0}ms"><span class="r">${RK[rk(c)]}</span><span class="s">${SU[su(c)]}</span><span class="c">${SU[su(c)]}</span><span class="r2">${RK[rk(c)]}</span></div>`;
const handH=(cs,o={})=>`<div class="hand${o.sp?' sp':''}">${cs.map((c,i)=>cardH(c,{...o,d:o.k?0:i*90,k:o.k?o.k+i:'',back:o.hide&&i===1})).join('')}</div>`;
function acts2(list){return new Promise(res=>{const el=$('gActs');el.innerHTML=list.map(([k,l,f,key])=>BTN(l+(key?` <span class="mono" style="opacity:.6;color:inherit">${key}</span>`:''),f?'f':'',`data-a="${k}"`)).join('');
 const done=k=>{el.innerHTML='';removeEventListener('keydown',kd);res(k)},kd=e=>{const it=list.find(x=>x[3]&&x[3].toLowerCase()===e.key.toLowerCase());if(it){e.preventDefault();done(it[0])}};
 el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{sfx('click');done(b.dataset.a)});addEventListener('keydown',kd)})}
const tableStage=inner=>`<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:34px 20px 24px">${inner}<div id="gActs" style="display:flex;gap:8px;min-height:46px"></div></div>`;

/* ---------- BLACKJACK: 6 decks, dealer stands on soft 17, 3:2, double on any two, split once ---------- */
const bjT=cs=>{let t=0,a=0;for(const c of cs){const r=rk(c);t+=r===0?11:r>=9?10:r+1;if(r===0)a++}while(t>21&&a){t-=10;a--}return{t,soft:a>0}};
const isBJ=cs=>cs.length===2&&bjT(cs).t===21;
let SHOE=[];const draw6=()=>{if(SHOE.length<60){SHOE=deck(6);sfx('shuffle')}return SHOE.pop()};
game('blackjack',{name:'Blackjack',cat:'cards',glyph:'21',rtp:'99.5%',sim:()=>R()<.44?2:R()<.09?1:R()<.05?2.5:0,
 rules:'Six decks. Perfect Pairs side bet: a pair in your first two cards pays 25:1 same suit, 12:1 same colour, 7:1 mixed (97.8%). Get closer to 21 than the dealer without going over. Blackjack pays 3 to 2, the dealer stands on all 17s and peeks for blackjack. Double on any first two cards, split a pair once. About 99.5% return with basic strategy.',
 mount(h){gLayout(h,`${betBox('bAmt',10)}<div class="field"><label>Perfect Pairs side bet (optional)</label><div class="betin"><span>¢</span><input id="bjPP" type="number" min="0" value="0"></div></div><div class="mut" style="font-size:12px;margin-top:-6px">Your first two cards a pair: same suit 25:1, same colour 12:1, mixed 7:1 (97.8%).</div>${BTN('Deal','f lg w','id="bjGo"')}<p class="mut" style="font-size:12px">Keys: H hit · S stand · D double · P split</p><div class="kv"><span>Shoe</span><b id="bjSh"></b></div>`,
  tableStage(`<div style="text-align:center"><div id="bjD" style="min-height:108px"></div><div class="hlab">Dealer <b id="bjDt"></b></div></div><div style="font:500 11px var(--mono);letter-spacing:.2em;color:var(--ink-3)">BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17</div><div style="text-align:center"><div id="bjP" style="display:flex;gap:40px;justify-content:center;min-height:108px"></div></div>`));
  $('bjSh').textContent=SHOE.length+' cards';$('bjGo').onclick=()=>this.round()},
 async round(){const st=betVal('bAmt'),pp=Math.max(0,Math.round((+$('bjPP').value||0)*100)/100);if(!spend(st+pp,'blackjack'))return;$('bjGo').disabled=true;sfx('chip');const D=[],H=[{c:[],s:st}];let staked=st+pp,back=0;DEALN++;
  const show=(hide,act)=>{$('bjD').innerHTML=handH(D,{hide,k:dealKey('bjD')});$('bjDt').textContent=hide?bjT([D[0]]).t:bjT(D).t;$('bjP').innerHTML=H.map((h,i)=>`<div><div class="hand">${h.c.map((c,j)=>cardH(c,{k:dealKey('bjH'+i+'-')+j})).join('')}</div><div class="hlab">${H.length>1?'Hand '+(i+1):'You'} <b>${isBJ(h.c)&&H.length===1?'BJ':bjT(h.c).t}</b>${i===act?' ◀':''}${h.r?' · '+h.r:''}</div></div>`).join('');$('bjSh').textContent=SHOE.length+' cards'};
  for(let k=0;k<2;k++){H[0].c.push(draw6());sfx('deal');show(true);await wait(260);D.push(draw6());sfx('deal');show(true);await wait(260)}
  const fin=async()=>{show(false);await wait(400);const live=H.some(h=>bjT(h.c).t<=21&&!(isBJ(h.c)&&H.length===1));
   if(live)while(bjT(D).t<17){D.push(draw6());sfx('card');show(false);await wait(450)}const dt=bjT(D).t;
   for(const h of H){const t=bjT(h.c).t;let r=0;if(t>21)h.r='Bust';else if(isBJ(h.c)&&H.length===1&&!isBJ(D)){r=h.s*2.5;h.r='Blackjack'}else if(isBJ(D)&&!(isBJ(h.c)&&H.length===1)){h.r='Dealer BJ'}else if(dt>21||t>dt){r=h.s*2;h.r='Win'}else if(t===dt){r=h.s;h.r='Push'}else h.r='Lose';back+=r}
   show(false);settle('blackjack',staked,back,H.map(h=>h.r).join(' / '));showRes(back>staked,back>staked?`+${fmt(back)}`:back===staked?'Push':'Dealer wins');$('bjGo').disabled=false};
  if(pp){const [a,b]=H[0].c;if(rk(a)===rk(b)){const k=su(a)===su(b)?26:(su(a)===1||su(a)===2)===(su(b)===1||su(b)===2)?13:8;back+=pp*k;toast(`Perfect Pairs · ${k-1}:1`,'+'+fmt(pp*k),'','cards');sfx('chips')}}
  if(isBJ(D)||isBJ(H[0].c)){await fin();return}
  for(let i=0;i<H.length;i++){const h=H[i];if(h.c.length===1){h.c.push(draw6());sfx('deal')}
   while(bjT(h.c).t<21){show(true,i);const two=h.c.length===2,canSp=two&&H.length===1&&rk(h.c[0])%13===rk(h.c[1])%13||(two&&H.length===1&&Math.min(9,rk(h.c[0]))>=9&&Math.min(9,rk(h.c[1]))>=9&&false),canD=two&&bal()>=h.s,canS=canSp&&bal()>=h.s;
    const a=await acts2([['h','Hit',1,'H'],['s','Stand',0,'S']].concat(canD?[['d','Double',0,'D']]:[]).concat(canS?[['p','Split',0,'P']]:[]));
    if(a==='s')break;if(a==='h'){h.c.push(draw6());sfx('deal');continue}
    if(a==='d'){if(!spend(h.s,'blackjack'))continue;staked+=h.s;h.s*=2;sfx('chip');h.c.push(draw6());sfx('deal');break}
    if(a==='p'){if(!spend(h.s,'blackjack'))continue;staked+=h.s;sfx('chip');H.push({c:[h.c.pop()],s:h.s});h.c.push(draw6());sfx('deal');if(rk(h.c[0])===0){H[1].c.push(draw6());break}}}
   show(true,i);await wait(200)}
  await fin()}});

/* ---------- BACCARAT: 8 decks, the standard third-card rules ---------- */
const bv=c=>Math.min(10,rk(c)+1)%10,bt=cs=>cs.reduce((a,c)=>a+bv(c),0)%10;
game('baccarat',{name:'Baccarat',cat:'cards',glyph:'9',rtp:'98.9%',sim:()=>R()<.45?2:R()<.1?1:0,
 rules:'Bet on Player, Banker or Tie. Closest to 9 wins. Player pays 1 to 1 (98.8%), Banker pays 0.95 to 1 (98.9%), Tie pays 8 to 1 (85.6%, a sucker bet). A pair on either side pays 11 to 1 (89.6%). The third-card rules are the standard tableau.',
 mount(h){let pick='b';gLayout(h,`${betBox('bAmt',10)}<div class="field"><label>Bet on</label><div class="chips">${[['p','Player 1:1'],['b','Banker 0.95:1'],['t','Tie 8:1']].map(([k,l])=>`<button class="chip${k===pick?' on':''}" data-k="${k}">${l}</button>`).join('')}</div></div><div class="field"><label>Side bet: pair (11:1)</label><div class="betin"><span>¢</span><input id="bcPair" type="number" min="0" value="0"></div></div>${BTN('Deal','f lg w','id="bcGo"')}<div class="mono">Road</div><div id="bcR"></div>`,
  tableStage(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:start;margin-top:40px"><div style="text-align:center"><div class="mono" style="margin-bottom:10px">Player</div><div id="bcP" style="min-height:108px"></div><div class="hlab"><b id="bcPt"></b></div></div><div style="text-align:center"><div class="mono" style="margin-bottom:10px">Banker</div><div id="bcB" style="min-height:108px"></div><div class="hlab"><b id="bcBt"></b></div></div></div><div></div>`));
  const road=[];h.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{pick=b.dataset.k;h.querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('on',x===b));sfx('chip')});
  $('bcGo').onclick=async()=>{const st=betVal('bAmt'),pr=Math.max(0,Math.round((+$('bcPair').value||0)*100)/100);if(!spend(st+pr,'baccarat'))return;DEALN++;$('bcGo').disabled=true;const d=deck(8),Pc=[d.pop(),d.pop()],Bc=[d.pop(),d.pop()];
   const show=async(w)=>{$('bcP').innerHTML=handH(Pc,{sp:1,k:dealKey('bcP')});$('bcB').innerHTML=handH(Bc,{sp:1,k:dealKey('bcB')});$('bcPt').textContent=bt(Pc);$('bcBt').textContent=bt(Bc);sfx('deal');await wait(w||500)};
   $('bcP').innerHTML='';$('bcB').innerHTML='';await show(700);
   let p3=null;if(bt(Pc)<8&&bt(Bc)<8){if(bt(Pc)<=5){p3=d.pop();Pc.push(p3);await show()}const b=bt(Bc),v=p3==null?-1:bv(p3);
    const bd=p3==null?b<=5:b<=2||(b===3&&v!==8)||(b===4&&v>=2&&v<=7)||(b===5&&v>=4&&v<=7)||(b===6&&(v===6||v===7));if(bd){Bc.push(d.pop());await show()}}
   const p=bt(Pc),b=bt(Bc),w=p>b?'p':b>p?'b':'t';let ret=0;if(pick===w)ret=w==='p'?st*2:w==='b'?st*1.95:st*9;else if(w==='t')ret=st;
   if(pr&&(rk(Pc[0])===rk(Pc[1])||rk(Bc[0])===rk(Bc[1])))ret+=pr*12;
   road.unshift(w);$('bcR').innerHTML=hist(road,v=>`<i class="${v==='b'?'w':''}">${v==='p'?'P':v==='b'?'B':'T'}</i>`);
   settle('baccarat',st+pr,ret,`${{p:'Player',b:'Banker',t:'Tie'}[pick]} · ${p}-${b}`);showRes(ret>st+pr,`${{p:'Player',b:'Banker',t:'Tie'}[w]} wins ${Math.max(p,b)}${ret?` · ${fmt(ret)}`:''}`);$('bcGo').disabled=false}}});

/* ---------- CASINO WAR: high card wins; a tie goes to war ---------- */
const wv=c=>rk(c)===0?14:rk(c)+1;
game('war',{name:'Casino War',cat:'cards',glyph:'K',rtp:'97.6%',sim:()=>R()<.48?2:0,
 rules:'One card each, aces high. Higher card wins 1 to 1. On a tie, go to war (match your bet, three cards burn, one more each: as high or higher and the raise pays 1 to 1 while your bet pushes) or surrender half. 97.6% going to war.',
 mount(h){gLayout(h,`${betBox('bAmt',10)}${BTN('Deal','f lg w','id="wrGo"')}`,tableStage(`<div style="text-align:center;margin-top:20px"><div class="mono">Dealer</div><div id="wrD" style="min-height:108px;margin-top:10px"></div></div><div style="text-align:center"><div id="wrP" style="min-height:108px"></div><div class="mono" style="margin-top:10px">You</div></div>`));
  $('wrGo').onclick=async()=>{let st=betVal('bAmt');if(!spend(st,'war'))return;DEALN++;$('wrGo').disabled=true;const d=deck(),p=d.pop(),q=d.pop();let staked=st,back=0;$('wrP').innerHTML=handH([p],{k:dealKey('wrP')});sfx('deal');await wait(350);$('wrD').innerHTML=handH([q],{k:dealKey('wrD')});sfx('deal');await wait(400);
   if(wv(p)>wv(q))back=st*2;else if(wv(p)===wv(q)){const a=await acts2([['w','Go to war',1,'W'],['s','Surrender',0,'S']]);
    if(a==='w'&&spend(st,'war')){staked+=st;d.pop();d.pop();d.pop();const p2=d.pop(),q2=d.pop();$('wrP').innerHTML=handH([p,p2],{sp:1,k:dealKey('wrP')});sfx('deal');await wait(400);$('wrD').innerHTML=handH([q,q2],{sp:1,k:dealKey('wrD')});sfx('deal');await wait(400);if(wv(p2)>=wv(q2))back=st*3}else back=st/2}
   settle('war',staked,back,`${RK[rk(p)]} v ${RK[rk(q)]}`);showRes(back>staked,back>staked?`+${fmt(back)}`:back?'Half back':'Dealer wins');$('wrGo').disabled=false}}});

/* ---------- HI-LO: higher or lower, chain it; each call pays 0.97 / its chance ---------- */
game('hilo',{name:'Hi-Lo',cat:'cards',glyph:'↑↓',rtp:'97%',sim:()=>{const k=1+rint(3);return R()<Math.pow(.5,k)?Math.pow(1.94,k):0},
 rules:'A card is shown. Call whether the next is higher or lower (aces low, a tie loses). Each correct call multiplies your stake by 0.97 divided by its chance, so long shots pay more. Skip a card any time, cash out whenever you like.',
 mount(h){let G=null;const pH=r=>(12-r)/13,pL=r=>r/13,m=p=>Math.floor(.97/p*100)/100;
  gLayout(h,`${betBox('bAmt',5)}<div id="hlB"></div><div class="kv"><span>Multiplier</span><b id="hlM">1.00×</b></div><div id="hlTrail" class="hist"></div>`,tableStage(`<div></div><div id="hlC"></div><div></div>`));
  const ui=()=>{const c=G?G.c:null,r=c==null?6:rk(c);$('hlC').innerHTML=c==null?cardH(null):cardH(c,{k:'hl'+(G?G.n=(G.n||0)+(G._c!==c?1:0):0)+'-'+(G&&(G._c=c))});$('hlM').textContent=(G?G.m:1).toFixed(2)+'×';
   $('hlB').innerHTML=G?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${BTN(`Higher · ${pH(r)?m(pH(r)).toFixed(2):'—'}×`,'f','data-c="h"'+(pH(r)?'':' disabled'))}${BTN(`Lower · ${pL(r)?m(pL(r)).toFixed(2):'—'}×`,'f','data-c="l"'+(pL(r)?'':' disabled'))}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${BTN('Skip','','data-c="s"')}${BTN(`Cash out ${fmt(G.s*G.m)}`,'','id="hlCash"'+(G.m>1?'':' disabled'))}</div>`:BTN('Bet','f lg w','id="hlGo"');
   if($('hlGo'))$('hlGo').onclick=()=>{const s=betVal('bAmt');if(!spend(s,'hilo'))return;G={s,m:1,c:rint(52)};$('hlTrail').innerHTML='';sfx('deal');ui()};
   if($('hlCash'))$('hlCash').onclick=()=>{settle('hilo',G.s,G.s*G.m,`${G.m.toFixed(2)}×`);showRes(true,`+${fmt(G.s*G.m)}`);G=null;ui()};
   h.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const r=rk(G.c),n=rint(52),nr=rk(n),k=b.dataset.c;$('hlTrail').insertAdjacentHTML('afterbegin',`<i>${RK[r]}</i>`);sfx('flip');
    if(k==='s'){G.c=n;ui();return}const ok=k==='h'?nr>r:nr<r;if(ok){G.m=Math.floor(G.m*m(k==='h'?pH(r):pL(r))*100)/100;G.c=n;sfx('gem')}else{G.c=n;ui();settle('hilo',G.s,0,`Wrong call at ${G.m.toFixed(2)}×`);showRes(false,`${RK[nr]} · wrong call`);G=null;setTimeout(ui,900);return}ui()})};ui()}});

/* ---------- RED DOG (new): will the third card fall between the first two? ---------- */
game('reddog',{name:'Red Dog',cat:'cards',glyph:'7–J',rtp:'97%',tag:'NEW',sim:()=>R()<.44?2:R()<.06?1:0,
 rules:'Two cards are dealt. If they are consecutive it is a push; if they are a pair, a third card the same rank pays 11 to 1 (otherwise push). Otherwise the spread is the gap between them: you can raise (double your bet), then the third card must fall strictly between. Spread 1 pays 5:1, 2 pays 4:1, 3 pays 2:1, 4 or more pays 1:1. Raise on a spread of 7 or more for the best return, about 97%.',
 mount(h){gLayout(h,`${betBox('bAmt',10)}${BTN('Deal','f lg w','id="rdGo"')}<div class="mono">Pays</div>${[['Spread 1','5:1'],['Spread 2','4:1'],['Spread 3','2:1'],['Spread 4+','1:1'],['Three of a kind','11:1']].map(([a,b])=>`<div class="kv"><span>${a}</span>${b}</div>`).join('')}`,tableStage(`<div></div><div id="rdC" style="display:flex;gap:14px"></div><div id="rdS" class="dn" style="font-size:26px"></div>`));
  $('rdGo').onclick=async()=>{let st=betVal('bAmt');if(!spend(st,'reddog'))return;DEALN++;$('rdGo').disabled=true;const d=deck(),a=d.pop(),b=d.pop(),va=wv(a),vb=wv(b),lo=Math.min(va,vb),hi=Math.max(va,vb);let staked=st,back=0,note='';
   $('rdC').innerHTML=handH([a],{k:dealKey('rdA')})+'<div class="pc back" style="opacity:.25"></div>'+handH([b],{k:dealKey('rdB')});sfx('deal');await wait(500);
   if(va===vb){$('rdS').textContent='Pair · a third the same pays 11:1';await wait(500);const c=d.pop();$('rdC').innerHTML=handH([a,c,b],{sp:1});sfx('flip');back=wv(c)===va?st*12:st;note=wv(c)===va?'Three of a kind':'Pair, push'}
   else if(hi-lo===1){$('rdS').textContent='Consecutive · push';back=st;note='Consecutive'}
   else{const sp=hi-lo-1,pay=sp===1?5:sp===2?4:sp===3?2:1;$('rdS').textContent=`Spread ${sp} · pays ${pay}:1`;const r=await acts2([['r','Raise',1,'R'],['c','Call',0,'C']]);if(r==='r'&&spend(st,'reddog')){staked+=st;sfx('chip')}
    const c=d.pop();$('rdC').innerHTML=handH([a,c,b],{sp:1});sfx('flip');await wait(300);const win=wv(c)>lo&&wv(c)<hi;back=win?staked*(pay+1):0;note=`Spread ${sp}${win?' hit':' missed'}`}
   settle('reddog',staked,back,note);showRes(back>staked,back>staked?`+${fmt(back)}`:back===staked?'Push':'Missed');$('rdGo').disabled=false}}});

/* ---------- VIDEO POKER: Jacks or Better, 9/6 full pay (99.5%) ---------- */
const VP=[['Royal flush',800],['Straight flush',50],['Four of a kind',25],['Full house',9],['Flush',6],['Straight',4],['Three of a kind',3],['Two pair',2],['Jacks or better',1]];
function vpRank(cs){const r=cs.map(c=>rk(c)===0?14:rk(c)+1).sort((a,b)=>a-b),fl=cs.every(c=>su(c)===su(cs[0])),cnt={};r.forEach(v=>cnt[v]=(cnt[v]||0)+1);const g=Object.values(cnt).sort((a,b)=>b-a);
 const st=(new Set(r).size===5&&(r[4]-r[0]===4||r.join()==='2,3,4,5,14'));if(st&&fl&&r[0]===10)return 0;if(st&&fl)return 1;if(g[0]===4)return 2;if(g[0]===3&&g[1]===2)return 3;if(fl)return 4;if(st)return 5;if(g[0]===3)return 6;if(g[0]===2&&g[1]===2)return 7;
 if(g[0]===2){const p=+Object.keys(cnt).find(k=>cnt[k]===2);if(p>=11)return 8}return -1}
game('vpoker',{name:'Video Poker',cat:'poker',glyph:'J+',rtp:'99.5%',sim:()=>R()<.22?1:R()<.13?2:R()<.07?3:0,
 rules:'Jacks or Better, full pay 9/6. You get five cards; hold any, draw the rest once. Pays per credit staked: royal flush 800, straight flush 50, four of a kind 25, full house 9, flush 6, straight 4, three of a kind 3, two pair 2, jacks or better 1 (your stake back). 99.5% with perfect play.',
 mount(h){let G=null;gLayout(h,`${betBox('bAmt',5)}<div id="vpB"></div><div class="mono">Paytable</div><div id="vpT">${VP.map(([n,p],i)=>`<div class="kv" data-v="${i}"><span>${n}</span>${p}</div>`).join('')}</div>`,tableStage(`<div></div><div style="text-align:center"><div id="vpC" style="display:flex;gap:12px"></div><div class="hlab" id="vpL" style="min-height:26px"></div></div><div></div>`));
  const ui=()=>{$('vpC').innerHTML=G?G.c.map((c,i)=>`<div data-i="${i}" style="cursor:${G.st===1?'pointer':'default'};text-align:center">${cardH(c,{cls:G.hold[i]?'hold':'',k:dealKey('vp'+i)})}<div class="mono" style="margin-top:6px;visibility:${G.hold[i]?'visible':'hidden'}">HELD</div></div>`).join(''):[0,1,2,3,4].map(()=>cardH(null)).join('');
   $('vpC').querySelectorAll('[data-i]').forEach(e=>e.onclick=()=>{if(!G||G.st!==1)return;G.hold[+e.dataset.i]^=1;sfx('click');ui()});
   const rnk=G?vpRank(G.c):-1;$('vpT').querySelectorAll('[data-v]').forEach(e=>e.style.background=+e.dataset.v===rnk?'var(--s2)':'');$('vpL').innerHTML=rnk>=0?`<b>${VP[rnk][0]}</b>`:'';
   $('vpB').innerHTML=BTN(G&&G.st===1?'Draw':'Deal','f lg w','id="vpGo"');$('vpGo').onclick=async()=>{if(G&&G.st===1){for(let i=0;i<5;i++)if(!G.hold[i])G.c[i]=G.d.pop();G.st=2;sfx('deal');ui();const r=vpRank(G.c),pay=r>=0?G.s*VP[r][1]:0;settle('vpoker',G.s,pay,r>=0?VP[r][0]:'No win');showRes(pay>G.s,r>=0?`${VP[r][0]} · ${fmt(pay)}`:'No win');return}
    const s=betVal('bAmt');if(!spend(s,'vpoker'))return;DEALN++;const d=deck();G={s,d,c:[d.pop(),d.pop(),d.pop(),d.pop(),d.pop()],hold:[0,0,0,0,0],st:1};sfx('deal');ui()}};ui()}});

/* ---------- THREE CARD POKER: ante and play against a dealer who needs queen high; Pair Plus side bet ---------- */
function tcpRank(cs){const r=cs.map(c=>rk(c)===0?14:rk(c)+1).sort((a,b)=>b-a),fl=cs.every(c=>su(c)===su(cs[0])),st=(r[0]-r[2]===2&&new Set(r).size===3)||r.join()==='14,3,2',tr=r[0]===r[2],pr=!tr&&(r[0]===r[1]||r[1]===r[2]);
 const cat=st&&fl?5:tr?4:st?3:fl?2:pr?1:0,hiR=r.join()==='14,3,2'?[3,2,1]:pr?(r[0]===r[1]?[r[0],r[0],r[2]]:[r[1],r[1],r[0]]):r;return{cat,score:cat*1e6+hiR[0]*1e4+hiR[1]*100+hiR[2],hi:r[0]}}
const TCPN=['High card','Pair','Flush','Straight','Three of a kind','Straight flush'],PPAY={1:1,2:4,3:6,4:30,5:40},ABON={3:1,4:4,5:5};
game('tcp',{name:'Three Card Poker',cat:'poker',glyph:'QQQ',rtp:'98%',sim:()=>R()<.43?2:R()<.1?3:0,
 rules:'Ante, look at your three cards, then Play (match the ante) or Fold. The dealer needs queen high to qualify: if not, the ante pays 1 to 1 and Play pushes. Ante bonus 1/4/5 for a straight, trips or straight flush. Pair Plus pays 1/4/6/30/40 for a pair, flush, straight, trips, straight flush. Play with Q-6-4 or better.',
 mount(h){gLayout(h,`${betBox('bAmt',10)}<div class="field"><label>Pair Plus (optional)</label><div class="betin"><span>¢</span><input id="tcPP" type="number" min="0" value="0"></div></div>${BTN('Deal','f lg w','id="tcGo"')}`,
  tableStage(`<div style="text-align:center;margin-top:20px"><div class="mono">Dealer</div><div id="tcD" style="min-height:108px;margin-top:8px"></div><div class="hlab" id="tcDl"></div></div><div style="text-align:center"><div id="tcP" style="min-height:108px"></div><div class="hlab" id="tcPl"></div></div>`));
  $('tcGo').onclick=async()=>{const an=betVal('bAmt'),pp=Math.max(0,Math.round((+$('tcPP').value||0)*100)/100);if(!spend(an+pp,'tcp'))return;DEALN++;$('tcGo').disabled=true;const d=deck(),Pc=[d.pop(),d.pop(),d.pop()],Dc=[d.pop(),d.pop(),d.pop()];let staked=an+pp,back=0;
   $('tcD').innerHTML=`<div class="hand">${[0,1,2].map(i=>cardH(null,{k:dealKey('tcD')+i})).join('')}</div>`;$('tcP').innerHTML=handH(Pc,{k:dealKey('tcP')});sfx('deal');const P=tcpRank(Pc);$('tcPl').innerHTML=`<b>${TCPN[P.cat]}</b>`;$('tcDl').textContent='';
   if(pp&&PPAY[P.cat])back+=pp*(PPAY[P.cat]+1);
   const a=await acts2([['p','Play',1,'P'],['f','Fold',0,'F']]);let played=false;if(a==='p'&&spend(an,'tcp')){played=true;staked+=an;sfx('chip')}
   $('tcD').innerHTML=handH(Dc,{k:dealKey('tcD')});sfx('flip');const D=tcpRank(Dc);$('tcDl').innerHTML=`<b>${TCPN[D.cat]}</b>${D.cat===0&&D.hi<12?' · does not qualify':''}`;
   if(played){const q=D.cat>0||D.hi>=12;back+=an*(ABON[P.cat]||0);if(!q)back+=an*2+an;else if(P.score>D.score)back+=an*4;else if(P.score===D.score)back+=an*2}
   settle('tcp',staked,back,`${TCPN[P.cat]} v ${TCPN[D.cat]}${played?'':' (fold)'}`);showRes(back>staked,back>staked?`+${fmt(back)}`:played?'Dealer wins':'Folded');$('tcGo').disabled=false}}});
