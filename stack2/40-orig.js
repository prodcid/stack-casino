/* ================= STACK ORIGINALS =================
   Every payout is set from the exact chance so each game returns its stated RTP:
   Dice/Limbo/Crash 99% (mult = 0.99 / chance), Mines/Towers/Coin/Penalty 99% per step, Plinko tables scaled to 99%,
   Lucky Wheel 97%. */
function gLayout(host,side,stage){host.innerHTML=`<div class="gwrap"><div class="gside">${side}</div><div class="gstage" id="gst">${stage}<div class="res" id="gres"></div></div></div>`;wireBet(host,'bAmt')}
function showRes(win,text){const r=$('gres');if(!r)return;r.textContent=text;r.className='res on'+(win?'':' l');clearTimeout(r._t);r._t=setTimeout(()=>r.className='res'+(win?'':' l'),2000)}
function settle(id,stake,pay,detail){pay=Math.round(pay*100)/100;if(pay>0)credit(pay,id);record(id,stake,pay,detail);outcome(pay>stake);sfx(pay>stake?'win':pay>0?'tick':'lose')}
const hist=(arr,fmtF)=>`<div class="hist">${arr.slice(0,12).map(v=>fmtF(v)).join('')}</div>`;

/* ---------- CRASH: one live round at a time, for everyone. Bet before take-off, cash out before it busts. ---------- */
const CR={st:'wait',t:0,m:1,bust:0,hist:[],bet:null,auto:0,players:[],cd:6};
function crashPoint(){const u=R();return Math.max(1,Math.floor(.99/(1-u)*100)/100)}/* P(bust >= m) = 0.99 / m */
function crashLoop(){const dt=.05;
 if(CR.st==='wait'){CR.cd-=dt;if(CR.cd<=0){CR.st='run';CR.t=0;CR.m=1;CR.bust=crashPoint();CR.players=Array.from({length:6+rint(10)},()=>({u:pickA(NAMES),s:pickA([1,5,10,20,50,100,250,1000]),at:Math.max(1.01,Math.round(.99/(1-R())*100)/100*1.0)}));if(CURGAME==='crash')sfx('whoosh');if(typeof microSettle==='function')microSettle('crashStart')}}
 else if(CR.st==='run'){CR.t+=dt;CR.m=Math.floor(Math.pow(Math.E,.07*CR.t*Math.LN2*1.6)*100)/100;
  if(CR.bet&&!CR.bet.out&&CR.bet.auto&&CR.m>=CR.bet.auto&&CR.bet.auto<=CR.bust)crashCash(CR.bet.auto);
  if(CR.m>=CR.bust){CR.m=CR.bust;CR.st='bust';CR.cd=3;CR.hist.unshift(CR.bust);CR.hist.length=Math.min(CR.hist.length,20);if(CURGAME==='crash')sfx('crash');
   if(CR.bet&&!CR.bet.out){settle('crash',CR.bet.s,0,`Busted at ${CR.bust.toFixed(2)}×`);showRes(false,`Busted · ${CR.bust.toFixed(2)}×`)}CR.bet=null;
   CR.players.forEach(p=>feedPush({u:p.u,g:'crash',s:p.s,m:p.at<=CR.bust?p.at:0,p:p.at<=CR.bust?p.s*p.at:0}));if(typeof microSettle==='function')microSettle('crashBust',null,CR.bust)}}
 else if(CR.st==='bust'){CR.cd-=dt;if(CR.cd<=0){CR.st='wait';CR.cd=6}}
 if(CURGAME==='crash')crashDraw()}
setInterval(crashLoop,50);
function crashCash(at){const b=CR.bet;if(!b||b.out||CR.st!=='run')return;at=at||CR.m;b.out=at;settle('crash',b.s,b.s*at,`Cashed out ${at.toFixed(2)}×`);showRes(true,`Cashed out ${at.toFixed(2)}× · +${fmt(b.s*at)}`);sfx('cash')}
game('crash',{name:'Crash',cat:'orig',glyph:'2.41×',rtp:'99%',tag:'LIVE',inv:1,sim:()=>{const c=crashPoint(),t=Math.max(1.01,1+R()*3);return t<=c?t:0},
 rules:'A multiplier climbs from 1.00× and busts at a random point. Bet during the countdown, then cash out any time before it busts. Set an auto cash-out to lock a target. The bust point is set so every bet returns 99% on average: the chance it reaches m× is 0.99 / m.',
 mount(h){gLayout(h,`${betBox('bAmt',5)}<div class="field"><label>Auto cash-out (optional)</label><input class="inp" id="crAuto" type="number" min="1.01" step=".01" placeholder="e.g. 2.00"></div><div id="crBtn"></div><div class="mono">Round history</div><div id="crH"></div><div class="mono">Players this round</div><div id="crP" style="max-height:180px;overflow:auto"></div>`,`<canvas id="crC" style="position:absolute;inset:0;width:100%;height:100%"></canvas><div id="crM" class="dn" style="position:relative;font-size:84px;z-index:2"></div>`);
  this.btn()},
 btn(){const b=$('crBtn');if(!b)return;const st=CR.st,bet=CR.bet;b.innerHTML=bet&&!bet.out&&st==='run'?BTN(`Cash out ${fmt(bet.s*CR.m)}`,'f lg w','id="crGo"'):bet&&st==='wait'?BTN('Cancel bet','lg w','id="crGo"'):BTN(st==='wait'?'Place bet':'Bet next round','f lg w','id="crGo"');
  $('crGo').onclick=()=>{if(CR.bet&&!CR.bet.out&&CR.st==='run')return crashCash();if(CR.bet&&CR.st==='wait'){credit(CR.bet.s,'crash');P().bets--;CR.bet=null;this.btn();return}
   if(CR.st!=='wait'){toast('Next round','Bets open during the countdown','lt');return}const s=betVal('bAmt');if(!spend(s,'crash'))return;const a=+$('crAuto').value;CR.bet={s,auto:a>=1.01?a:0};sfx('bet');this.btn()}},
 leave(){}});
let crLastBtn='';function crashDraw(){const c=$('crC');if(!c)return;const r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(r.width*d)){c.width=r.width*d;c.height=r.height*d}const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);
 const W=r.width,H=r.height,ink=getComputedStyle(document.documentElement).getPropertyValue('--ink');x.clearRect(0,0,W,H);
 if(CR.st!=='wait'){const T=Math.max(6,CR.t),M=Math.max(2,CR.m*1.15),X0=50,Y0=H-40,px=t=>X0+t/T*(W-90),py=m=>Y0-(m-1)/(M-1)*(H-90);x.strokeStyle=ink;x.globalAlpha=.12;x.lineWidth=1;
  for(let m=1;m<=M;m+=Math.max(.5,Math.round((M-1)/4*2)/2)){x.beginPath();x.moveTo(X0,py(m));x.lineTo(W-30,py(m));x.stroke();x.globalAlpha=.4;x.font='500 11px IBM Plex Mono';x.fillStyle=ink;x.fillText(m.toFixed(1)+'×',8,py(m)+4);x.globalAlpha=.12}
  x.globalAlpha=1;x.lineWidth=4;x.lineCap='round';x.beginPath();for(let i=0;i<=60;i++){const t=CR.t*i/60,m=Math.pow(Math.E,.07*t*Math.LN2*1.6);i?x.lineTo(px(t),py(Math.min(m,CR.m))):x.moveTo(px(t),py(m))}x.stroke();
  x.lineTo(px(CR.t),Y0);x.lineTo(X0,Y0);x.closePath();x.globalAlpha=.07;x.fillStyle=ink;x.fill();x.globalAlpha=1;
  if(CR.st==='run'){x.beginPath();x.arc(px(CR.t),py(CR.m),8,0,7);x.fillStyle=ink;x.fill()}}
 $('crM').textContent=CR.st==='wait'?`Starts in ${CR.cd.toFixed(1)}s`:CR.m.toFixed(2)+'×';$('crM').style.fontSize=CR.st==='wait'?'40px':'84px';$('crM').style.textDecoration=CR.st==='bust'?'line-through':'';
 const key=CR.st+(CR.bet?CR.bet.out||'b':'')+(CR.st==='run'&&CR.bet&&!CR.bet.out?Math.floor(CR.m*10):'');if(key!==crLastBtn){crLastBtn=key;GAMES.crash.btn()}
 if(CR.st==='run'&&CR.bet&&!CR.bet.out){const g=$('crGo');if(g)g.lastChild.textContent=`Cash out ${fmt(CR.bet.s*CR.m)}`}
 $('crH').innerHTML=hist(CR.hist,v=>`<i class="${v>=2?'w':''}">${v.toFixed(2)}×</i>`);
 $('crP').innerHTML=CR.players.map(p=>`<div class="kv" style="padding:6px 0;font-size:12.5px"><span>${esc(p.u)}</span><span>${fmt(p.s)} ${CR.st!=='wait'&&p.at<=CR.m?`<b style="color:var(--ink)">@ ${p.at.toFixed(2)}×</b>`:CR.st==='bust'?'<s>bust</s>':''}</span></div>`).join('')}

/* ---------- DICE: roll 0.00-99.99, over or under your target ---------- */
game('dice',{name:'Dice',cat:'orig',glyph:'50.5',rtp:'99%',sim:()=>{const c=.05+R()*.9;return R()<c?.99/c:0},
 rules:'Pick a target and roll over or under it. The lower the chance, the bigger the payout: multiplier = 99 / win chance (%), so every bet returns 99%.',
 mount(h){let tgt=50,over=1;const s=this;gLayout(h,`${betBox('bAmt',5)}<div class="field"><label>Roll</label><div class="chips"><button class="chip on" data-o="1">Roll over</button><button class="chip" data-o="0">Roll under</button></div></div>
   <div class="hgrid" style="grid-template-columns:1fr 1fr 1fr;border-radius:10px"><div style="padding:10px"><span class="mono">Multiplier</span><div class="dn" id="dM"></div></div><div style="padding:10px"><span class="mono">Target</span><div class="dn" id="dT"></div></div><div style="padding:10px"><span class="mono">Chance</span><div class="dn" id="dC"></div></div></div>${BTN('Roll dice','f lg w','id="dGo"')}<div id="dH"></div>`,
  `<div style="width:80%"><div class="dn" id="dR" style="font-size:96px;text-align:center;line-height:1">50.00</div><input type="range" id="dS" min="2" max="98" step="1" value="50" style="width:100%;accent-color:var(--ink);margin-top:30px"><div style="position:relative;height:8px;border-radius:999px;background:var(--line);margin-top:8px"><i id="dBar" style="position:absolute;top:0;bottom:0;background:var(--ink);border-radius:999px"></i><b id="dMark" style="position:absolute;top:-10px;width:4px;height:28px;background:var(--ink);transition:left .5s var(--back)"></b></div></div>`);
  const H=[];const up=()=>{const ch=over?100-tgt:tgt,m=99/ch;$('dM').textContent=m.toFixed(4)+'×';$('dT').textContent=(over?'>':'<')+tgt.toFixed(2);$('dC').textContent=ch.toFixed(2)+'%';const b=$('dBar');b.style.left=over?tgt+'%':'0';b.style.right=over?'0':(100-tgt)+'%'};up();
  $('dS').oninput=()=>{tgt=+$('dS').value;sfx('tick');up()};h.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{over=+b.dataset.o;h.querySelectorAll('[data-o]').forEach(x=>x.classList.toggle('on',x===b));up()});
  $('dGo').onclick=async()=>{const st=betVal('bAmt');if(!spend(st,'dice'))return;$('dGo').disabled=true;sfx('shake');for(let i=0;i<8;i++){$('dR').textContent=(R()*100).toFixed(2);await wait(35)}
   const r=Math.floor(R()*10000)/100,win=over?r>tgt:r<tgt,ch=over?100-tgt:tgt,m=99/ch;$('dR').textContent=r.toFixed(2);$('dMark').style.left=r+'%';sfx('dice');
   settle('dice',st,win?st*m:0,`${over?'Over':'Under'} ${tgt} · rolled ${r.toFixed(2)}`);showRes(win,win?`+${fmt(st*m)}`:`Rolled ${r.toFixed(2)}`);H.unshift([r,win]);$('dH').innerHTML=hist(H,v=>`<i class="${v[1]?'w':''}">${v[0].toFixed(2)}</i>`);$('dGo').disabled=false}}});

/* ---------- LIMBO: pick a target multiplier; the roll has to reach it ---------- */
game('limbo',{name:'Limbo',cat:'orig',glyph:'1000×',rtp:'99%',sim:()=>{const t=pickA([1.5,2,2,3,5,10]);return R()<.99/t?t:0},
 rules:'Choose a target multiplier. A random result is drawn; if it is at least your target you win target × stake. The chance is exactly 0.99 / target.',
 mount(h){gLayout(h,`${betBox('bAmt',5)}<div class="field"><label>Target multiplier</label><input class="inp" id="lT" type="number" min="1.01" step=".01" value="2.00"></div><div class="kv"><span>Win chance</span><b id="lC"></b></div>${BTN('Bet','f lg w','id="lGo"')}<div id="lH"></div>`,`<div class="dn" id="lR" style="font-size:120px">1.00×</div>`);
  const H=[],up=()=>{$('lC').textContent=(99/Math.max(1.01,+$('lT').value||2)).toFixed(4)+'%'};up();$('lT').oninput=up;
  $('lGo').onclick=async()=>{const st=betVal('bAmt'),t=Math.max(1.01,+$('lT').value||2);if(!spend(st,'limbo'))return;$('lGo').disabled=true;const res=Math.max(1,Math.floor(.99/(1-R())*100)/100),win=res>=t;
   const t0=performance.now();await new Promise(r=>{(function f(n){const p=Math.min(1,(n-t0)/650),v=1+(res-1)*(1-Math.pow(1-p,3));$('lR').textContent=v.toFixed(2)+'×';sfx('tickup');p<1?requestAnimationFrame(f):r()})(t0)});
   settle('limbo',st,win?st*t:0,`Target ${t.toFixed(2)}× · result ${res.toFixed(2)}×`);showRes(win,win?`+${fmt(st*t)}`:`${res.toFixed(2)}×`);H.unshift([res,win]);$('lH').innerHTML=hist(H,v=>`<i class="${v[1]?'w':''}">${v[0].toFixed(2)}×</i>`);$('lGo').disabled=false}}});

/* ---------- PLINKO: 12 rows, three risk levels; each table is scaled so it returns exactly 99% ---------- */
const PLK_BASE={low:[10,3,1.6,1.4,1.1,1,.5,1,1.1,1.4,1.6,3,10],mid:[33,11,4,2,1.1,.6,.3,.6,1.1,2,4,11,33],high:[170,24,8.1,2,.7,.2,.2,.2,.7,2,8.1,24,170]};
const binom12=k=>{let c=1;for(let i=0;i<k;i++)c=c*(12-i)/(i+1);return c/4096};
const PLK={};for(const [k,t] of Object.entries(PLK_BASE)){const ev=t.reduce((a,m,i)=>a+m*binom12(i),0);PLK[k]=t.map(m=>Math.floor(m*.99/ev*100)/100)}
game('plinko',{name:'Plinko',cat:'orig',glyph:'×16',rtp:'99%',sim:()=>{let k=0;for(let i=0;i<12;i++)k+=R()<.5;return PLK.mid[k]},
 rules:'Drop a ball through 12 rows of pegs. It lands in one of 13 slots, each with a multiplier. Pick low, medium or high risk; every table is scaled to return 99%.',
 mount(h){let risk='mid';gLayout(h,`${betBox('bAmt',1)}<div class="field"><label>Risk</label><div class="chips">${['low','mid','high'].map(r=>`<button class="chip${r===risk?' on':''}" data-r="${r}">${r==='mid'?'Medium':r[0].toUpperCase()+r.slice(1)}</button>`).join('')}</div></div>${BTN('Drop ball','f lg w','id="pGo"')}<p class="mut" style="font-size:12px">Drop as many balls as you like at once.</p>`,`<canvas id="pC" style="width:100%;height:100%;position:absolute;inset:0"></canvas>`);
  const balls=[];let raf=0,last=performance.now();const c=$('pC');
  h.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{if(balls.length)return;risk=b.dataset.r;h.querySelectorAll('[data-r]').forEach(x=>x.classList.toggle('on',x===b))});
  const geo=()=>{const r=c.getBoundingClientRect(),W=r.width,H=r.height,top=50,gap=Math.min((H-120)/13,(W-60)/14);return{W,H,top,gap}};
  const draw=n=>{const r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(r.width*d)){c.width=r.width*d;c.height=r.height*d}const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);const {W,H,top,gap}=geo(),ink=getComputedStyle(document.documentElement).getPropertyValue('--ink'),srf=getComputedStyle(document.documentElement).getPropertyValue('--surface');
   const dt=Math.min(.05,(n-last)/1000);last=n;x.clearRect(0,0,W,H);x.fillStyle=ink;for(let row=0;row<12;row++)for(let i=0;i<=row+2;i++){x.beginPath();x.arc(W/2+(i-(row+2)/2)*gap,top+row*gap,3.2,0,7);x.fill()}
   const sy=top+12*gap;PLK[risk].forEach((m,i)=>{const sx=W/2+(i-6)*gap,hot=balls.some(b=>b.k===i&&b.fl>0);x.fillStyle=hot?ink:srf;x.strokeStyle=ink;x.lineWidth=1.5;x.beginPath();x.roundRect?x.roundRect(sx-gap/2+2,sy,gap-4,30,6):x.rect(sx-gap/2+2,sy,gap-4,30);x.fill();x.stroke();x.fillStyle=hot?srf:ink;x.font=`700 ${gap<34?10:11.5}px Bricolage Grotesque`;x.textAlign='center';x.fillText(m+'×',sx,sy+19)});
   for(let j=balls.length-1;j>=0;j--){const b=balls[j];b.p+=dt*2.6;const step=Math.floor(b.p);if(b.fl>0){b.fl-=dt;if(b.fl<=0)balls.splice(j,1);continue}
    if(step>=12){b.fl=.5;b.k=b.path.reduce((a,v)=>a+v,0);const m=PLK[risk][b.k];settle('plinko',b.s,b.s*m,`${risk} risk · ${m}×`);if(m>=2)showRes(true,`${m}× · +${fmt(b.s*m)}`);continue}
    if(step!==b.ls){b.ls=step;sfx('peg')}const f=b.p-step,cx=b.path.slice(0,step).reduce((a,v)=>a+(v?.5:-.5),0),nx=cx+(b.path[step]?.5:-.5),bx=W/2+(cx+(nx-cx)*f)*gap,by=top+(step-1+f)*gap-Math.sin(f*Math.PI)*gap*.35;
    x.beginPath();x.arc(bx,by,7,0,7);x.fillStyle=ink;x.fill()}
   raf=requestAnimationFrame(draw)};raf=requestAnimationFrame(draw);this._raf=()=>cancelAnimationFrame(raf);
  $('pGo').onclick=()=>{const s=betVal('bAmt');if(!spend(s,'plinko'))return;sfx('bet');balls.push({s,p:0,ls:-1,fl:0,path:Array.from({length:12},()=>R()<.5?1:0)})}},leave(){this._raf&&this._raf()}});

/* ---------- MINES: a 5x5 field. Each safe tile raises the payout; hit a mine and it's gone ---------- */
const mineMult=(m,k)=>{let p=1;for(let i=0;i<k;i++)p*=(25-m-i)/(25-i);return k?Math.floor(.99/p*100)/100:1};
game('mines',{name:'Mines',cat:'orig',glyph:'24',rtp:'99%',sim:()=>{const m=pickA([3,3,5,10]),k=1+rint(5);let p=1;for(let i=0;i<k;i++)p*=(25-m-i)/(25-i);return R()<p?mineMult(m,k):0},
 rules:'Pick how many mines hide in the 25 tiles, then reveal tiles one by one. Every safe tile raises your multiplier; cash out whenever you like. The multiplier after k safe tiles is 0.99 divided by the chance of k safe tiles in a row.',
 mount(h){let G=null;gLayout(h,`${betBox('bAmt',5)}<div class="field"><label>Mines</label><select class="inp" id="mN">${[1,2,3,4,5,6,8,10,15,20,24].map(n=>`<option ${n===3?'selected':''}>${n}</option>`).join('')}</select></div><div class="kv"><span>Next tile</span><b id="mNx"></b></div><div id="mB"></div>`,
  `<div id="mG" style="display:grid;grid-template-columns:repeat(5,86px);gap:10px"></div>`);
  const grid=()=>{$('mG').innerHTML=Array.from({length:25},(_,i)=>{const o=G&&G.open[i],bomb=G&&G.mines.has(i),show=o||(G&&G.over);return `<button data-i="${i}" style="width:86px;height:86px;border-radius:14px;border:1.5px solid var(--ink);background:${show?(bomb?'var(--ink)':'var(--surface)'):'var(--s2)'};color:${bomb?'var(--surface)':'var(--ink)'};font:700 28px var(--disp);opacity:${show&&!o?.4:1};transition:transform .2s var(--back)">${show?(bomb?'✕':'◆'):''}</button>`}).join('');
   $('mG').querySelectorAll('button').forEach(b=>b.onclick=()=>pick(+b.dataset.i));const m=+$('mN').value,k=G?G.k:0;$('mNx').textContent=mineMult(m,k+1).toFixed(2)+'×';
   $('mB').innerHTML=G&&!G.over?BTN(`Cash out ${fmt(G.s*mineMult(G.m,G.k))}`,'f lg w','id="mGo"'+(G.k?'':' disabled')):BTN('Bet','f lg w','id="mGo"');
   $('mGo').onclick=()=>{if(G&&!G.over){const m=mineMult(G.m,G.k);G.over=1;settle('mines',G.s,G.s*m,`${G.m} mines · ${G.k} gems`);showRes(true,`${m}× · +${fmt(G.s*m)}`);sfx('cash');grid();return}
    const s=betVal('bAmt'),m=+$('mN').value;if(!spend(s,'mines'))return;const mines=new Set();while(mines.size<m)mines.add(rint(25));G={s,m,mines,open:{},k:0,over:0};sfx('bet');grid()}};
  const pick=i=>{if(!G||G.over||G.open[i])return;G.open[i]=1;if(G.mines.has(i)){G.over=1;sfx('bomb');settle('mines',G.s,0,`${G.m} mines · hit a mine after ${G.k}`);showRes(false,'Boom')}else{G.k++;sfx('gem');if(G.k===25-G.m){const m=mineMult(G.m,G.k);G.over=1;settle('mines',G.s,G.s*m,`${G.m} mines · cleared`);showRes(true,`${m}×`)}}grid()};
  $('mN').onchange=()=>{if(!G||G.over)grid()};grid()}});

/* ---------- TOWERS: climb 8 floors; 2 of 3 doors are safe on every floor ---------- */
game('towers',{name:'Towers',cat:'orig',glyph:'8F',rtp:'99%',sim:()=>{const k=1+rint(5);return R()<Math.pow(2/3,k)?.99*Math.pow(1.5,k):0},
 rules:'Every floor has three doors and one trap. Pick a safe door to climb; each floor multiplies your stake by 1.5 (×0.99 house edge on the total). Cash out any time, or reach floor 8.',
 mount(h){let G=null;const mult=k=>Math.floor(.99*Math.pow(1.5,k)*100)/100;gLayout(h,`${betBox('bAmt',5)}<div id="tB"></div><div class="mono">Floors pay</div><div class="hist">${[1,2,3,4,5,6,7,8].map(k=>`<i>${k}: ${mult(k)}×</i>`).join('')}</div>`,`<div id="tG" style="display:flex;flex-direction:column-reverse;gap:8px"></div>`);
  const draw=()=>{$('tG').innerHTML=Array.from({length:8},(_,f)=>`<div style="display:flex;gap:8px;align-items:center"><span class="mono" style="width:56px">${mult(f+1)}×</span>${[0,1,2].map(d=>{const cur=G&&!G.over&&f===G.k,done=G&&G.path[f]!=null,trap=G&&(G.over||done)&&G.traps[f]===d,picked=G&&G.path[f]===d;
    return `<button data-f="${f}" data-d="${d}" style="width:110px;height:46px;border-radius:10px;border:1.5px solid var(--ink);background:${picked?'var(--ink)':cur?'var(--surface)':'var(--s2)'};color:${picked?'var(--surface)':'var(--ink)'};font:700 18px var(--disp);opacity:${cur||done||(G&&G.over)?1:.45}">${trap&&(G.over||picked)?'✕':picked?'◆':''}</button>`}).join('')}</div>`).join('');
   $('tG').querySelectorAll('button').forEach(b=>b.onclick=()=>step(+b.dataset.f,+b.dataset.d));
   $('tB').innerHTML=G&&!G.over?BTN(`Cash out ${fmt(G.s*mult(G.k))}`,'f lg w','id="tGo"'+(G.k?'':' disabled')):BTN('Bet','f lg w','id="tGo"');
   $('tGo').onclick=()=>{if(G&&!G.over){G.over=1;settle('towers',G.s,G.s*mult(G.k),`Floor ${G.k}`);showRes(true,`${mult(G.k)}×`);draw();return}const s=betVal('bAmt');if(!spend(s,'towers'))return;G={s,k:0,traps:Array.from({length:8},()=>rint(3)),path:[],over:0};sfx('bet');draw()}};
  const step=(f,d)=>{if(!G||G.over||f!==G.k)return;G.path[f]=d;if(G.traps[f]===d){G.over=1;sfx('bomb');settle('towers',G.s,0,`Trap on floor ${f+1}`);showRes(false,'Trap')}else{G.k++;sfx('gem');if(G.k===8){G.over=1;settle('towers',G.s,G.s*mult(8),'Top floor');showRes(true,`${mult(8)}×`)}}draw()};draw()}});

/* ---------- COIN FLIP STREAK (new): call it, double it, keep going or bank ---------- */
game('coin',{name:'Coin Flip',cat:'orig',glyph:'1.98×',rtp:'99%',tag:'NEW',sim:()=>{const k=1+rint(4);return R()<Math.pow(.5,k)?Math.pow(1.98,k):0},
 rules:'Call heads or tails. Every right call multiplies your stake by 1.98. Keep flipping to build a streak, or bank it whenever you like. One wrong call loses the lot.',
 mount(h){let G=null;gLayout(h,`${betBox('bAmt',5)}<div id="cB"></div><div class="kv"><span>Streak</span><b id="cS">0</b></div><div class="kv"><span>Current</span><b id="cV">0.00</b></div><div id="cH"></div>`,
  `<div style="perspective:800px"><div id="cC" style="width:200px;height:200px;border-radius:50%;border:3px solid var(--ink);display:grid;place-items:center;font:800 64px var(--disp);background:var(--surface);transition:transform 1s var(--out);transform-style:preserve-3d">S</div></div>`);
  let rot=0;const H=[];const ui=()=>{$('cS').textContent=G?G.k:0;$('cV').textContent=G?fmt(G.s*Math.pow(1.98,G.k)):'0.00';
   $('cB').innerHTML=G?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${BTN('Heads','f','data-c="H"')}${BTN('Tails','f','data-c="T"')}</div>${BTN(`Bank ${fmt(G.s*Math.pow(1.98,G.k))}`,'lg w','id="cBank"'+(G.k?'':' disabled'))}`:BTN('Bet and flip','f lg w','id="cGo"');
   if($('cGo'))$('cGo').onclick=()=>{const s=betVal('bAmt');if(!spend(s,'coin'))return;G={s,k:0};sfx('bet');ui()};
   if($('cBank'))$('cBank').onclick=()=>{const v=G.s*Math.pow(1.98,G.k);settle('coin',G.s,v,`Streak of ${G.k}`);showRes(true,`+${fmt(v)}`);G=null;ui()};
   h.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{h.querySelectorAll('[data-c]').forEach(x=>x.disabled=true);const r=R()<.5?'H':'T';rot+=1440+(r==='T'?180:0)-(rot%360);$('cC').style.transform=`rotateY(${rot}deg)`;sfx('whoosh');await wait(1000);
    $('cC').textContent=r==='H'?'S':'○';H.unshift(r);$('cH').innerHTML=hist(H,v=>`<i class="${v==='H'?'w':''}">${v==='H'?'Heads':'Tails'}</i>`);
    if(r===b.dataset.c){G.k++;sfx('gem');showRes(true,`${Math.pow(1.98,G.k).toFixed(2)}×`)}else{settle('coin',G.s,0,`Streak ended at ${G.k}`);showRes(false,'Wrong call');G=null}ui()})};ui()}});

/* ---------- PENALTY SHOOTOUT (new): pick a corner; the keeper covers two of five ---------- */
game('penalty',{name:'Penalty Shootout',cat:'orig',glyph:'GOAL',rtp:'99%',tag:'NEW',sim:()=>{const k=1+rint(3);return R()<Math.pow(.6,k)?Math.pow(1.65,k):0},
 rules:'Pick one of five spots. The keeper dives to cover two of them at random. Score and your stake multiplies by 1.65; shoot again or bank. Five goals in a row is the max.',
 mount(h){let G=null;const step=1.65;gLayout(h,`${betBox('bAmt',5)}<div id="pkB"></div><div class="kv"><span>Goals</span><b id="pkS">0</b></div><div class="kv"><span>Bank</span><b id="pkV">0.00</b></div>`,
  `<div style="text-align:center"><div style="position:relative;width:520px;height:220px;border:4px solid var(--ink);border-bottom:0;border-radius:6px 6px 0 0;background:repeating-linear-gradient(90deg,transparent 0 24px,var(--line) 24px 25px),repeating-linear-gradient(0deg,transparent 0 24px,var(--line) 24px 25px)"><div id="pkK" style="position:absolute;bottom:0;left:50%;width:110px;height:150px;transform:translateX(-50%);transition:left .45s var(--out),transform .45s var(--out)"><svg viewBox="0 0 60 80" style="width:100%;height:100%"><circle cx="30" cy="12" r="10" fill="var(--ink)"/><path d="M14 30h32v26H14zM14 32L2 14M46 32l12-18M20 56v22M40 56v22" stroke="var(--ink)" stroke-width="7" stroke-linecap="round" fill="var(--ink)"/></svg></div>
   <div id="pkSp" style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(5,1fr)"></div><div id="pkBall" style="position:absolute;left:50%;bottom:-60px;width:34px;height:34px;border-radius:50%;background:var(--surface);border:3px solid var(--ink);transform:translateX(-50%);transition:all .45s var(--out)"></div></div><div style="height:70px"></div></div>`);
  const ui=()=>{$('pkS').textContent=G?G.k:0;$('pkV').textContent=G?fmt(G.s*Math.pow(step,G.k)):'0.00';
   $('pkSp').innerHTML=[0,1,2,3,4].map(i=>`<button data-s="${i}" ${G&&!G.busy?'':'disabled'} style="border-right:${i<4?'1px dashed var(--ink-3)':0};font:700 12px var(--mono);color:var(--ink-3)">${G&&!G.busy?'SHOOT':''}</button>`).join('');
   $('pkB').innerHTML=G?BTN(`Bank ${fmt(G.s*Math.pow(step,G.k))}`,'lg w','id="pkBank"'+(G.k?'':' disabled')):BTN('Bet and take a penalty','f lg w','id="pkGo"');
   if($('pkGo'))$('pkGo').onclick=()=>{const s=betVal('bAmt');if(!spend(s,'penalty'))return;G={s,k:0};sfx('whistle');ui()};
   if($('pkBank'))$('pkBank').onclick=()=>{const v=G.s*Math.pow(step,G.k);settle('penalty',G.s,v,`${G.k} goals`);showRes(true,`+${fmt(v)}`);G=null;ui()};
   $('pkSp').querySelectorAll('button').forEach(b=>b.onclick=async()=>{if(!G||G.busy)return;G.busy=1;ui();const s=+b.dataset.s,dive=rint(5),cover=[dive,(dive+1)%5];/* the keeper covers two neighbouring spots (wrapping round), so every spot is saved exactly 2 times in 5 */
    const kp=$('pkK'),bl=$('pkBall');kp.style.left=(dive===4?10:(dive+1)/5*100)+'%';kp.style.transform=`translateX(-50%) rotate(${(dive===4?-1.5:dive-1.5)*-28}deg)`;bl.style.left=((s+.5)/5*100)+'%';bl.style.bottom='120px';sfx('whoosh');await wait(500);
    if(cover.includes(s)){sfx('lose');settle('penalty',G.s,0,`Saved after ${G.k} goals`);showRes(false,'Saved!');G=null}else{G.k++;sfx('goal');showRes(true,`GOAL · ${Math.pow(step,G.k).toFixed(2)}×`);G.busy=0;if(G.k===5){const v=G.s*Math.pow(step,5);settle('penalty',G.s,v,'Five goals');G=null}}
    await wait(700);kp.style.left='50%';kp.style.transform='translateX(-50%)';bl.style.left='50%';bl.style.bottom='-60px';ui()})};ui()}});

/* ---------- LUCKY WHEEL (table games): 50 segments, weights set to 97% ---------- */
const LW=[[0,31],[1.5,10],[2,4],[3,2],[5,2],[10,1]];/* [multiplier, segments] */
const LWsegs=(()=>{const a=[];LW.forEach(([m,n])=>{for(let i=0;i<n;i++)a.push(m)});for(let i=a.length-1;i>0;i--){const j=(i*7+3)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a})();
const LWev=LWsegs.reduce((s,m)=>s+m,0)/LWsegs.length;
game('wheel',{name:'Lucky Wheel',cat:'table',glyph:'×10',rtp:(LWev*100).toFixed(0)+'%',sim:()=>pickA(LWsegs),
 rules:`A 50-segment wheel. One spin, one multiplier: ${LW.map(([m,n])=>m+'× on '+n).join(', ')}. That returns ${(LWev*100).toFixed(0)}%.`,
 mount(h){let rot=0;gLayout(h,`${betBox('bAmt',5)}${BTN('Spin','f lg w','id="wGo"')}<div class="mono">Segments</div>${LW.map(([m,n])=>`<div class="kv"><span>${m}×</span>${n} of 50</div>`).join('')}`,
  `<div style="position:relative;width:440px;height:440px"><svg viewBox="-110 -110 220 220" id="wS" style="width:100%;height:100%;transition:transform 5s cubic-bezier(.16,1,.3,1)">${LWsegs.map((m,i)=>{const a0=i/50*6.283-1.571,a1=(i+1)/50*6.283-1.571,dark=m>=3||m===0;return `<path d="M0 0L${Math.cos(a0)*100} ${Math.sin(a0)*100}A100 100 0 0 1 ${Math.cos(a1)*100} ${Math.sin(a1)*100}Z" fill="${m===0?'var(--s2)':dark?'var(--ink)':'var(--surface)'}" stroke="var(--ink)" stroke-width=".6"/><text transform="rotate(${(i+.5)*7.2}) translate(0 -86)" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="6" fill="${dark&&m?'var(--surface)':'var(--ink)'}">${m?m+'×':''}</text>`}).join('')}<circle r="30" fill="var(--ink)"/></svg>
   <div style="position:absolute;left:50%;top:-10px;transform:translateX(-50%);border-left:14px solid transparent;border-right:14px solid transparent;border-top:26px solid var(--ink)"></div></div>`);
  $('wGo').onclick=async()=>{const s=betVal('bAmt');if(!spend(s,'wheel'))return;$('wGo').disabled=true;const k=rint(50),m=LWsegs[k];rot+=5*360+((360-(k+.5)*7.2)-rot%360+360)%360;$('wS').style.transform=`rotate(${rot}deg)`;sfx('spin');
   let n=0;const tk=setInterval(()=>{sfx('peg');if(++n>45)clearInterval(tk)},100);await wait(5100);settle('wheel',s,s*m,`${m}×`);showRes(m>1,m?`${m}× · ${fmt(s*m)}`:'0×');$('wGo').disabled=false}}});
