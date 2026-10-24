/* ================= SPORTS UI (v2.2): its own look, live trackers, bet builder =================
   Sports has its own identity (body.spm: deep navy, lime, team colours, condensed scoreboard type), separate from the
   black-and-white casino. Every live match has a visual tracker that needs no physics engine: football is a pitch
   where play moves between "safe", "attack" and "dangerous attack" driven by the engine's per-minute momentum, with
   scripted corners and goals; basketball is a court with the real shot chart; tennis is a court where every point
   plays out as a rally of the right length. Same-game multis (bet builder) are priced jointly from the match model:
   football exactly over the score grid, basketball and tennis by simulation, at 96% (bet builder margin). */
const TCOL={'Northbank FC':['#e63946','#fff'],'Riverside Utd':['#1d6fe0','#fff'],'Harbour City':['#00a6a6','#062'],'Kingsway':['#7b2ff7','#fff'],'Stonebridge':['#f4a300','#221'],'Ashford Town':['#2a9d3f','#fff'],'Westgate':['#ff6b1a','#fff'],'Millhaven':['#c2185b','#fff'],'Redcliffe':['#b5121b','#fff'],'Port Elm':['#3a86ff','#fff'],
 'Metro Kings':['#5b2cff','#fff'],'Coast Hawks':['#0aa5c9','#fff'],'Summit Bears':['#8a5a2b','#fff'],'Valley Wolves':['#4a5568','#fff'],'Harbor Tide':['#00b386','#fff'],'Desert Suns':['#ff8c00','#fff']};
const PAL=['#c8f53a','#ff6ad5','#46e0ff','#f2b632','#ff6b1a','#9b7bff'],tc=n=>TCOL[n]?TCOL[n][0]:PAL[[...n].reduce((a,c)=>a+c.charCodeAt(0),0)%PAL.length];
const SPICON={football:'⚽',basketball:'🏀',tennis:'🎾'};
/* ---------- odds buttons with movement arrows ---------- */
const oddBtn=(m,k,s,lab,big)=>{const p=m.P&&m.P[k]?m.P[k][s]:null,od=p==null?0:ODD(p),sus=m.sus>0||!od,on=SLIP.some(x=>x.mid===m.id&&x.k===k&&x.s===s);
 return `<button class="ob sob${on?' on':''}${big?' big':''}" data-m="${m.id}" data-k="${k}" data-s="${s}" ${sus?'disabled':''}><span>${lab}</span><b>${sus?'—':od.toFixed(2)}</b></button>`};
function wireOdds(root){root.querySelectorAll('.ob[data-m]').forEach(b=>b.onclick=()=>{const m=MATCHES.find(z=>z.id==b.dataset.m);if(!m)return;toggleSel(m,b.dataset.k,b.dataset.s);sfx('chip');
 document.querySelectorAll(`.ob[data-m="${m.id}"]`).forEach(x=>x.classList.toggle('on',SLIP.some(s=>s.mid===m.id&&s.k===x.dataset.k&&s.s===x.dataset.s)));const sb=$('slipBtn');sb.animate([{transform:'scale(1)'},{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:350});if($('bbBar'))drawBB()})}
/* ---------- cards for the lists ---------- */
const crest=n=>`<i class="crest" style="background:${tc(n)}">${n.split(' ').map(w=>w[0]).join('').slice(0,2)}</i>`;
const mainK=m=>m.sp==='football'?'res':m.sp==='basketball'?'ml':'mw';
function matchCard(m){const k=mainK(m),sel=m.sp==='football'?[['h','1'],['d','X'],['a','2']]:[['h','1'],['a','2']],mom=(m.mom||[]).slice(-20);
 return `<div class="mc${m.live?' live':''}" data-mt="${m.id}"><div class="mch"><span>${SPICON[m.sp]} ${m.lg}</span>${m.live?`<span class="lv">● ${clockShort(m)}</span>`:`<span>${m.done?'Full time':clockTxt(m)}</span>`}</div>
  <div class="mct"><div>${crest(m.h.n)}<b>${m.h.n}</b><span class="sc">${m.live||m.done?(m.sp==='tennis'?m.sets[0]:m.hs):''}</span></div><div>${crest(m.a.n)}<b>${m.a.n}</b><span class="sc">${m.live||m.done?(m.sp==='tennis'?m.sets[1]:m.as):''}</span></div></div>
  ${m.live?`<div class="mpb"><i style="width:${progress(m)*100}%"></i></div>`:''}${m.sp==='football'&&mom.length?`<div class="mom">${mom.map(v=>`<i style="height:${Math.abs(v)*100}%;background:${v>0?tc(m.h.n):tc(m.a.n)};align-self:${v>0?'flex-end':'flex-start'}"></i>`).join('')}</div>`:''}
  <div class="mco">${sel.map(([s,l])=>oddBtn(m,k,s,l)).join('')}</div><div class="mcm">+${m.sp==='football'?40:m.sp==='basketball'?12:8} markets · bet builder ›</div></div>`}
const clockShort=m=>m.sp==='football'?(m.min>=90?"90+'":m.min+"'"):m.sp==='basketball'?'Q'+Math.min(4,Math.floor(m.clock/90)+1):'Set '+(m.sets[0]+m.sets[1]+1);
function wireCards(el){wireOdds(el);el.querySelectorAll('[data-mt]').forEach(r=>r.onclick=e=>{if(e.target.closest('.ob'))return;sfx('click');location.hash='#/match/'+r.dataset.mt})}
function drawLobLive(){const el=$('lobLive');if(!el)return;const L=MATCHES.filter(m=>m.live).slice(0,4);el.innerHTML=`<div class="spgrid spm-inline">${L.map(matchCard).join('')||'<div class="empty">Nothing live right now</div>'}</div>`;wireCards(el)}
/* ---------- bet builder: joint probability of several legs on one match ---------- */
const BB_OK={football:['res','dc','ou','ou15','ou35','btts','hc','cs'],basketball:['ml','spr','tot'],tennis:['mw','set1','sets']};
function scoreWins(k,s,H,A,m){const r=H>A?'h':H<A?'a':'d',t=H+A;switch(k){case 'res':return r===s;case 'dc':return s.includes(r);case 'ou':return(t>2.5?'o':'u')===s;case 'ou15':return(t>1.5?'o':'u')===s;case 'ou35':return(t>3.5?'o':'u')===s;case 'btts':return(H>0&&A>0?'y':'n')===s;case 'hc':return(H-A>=2?'h':'a')===s;case 'cs':return `${H}-${A}`===s;
 case 'ml':return(H>A?'h':'a')===s;case 'tot':return(t>m.line?'o':'u')===s;case 'spr':return(H-A>m.spr?'h':'a')===s}return false}
function jointP(m,legs){if(m.done)return 0;
 if(m.sp==='football'){const left=Math.max(0,90-m.min)/90,mh=m.lh*left,ma=m.la*left;let P=0;for(let i=0;i<=9;i++)for(let j=0;j<=9;j++){const H=m.hs+i,A=m.as+j;if(legs.every(l=>scoreWins(l.k,l.s,H,A,m)))P+=pois(i,mh)*pois(j,ma)}return P}
 if(m.sp==='basketball'){const n=Math.max(0,360+(m.ot||0)-m.clock)*.55/2,vh=m.ph*5.25-Math.pow(m.ph*2.25,2),va=m.pa*5.25-Math.pow(m.pa*2.25,2);let w=0;const N=4000;
  const g=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283*v)};for(let i=0;i<N;i++){let H=m.hs+n*m.ph*2.25+g()*Math.sqrt(n*vh),A=m.as+n*m.pa*2.25+g()*Math.sqrt(n*va);if(Math.round(H)===Math.round(A))H+=R()<.5?1:-1;if(legs.every(l=>scoreWins(l.k,l.s,Math.round(H),Math.round(A),m)))w++}return w/N}
 const N=700;let w=0;for(let i=0;i<N;i++){const r=simTennis(m);if(legs.every(l=>l.k==='mw'?(r.w?'h':'a')===l.s:l.k==='sets'?(r.three?'o':'u')===l.s:(r.s1?'h':'a')===l.s))w++}return w/N}
const BBM=.96,bbOdd=P=>P<.002||P>=.985?0:Math.min(500,Math.max(1.01,Math.floor(BBM/P*100)/100));
/* ---------- the slip: legs, grouped by match; one match with several legs is a bet builder ---------- */
const SLIP=[];let SLIPMODE='single';
function toggleSel(m,k,s){const i=SLIP.findIndex(x=>x.mid===m.id&&x.k===k&&x.s===s);if(i>=0)SLIP.splice(i,1);else{const same=SLIP.findIndex(x=>x.mid===m.id&&x.k===k);if(same>=0)SLIP.splice(same,1);SLIP.push({mid:m.id,k,s,st:5});
  if(SLIP.filter(x=>x.mid===m.id).length>1&&SLIPMODE!=='multi'){SLIPMODE='multi';toast('Bet builder',`Several picks on ${m.h.n} v ${m.a.n} combine into one bet`,'lt','bolt')}}
 $('slip').classList.toggle('on',SLIP.length>0||$('slip').classList.contains('pin'));drawSlip()}
const selOdd=x=>{const m=MATCHES.find(z=>z.id===x.mid);if(!m||m.done||m.sus>0||!m.P||!m.P[x.k])return 0;return ODD(m.P[x.k][x.s])};
const boost=n=>n>=5?.15:n===4?.1:n===3?.05:0;
function groups(legs){const g={};legs.forEach(l=>(g[l.mid]=g[l.mid]||[]).push(l));return Object.entries(g).map(([mid,ls])=>({mid:+mid,legs:ls}))}
function groupOdd(gp){const m=MATCHES.find(z=>z.id===gp.mid);if(!m||m.sus>0||m.done)return{od:0,why:'Suspended'};if(gp.legs.length===1)return{od:selOdd(gp.legs[0])};
 if(gp.legs.some(l=>!BB_OK[m.sp].includes(l.k)))return{od:0,why:`${gp.legs.filter(l=>!BB_OK[m.sp].includes(l.k)).map(l=>MKT[l.k][0]).join(', ')} can't go in a bet builder`};const P=jointP(m,gp.legs);return P<.002?{od:0,why:"These picks can't all win together"}:{od:bbOdd(P),bb:1}}
function multiOdd(){const gs=groups(SLIP).map(g=>({...g,...groupOdd(g)}));if(gs.some(g=>!g.od))return{od:0,gs,why:(gs.find(g=>!g.od)||{}).why};const n=gs.length;return{od:Math.floor(gs.reduce((a,g)=>a*g.od,1)*(1+boost(n))*100)/100,gs,boost:boost(n)}}
function drawSlip(tickOnly){const el=$('slip'),n=SLIP.length,open=SPB.filter(b=>!b.micro);$('slipN').hidden=!(n+open.length);$('slipN').textContent=n||open.length;if(!el.classList.contains('on'))return;if(tickOnly&&document.activeElement&&el.contains(document.activeElement))return;
 const mo=n>1?multiOdd():null,mst=SLIP.mst||5;
 el.innerHTML=`<div class="slh"><b class="dw">Bet slip</b><span class="sp"></span><button class="icb" id="slX" style="width:34px;height:34px">${svg('x')}</button></div>
 <div class="tabs" style="padding:0 10px;margin:0"><button class="${SLIPMODE==='single'?'on':''}" data-sm="single">Singles</button><button class="${SLIPMODE==='multi'?'on':''}" data-sm="multi" ${n<2?'disabled':''}>Multi · ${n}</button><button class="${SLIPMODE==='open'?'on':''}" data-sm="open">Open · ${open.length}</button></div>
 <div style="flex:1;overflow:auto">${SLIPMODE==='open'?open.map(b=>{const co=cashOutVal(b);return `<div class="sll"><b>${esc(b.lab)}</b><div class="mut" style="font-size:12px">${esc(b.ev)} · @ ${b.od.toFixed(2)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><span class="dn">${fmt(b.st)} → ${fmt(b.st*b.od)}</span>${co?BTN('Cash out '+fmt(co),'sm','data-co="'+b.id+'"'):''}</div></div>`}).join('')||'<div class="empty">No open bets</div>'
  :SLIPMODE==='multi'&&mo?mo.gs.map(g=>{const m=MATCHES.find(z=>z.id===g.mid);return `<div class="slg${g.bb?' bb':''}"><div class="slgh">${m?crest(m.h.n)+crest(m.a.n)+`<b>${m.h.n} v ${m.a.n}</b>`:''}<span class="sp"></span>${g.bb?'<span class="bbtag">BET BUILDER</span>':''}<b class="dn">${g.od?g.od.toFixed(2):'—'}</b></div>
   ${g.legs.map(l=>`<div class="sll2"><i></i><span>${m?selLabel(m,l.k,l.s):''}<small>${MKT[l.k][0]}</small></span><button data-rmk="${l.mid}|${l.k}|${l.s}">✕</button></div>`).join('')}${g.why?`<div class="slwarn">${g.why}</div>`:''}</div>`}).join('')
  :SLIP.map((x,i)=>{const m=MATCHES.find(z=>z.id===x.mid),od=selOdd(x);return `<div class="sll"><div style="display:flex;justify-content:space-between"><b>${m?selLabel(m,x.k,x.s):'—'}</b><b class="dn">${od?od.toFixed(2):'SUSP'}</b></div><div class="mut" style="font-size:12px">${MKT[x.k][0]} · ${m?m.h.n+' v '+m.a.n:''}</div>
   <div class="betin" style="height:38px;margin-top:8px"><span>¢</span><input data-st="${i}" type="number" min=".1" value="${x.st}"><button data-rm="${i}">✕</button></div><div class="mono" style="margin-top:4px">Returns ${fmt(x.st*(od||0))}</div></div>`}).join('')||`<div class="empty">Tap any price to add it.<br><br>Add several picks from one match to build a bet builder, or picks from different matches for a multi.</div>`}</div>
 ${SLIPMODE!=='open'&&n?`<div class="slf">${SLIPMODE==='multi'&&mo?`<div class="kv" style="padding:4px 0"><span>Total odds${mo.boost?` · boost +${mo.boost*100}%`:''}</span><b class="dn" style="font-size:20px">${mo.od?mo.od.toFixed(2):'—'}</b></div><div class="betin"><span>¢</span><input id="slMS" type="number" min=".1" value="${mst}"></div><div class="mono">Returns <b style="color:var(--acc)">${fmt(mst*(mo.od||0))}</b></div>`:''}
  ${BTN(SLIPMODE==='multi'?'Place multi':'Place '+n+' bet'+(n>1?'s':''),'f lg w','id="slGo"'+(SLIPMODE==='multi'&&mo&&!mo.od?' disabled':''))}</div>`:''}`;
 $('slX').onclick=()=>{el.classList.remove('on','pin')};el.querySelectorAll('[data-sm]').forEach(b=>b.onclick=()=>{SLIPMODE=b.dataset.sm;drawSlip()});
 el.querySelectorAll('[data-st]').forEach(i=>i.oninput=()=>{SLIP[+i.dataset.st].st=Math.max(0,+i.value||0)});if($('slMS'))$('slMS').oninput=()=>{SLIP.mst=Math.max(0,+$('slMS').value||0)};
 const rm=()=>{if(SLIP.length<2&&SLIPMODE==='multi')SLIPMODE='single';drawSlip();refreshOdds();document.querySelectorAll('.ob.sob').forEach(x=>x.classList.toggle('on',SLIP.some(s=>s.mid==x.dataset.m&&s.k===x.dataset.k&&s.s===x.dataset.s)))};
 el.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{SLIP.splice(+b.dataset.rm,1);rm()});el.querySelectorAll('[data-rmk]').forEach(b=>b.onclick=()=>{const [a,k,s]=b.dataset.rmk.split('|');SLIP.splice(SLIP.findIndex(x=>x.mid==a&&x.k===k&&x.s===s),1);rm()});
 el.querySelectorAll('[data-co]').forEach(b=>b.onclick=()=>cashOut(+b.dataset.co));if($('slGo'))$('slGo').onclick=placeSlip;if($('bbBar'))drawBB()}
$('slipBtn').onclick=()=>{const s=$('slip');const on=!s.classList.contains('on');s.classList.toggle('on',on);s.classList.toggle('pin',on);if(on&&!SLIP.length)SLIPMODE='open';drawSlip()};
let bid=0;
function placeSlip(){if(SLIPMODE==='multi'){const st=SLIP.mst||5,mo=multiOdd();if(!mo.od)return toast(mo.why||'A pick is suspended','Wait a moment or remove it','lt');if(!spend(st,'sport-multi'))return;
  const gs=mo.gs.map(g=>({mid:g.mid,legs:g.legs.map(l=>({k:l.k,s:l.s})),od:g.od,bb:g.bb}));const lab=gs.length===1?'Bet builder':`${SLIP.length}-leg multi`;
  SPB.push({id:++bid,multi:1,gs,st,od:mo.od,lab,ev:gs.map(g=>{const m=MATCHES.find(z=>z.id===g.mid);return g.legs.map(l=>selLabel(m,l.k,l.s)).join(' + ')}).join(' | '),mid:-1});SLIP.length=0;sfx('bet');toast(`${lab} placed`,`${fmt(st)} @ ${mo.od.toFixed(2)} · returns ${fmt(st*mo.od)}`,'','list')}
 else{for(const x of SLIP.slice()){const od=selOdd(x),m=MATCHES.find(z=>z.id===x.mid);if(!od){toast(`${m?selLabel(m,x.k,x.s):'Selection'} is suspended`,'','lt');continue}if(!spend(x.st,'sport'))break;
  SPB.push({id:++bid,mid:x.mid,k:x.k,s:x.s,st:x.st,od,lab:selLabel(m,x.k,x.s),ev:`${MKT[x.k][0]} · ${m.h.n} v ${m.a.n}`});SLIP.splice(SLIP.indexOf(x),1);sfx('bet')}if(!SLIP.length)toast('Bets placed','Follow them under Open','','list')}
 SLIPMODE='open';saveSPB();drawSlip();refreshOdds();document.querySelectorAll('.ob.sob.on').forEach(x=>x.classList.remove('on'))}
function settleMatch(m){for(const b of SPB.slice()){if(b.micro)continue;let res=null,pushOd=1;
 if(b.multi){const rs=b.gs.map(g=>{const mm=MATCHES.find(z=>z.id===g.mid);if(!mm)return false;if(!mm.done)return null;const r=g.legs.map(l=>legResult(l,mm));if(r.includes(false))return false;if(r.includes('push')){pushOd*=g.od;return true}return true});
  if(rs.includes(false))res=false;else if(rs.every(r=>r===true))res=true}else if(b.mid===m.id)res=legResult(b,m);
 if(res===null)continue;SPB.splice(SPB.indexOf(b),1);if(res==='push'){credit(b.st,'sport');record('sport',b.st,b.st,`${b.lab} · draw, stake back`);toast('Draw: stake returned',b.lab,'lt','ball');continue}
 const pay=res?b.st*b.od/pushOd:0;if(pay)credit(pay,'sport');record(b.multi?'sport-multi':'sport',b.st,pay,`${b.lab} · ${b.ev}`);
 if(res){sfx('win');notify(`Bet won · +${fmt(pay)}`,`${b.lab} @ ${b.od.toFixed(2)}`,'trophy','#/account/bets')}else toast('Bet lost',`${b.lab}`,'lt','ball');outcome(!!res)}saveSPB()}
/* ---------- price boosts and popular builders (priced by the same joint model) ---------- */
const COMBOS=[[['res','h'],['ou15','o']],[['btts','y'],['ou','o']],[['res','a'],['btts','y']],[['dc','hd'],['ou35','u']],[['res','h'],['btts','n']]];
function specials(){const out=[];for(const m of MATCHES.filter(z=>z.sp==='football'&&!z.done&&z.P&&(!z.live||z.min<75))){for(const c of COMBOS){const legs=c.map(([k,s])=>({k,s}));const P=jointP(m,legs);if(P<.08||P>.7)continue;out.push({m,legs,P})}}
 return out.sort((a,b)=>a.P-b.P).slice(0,6)}
function specialCard(sp,boosted){const was=bbOdd(sp.P),now=boosted?Math.floor(.99/sp.P*100)/100:was;return `<div class="spc${boosted?' boost':''}" data-spm="${sp.m.id}" data-legs="${sp.legs.map(l=>l.k+':'+l.s).join(',')}">
 <div class="mch"><span>${boosted?'⚡ Price boost':'🔥 Bet builder'}</span><span>${sp.m.live?'● '+clockShort(sp.m):'Pre-match'}</span></div><b>${sp.legs.map(l=>selLabel(sp.m,l.k,l.s)+(l.k.startsWith('ou')?'':'')).join(' <i>+</i> ')}</b><div class="mut" style="font-size:12px">${sp.m.h.n} v ${sp.m.a.n}</div>
 <div class="spo">${boosted?`<s>${was.toFixed(2)}</s>`:''}<button class="ob sob big"><span>${boosted?'Boosted':'Add builder'}</span><b>${now.toFixed(2)}</b></button></div></div>`}
function wireSpecials(el){el.querySelectorAll('[data-spm]').forEach(c=>c.querySelector('button').onclick=()=>{const m=MATCHES.find(z=>z.id==c.dataset.spm);if(!m)return;const legs=c.dataset.legs.split(',').map(x=>x.split(':'));
 if(c.classList.contains('boost')){const P=jointP(m,legs.map(([k,s])=>({k,s}))),od=Math.floor(.99/P*100)/100,st=5;modal(`<span class="mono">Price boost</span><h3 class="dw">${legs.map(([k,s])=>selLabel(m,k,s)).join(' + ')}</h3><p class="mut">${m.h.n} v ${m.a.n}. Both must happen. Boosted to ${od.toFixed(2)}, the best price we can give (99% return).</p><div class="betin"><span>¢</span><input id="bsSt" type="number" value="${st}"></div><div style="height:10px"></div>${BTN(`Place boosted bet @ ${od.toFixed(2)}`,'f lg w','id="bsGo"')}`);
  $('bsGo').onclick=()=>{const s=Math.max(.1,+$('bsSt').value||0);if(!spend(s,'sport-multi'))return;SPB.push({id:++bid,multi:1,gs:[{mid:m.id,legs:legs.map(([k,s])=>({k,s})),od,bb:1}],st:s,od,lab:'Price boost',ev:legs.map(([k,s])=>selLabel(m,k,s)).join(' + '),mid:-1});saveSPB();closeAll();sfx('bet');toast('Boosted bet placed',`${fmt(s)} @ ${od.toFixed(2)}`,'','bolt')};return}
 legs.forEach(([k,s])=>{if(!SLIP.some(x=>x.mid===m.id&&x.k===k&&x.s===s))toggleSel(m,k,s)});SLIPMODE='multi';drawSlip()})}
/* ---------- sports home ---------- */
ROUTES.sports=(f)=>{const v=$('view'),sp=['football','basketball','tennis'].includes(f)?f:null,live=f==='live';refreshOdds();
 const L=MATCHES.filter(m=>(!sp||m.sp===sp)&&(!live||m.live)),feat=MATCHES.filter(m=>m.live&&(!sp||m.sp===sp)).sort((a,b)=>Math.abs(a.hs-a.as)-Math.abs(b.hs-b.as)||b.min-a.min)[0];
 const grid=(t,a,sub)=>a.length?`<div class="sh"><div><span class="mono">${sub}</span><h2 class="dw">${t}</h2></div></div><div class="spgrid">${a.map(matchCard).join('')}</div>`:'';const spx=specials();
 v.innerHTML=`<div class="sptabs">${[['','All sports','🏟'],['live','Live','●'],['football','Football','⚽'],['basketball','Basketball','🏀'],['tennis','Tennis','🎾']].map(([k,l,i])=>`<a class="spt${(f||'')===k?' on':''}" href="#/sports${k?'/'+k:''}"><span>${i}</span>${l}${k==='live'?` <em>${MATCHES.filter(m=>m.live).length}</em>`:''}</a>`).join('')}</div>
  ${feat?`<div class="feat" data-mt="${feat.id}"><div class="ft-l"><span class="mono">Featured · live</span><div class="ft-sb"><div>${crest(feat.h.n)}<b>${feat.h.n}</b></div><div class="ft-sc" id="ftSc">${scoreTxt(feat)}</div><div>${crest(feat.a.n)}<b>${feat.a.n}</b></div></div><div class="ft-c" id="ftC">${clockTxt(feat)}</div>
   <div class="mco" style="margin-top:12px">${(feat.sp==='football'?[['h',feat.h.n],['d','Draw'],['a',feat.a.n]]:[['h',feat.h.n],['a',feat.a.n]]).map(([s,l])=>oddBtn(feat,mainK(feat),s,l,1)).join('')}</div></div><div class="ft-r"><canvas class="trk" data-trk="${feat.id}"></canvas></div></div>`:''}
  ${spx.length&&(!sp||sp==='football')?`<div class="sh"><div><span class="mono">Specials · priced on the live model</span><h2 class="dw">Boosts and bet builders</h2></div></div><div class="sprow">${spx.slice(0,2).map(s=>specialCard(s,1)).join('')}${spx.slice(2,6).map(s=>specialCard(s,0)).join('')}</div>`:''}
  ${grid('In play',L.filter(m=>m.live),'Live · updating every second')}${live?'':grid('Starting soon',L.filter(m=>!m.live&&!m.done),'Bet now, watch it live')+grid('Results',L.filter(m=>m.done),'Finished in the last five minutes')}
  <details class="howto"><summary>How sports betting works</summary><div class="help" style="margin-top:12px"><div><b class="n">1</b><h4>Tap a price</h4><p>Odds of 2.50 pay 2.50× your stake if it wins. Lower odds = more likely.</p></div><div><b class="n">2</b><h4>Stack picks</h4><p>Several picks on one match make a <b>bet builder</b>, priced together. Picks on different matches make a multi; three or more get a boost.</p></div><div><b class="n">3</b><h4>Watch it live</h4><p>Open any match for the live tracker, stats and every market. Prices pause for a moment after goals.</p></div><div><b class="n">4</b><h4>Cash out, go micro</h4><p>Take a single early with cash out, or bet the next few minutes in the micro bar below.</p></div></div></details>${footer()}`;
 wireCards(v);wireSpecials(v);v.querySelectorAll('canvas.trk').forEach(startTracker)};
/* ---------- match centre ---------- */
let MTAB='popular';
ROUTES.match=(id)=>{const m=MATCHES.find(z=>z.id==id);if(!m){$('view').innerHTML=`<div class="card empty">That match has finished and left the board. <a href="#/sports"><b>Back to sports</b></a></div>`;return}CURMATCH=m.id;refreshOdds();
 const ch=tc(m.h.n),ca=tc(m.a.n);
 $('view').innerHTML=`<a class="mono" href="#/sports" style="display:inline-block;margin-bottom:10px">‹ All sports</a><div class="msb" style="--ch:${ch};--ca:${ca}"><div class="msb-t"><div class="tm">${crest(m.h.n)}<b>${m.h.n}</b><span>Home</span></div><div class="msb-m"><span class="mono">${SPICON[m.sp]} ${m.lg}</span><div class="msb-s" id="mcS">${scoreTxt(m)}</div><div class="msb-c" id="mcC">${m.live?'● LIVE · ':''}${clockTxt(m)}</div><div class="mpb" style="width:260px;margin:8px auto 0"><i id="mcPb" style="width:${progress(m)*100}%"></i></div></div><div class="tm r">${crest(m.a.n)}<b>${m.a.n}</b><span>Away</span></div></div>
  <div class="msb-v"><canvas class="trk big" data-trk="${m.id}"></canvas></div></div>
 <div class="mgrid"><div><div class="mtabs" id="mTabs"></div><div id="mMk"></div><div class="sh" style="margin-top:20px"><div><span class="mono">Micro · settles in seconds</span><h2 class="dw" style="font-size:22px">Next play</h2></div></div><div id="mcMicro" class="card"></div></div>
  <div><div id="bbBar"></div><div class="card spcard" id="mcSt"></div><div class="card spcard" style="margin-top:12px"><div class="mono" style="padding:14px 16px 4px">Timeline</div><div id="mcEv" style="max-height:420px;overflow:auto"></div></div></div></div>`;
 drawMarkets(m);drawMatchLive();startTracker(document.querySelector('canvas.trk.big'))};
const TABS={football:[['popular','Popular',['res','dc','ou','btts']],['builder','Bet builder',['res','dc','ou15','ou','ou35','btts','hc']],['goals','Goals',['ou15','ou','ou35','btts','ng']],['result','Result',['res','dc','dnb','hc']],['score','Correct score',['cs']]],
 basketball:[['popular','Popular',['ml','spr','tot']]],tennis:[['popular','Popular',['mw','set1','sets']]]};
function drawMarkets(m){const tabs=TABS[m.sp];if(!tabs.find(t=>t[0]===MTAB))MTAB=tabs[0][0];$('mTabs').innerHTML=tabs.map(([k,l])=>`<button class="${k===MTAB?'on':''}" data-t="${k}">${l}${k==='builder'?' <em>NEW</em>':''}</button>`).join('');
 $('mTabs').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{MTAB=b.dataset.t;sfx('click');drawMarkets(m)});const ks=tabs.find(t=>t[0]===MTAB)[2];
 $('mMk').innerHTML=(MTAB==='builder'?`<div class="bbintro">⚡ <b>Bet builder:</b> pick as many as you like from this match. They're priced together from the live match model, so related picks (a win and a clean sheet, say) get a fair combined price, not a simple multiply.</div>`:'')+ks.map(k=>{const sels=k==='cs'?Object.keys((m.P&&m.P.cs)||{}):Object.keys(MKT[k][1]);
  return `<div class="mk2"><div class="mk2h"><b>${MKT[k][0]}${k==='tot'?' '+m.line:''}</b>${BB_OK[m.sp].includes(k)?'<span class="bbtag">BB</span>':''}<span class="sp"></span><span class="mk2d">${MKT[k][2]}</span></div><div class="mk2o${k==='cs'?' cs':''}">${sels.map(s=>oddBtn(m,k,s,selLabel(m,k,s),1)).join('')||'<span class="dim">Closed</span>'}</div></div>`}).join('');wireOdds($('mMk'));drawBB()}
function drawBB(){const el=$('bbBar');if(!el)return;const m=MATCHES.find(z=>z.id===CURMATCH);if(!m)return;const legs=SLIP.filter(x=>x.mid===m.id);if(legs.length<2){el.innerHTML='';return}const g=groupOdd({mid:m.id,legs});
 el.innerHTML=`<div class="bbbar"><div><span class="mono">Your bet builder · ${legs.length} picks</span><b>${legs.map(l=>selLabel(m,l.k,l.s)).join(' + ')}</b>${g.why?`<div class="slwarn">${g.why}</div>`:''}</div><div class="bbo">${g.od?g.od.toFixed(2):'—'}</div></div>`}
function drawMatchLive(){const m=MATCHES.find(z=>z.id===CURMATCH);if(!m||!$('mcS')){CURMATCH=0;return}$('mcS').innerHTML=scoreTxt(m);$('mcC').textContent=(m.live?'● LIVE · ':'')+clockTxt(m)+(m.sus>0?' · prices paused':'');$('mcPb').style.width=progress(m)*100+'%';
 const st=m.stats,ch=tc(m.h.n),ca=tc(m.a.n),bar=(l,a,b)=>{const t=(+a)+(+b)||1;return `<div class="stb"><div class="stl"><b>${a}</b><span>${l}</span><b>${b}</b></div><div class="stbar"><i style="width:${a/t*100}%;background:${ch}"></i><i style="width:${b/t*100}%;background:${ca}"></i></div></div>`};
 $('mcSt').innerHTML=`<div class="mono" style="padding:14px 16px 4px">Match stats</div><div style="padding:0 16px 14px">${m.sp==='football'?bar('Possession %',st.hp,100-st.hp)+bar('Shots',st.hsh,st.ash)+bar('On target',st.hst||0,st.ast||0)+bar('Corners',st.hc,st.ac)+bar('Fouls',st.hf||0,st.af||0)+bar('Yellow cards',st.hy||0,st.ay||0)
  :m.sp==='basketball'?(()=>{const sh=m.shots||[],f=t=>sh.filter(s=>s.t===t),pc=t=>{const a=f(t);return a.length?Math.round(a.filter(s=>s.made).length/a.length*100):0};return bar('Points',m.hs,m.as)+bar('Field goal %',pc(0),pc(1))+bar('Threes made',f(0).filter(s=>s.made&&s.three).length,f(1).filter(s=>s.made&&s.three).length)})()
  :bar('Sets',m.sets[0],m.sets[1])+bar('Games this set',m.games[0],m.games[1])+bar('Points won (last 24)',(m.ptl||[]).filter(p=>p===0).length,(m.ptl||[]).filter(p=>p===1).length)}</div>`;
 $('mcEv').innerHTML=m.ev.map(e=>`<div class="tl ${e.side||''}" style="--c:${e.side==='h'?ch:e.side==='a'?ca:'var(--ink-3)'}"><span class="mono">${e.min!=null?e.min+"'":''}</span><i></i><b>${esc(e.t)}</b></div>`).join('')||'<div class="empty">Waiting for kick-off</div>';
 const mm=MICRO.filter(x=>x.mid===m.id);$('mcMicro').innerHTML=mm.map(microRow).join('')||'<div class="empty">Micro markets open when the match is live</div>';wireMicro($('mcMicro'));drawBB()}
/* ================= THE TRACKERS ================= */
function startTracker(cv){if(!cv)return;const m=()=>MATCHES.find(z=>z.id==cv.dataset.trk),V={x:.5,y:.5,tx:.5,ty:.5,mode:'safe',poss:'h',until:0,seenEv:null,banner:null,rally:null,lastPt:0,trail:[]};
 (function f(now){if(!cv.isConnected)return;const M=m();if(M){const r=cv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(r.width*d)){cv.width=r.width*d;cv.height=r.height*d}const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,r.width,r.height);
  try{(M.sp==='football'?drawFootball:M.sp==='basketball'?drawBasket:drawTennis)(x,r.width,r.height,M,V,now)}catch(e){console.error(e)}}requestAnimationFrame(f)})(performance.now())}
function label(x,t,X,Y,col,big){x.font=`800 ${big?30:12}px 'Barlow Condensed',Outfit,sans-serif`;const w=x.measureText(t).width+(big?34:16),h=big?46:22;x.fillStyle=col;x.globalAlpha=.94;x.beginPath();x.roundRect?x.roundRect(X-w/2,Y-h/2,w,h,h/2):x.rect(X-w/2,Y-h/2,w,h);x.fill();x.globalAlpha=1;x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(t,X,Y+1);x.textAlign='left';x.textBaseline='alphabetic'}
/* football: a broadcast-angle pitch with 22 players. Shapes hold a 4-3-3, shift with the ball and press it; the team on the ball
   passes, carries and shoots, with possession leaning the way the engine's momentum leans. Goals, corners and cards come from the
   engine's own events and are acted out (a cross, a finish into the net, the celebration, the kick-off), so the picture never shows
   a goal the score doesn't have. Coordinates are metres on a 105 x 68 pitch; home attack to the right. */
const FB_FORM=[[4,34],[21,9],[17,26],[17,42],[21,59],[37,20],[33,34],[37,48],[53,11],[56,34],[53,57]];
function fbInit(M){const fb={P:[],ball:{x:52.5,y:34,h:0},own:null,fl:null,hold:1,team:'h',script:null,crowd:[]};
 for(const side of['h','a'])FB_FORM.forEach(([x,y],i)=>{const kx=Math.min(x*.95,50.5);fb.P.push({side,i,x:side==='h'?kx:105-kx,y,ph:R()*6})});
 for(let i=0;i<420;i++)fb.crowd.push([R(),R(),((a)=>a[Math.floor(R()*a.length)])(['#e8d5c4','#2b2b2b','#d9d9d9','#7a5c48',tc(M.h.n),tc(M.a.n),tc(M.h.n),'#3a4a6a'])]);return fb}
function fbKick(fb,team){fb.P.forEach(p=>{const [x,y]=FB_FORM[p.i],kx=Math.min(x*.95,50.5);p.x=p.side==='h'?kx:105-kx;p.y=y});fb.ball={x:52.5,y:34,h:0};fb.fl=null;fb.team=team;fb.own=fb.P.find(p=>p.side===team&&p.i===9);fb.own.x=team==='h'?51.5:53.5;fb.own.y=34;fb.hold=1.2}
const fbTeam=(fb,s)=>fb.P.filter(p=>p.side===s);
const fbD=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fbPass(fb,from,to,kind,spd){const b=fb.ball,tx=to.x!=null?to.x:to[0],ty=to.y!=null?to.y:to[1],d=Math.hypot(tx-b.x,ty-b.y);fb.own=null;
 fb.fl={x0:b.x,y0:b.y,x1:tx,y1:ty,t:0,dur:Math.max(.25,d/(spd||17)),peak:kind==='long'||kind==='cross'?Math.min(7,d/7):kind==='shot'?.8:.2,to:to.side?to:null,kind}}
function fbStep(fb,M,dt,mom){const b=fb.ball,dir=s=>s==='h'?1:-1;
 /* ball in flight */
 if(fb.fl){const f=fb.fl;f.t+=dt;const k=Math.min(1,f.t/f.dur);b.x=f.x0+(f.x1-f.x0)*k;b.y=f.y0+(f.y1-f.y0)*k;b.h=Math.sin(k*Math.PI)*f.peak;
  if(k>=1){fb.fl=null;b.h=0;if(f.kind==='goal'){fb.script={k:'cele',t:2.6,side:f.side};return}
   if(f.kind==='shot'){const gk=fbTeam(fb,f.def).find(p=>p.i===0);if(f.save){fb.own=gk;fb.team=f.def;fb.hold=1.4}else{b.x=f.def==='h'?3:102;b.y=34;fb.own=gk;fb.team=f.def;gk.x=b.x;gk.y=34;fb.hold=1.8}return}
   if(f.to){fb.own=f.to;fb.team=f.to.side;fb.hold=.45+R()*1.1}else{const n=fb.P.filter(p=>p.i).sort((p,q)=>fbD(p,b)-fbD(q,b))[0];fb.own=n;fb.team=n.side;fb.hold=.6}}}
 /* scripts: corners and goals acted out */
 const sc=fb.script;if(sc){sc.t-=dt;
  if(sc.k==='corner'&&sc.t<=0&&!fb.fl){const box=fbTeam(fb,sc.side).filter(p=>p.i>=5).sort(()=>R()-.5)[0];fbPass(fb,null,box,'cross',20);fb.fl.to=null;fb.script={k:'clear',t:fb.fl.dur+.1,side:sc.side}}
  else if(sc.k==='clear'&&sc.t<=0&&!fb.fl){const d=sc.side==='h'?'a':'h',hd=fbTeam(fb,d).filter(p=>p.i).sort((p,q)=>fbD(p,b)-fbD(q,b))[0];hd.x=b.x;hd.y=b.y;fb.ball.x=hd.x;fbPass(fb,null,[sc.side==='h'?70:35,10+R()*48],'long',18);fb.script=null}
  else if(sc.k==='goal'&&!fb.fl&&sc.t<=0){const st=fb.own||fbTeam(fb,sc.side).find(p=>p.i===9);fb.own=null;fbPass(fb,null,[sc.side==='h'?106.5:-1.5,31.5+R()*5],'shot',26);fb.fl.kind='goal';fb.fl.side=sc.side;fb.script=null;fb.scorer=st}
  else if(sc.k==='cele'&&sc.t<=0){fb.script=null;fbKick(fb,sc.side==='h'?'a':'h')}}
 /* the man on the ball decides */
 if(fb.own&&!fb.fl&&(!sc||sc.k==='goalrun')){const c=fb.own,d=dir(c.side),adv=d>0?b.x/105:1-b.x/105;fb.hold-=dt;
  if(sc&&sc.k==='goalrun'){if(adv>.84||sc.t<=0){fb.script={k:'goal',t:0,side:c.side}}}
  else if(fb.hold<=0){const mates=fbTeam(fb,c.side).filter(p=>p!==c&&p.i),opp=fbTeam(fb,c.side==='h'?'a':'h'),press=Math.min(...opp.map(o=>fbD(o,c)));
   if(adv>.8&&Math.abs(b.y-34)<18&&R()<.4){const on=R()<.45;fbPass(fb,null,[d>0?105:0,on?31+R()*6:(R()<.5?26-R()*4:42+R()*4)],'shot',24);fb.fl.def=c.side==='h'?'a':'h';fb.fl.save=on;fb.shotBy=c.side}
   else{const long=R()<.1,lean=(c.side==='h'?1:-1)*mom;let best=null,bs=-1e9;for(const m of mates){const dd=fbD(m,c),fw=(m.x-c.x)*d;if(dd<6||(!long&&dd>32))continue;const s=fw*(.6+lean*.4)+(R()-.5)*22-(dd>22?6:0)-Math.min(...opp.map(o=>fbD(o,m)))*-1.2;if(s>bs){bs=s;best=m}}
    if(best){const lose=.1+(press<2.5?.12:0)-lean*.08+(adv>.7?.08:0);if(R()<lose){const mid={x:(c.x+best.x)/2,y:(c.y+best.y)/2},it=opp.filter(o=>o.i).sort((p,q)=>fbD(p,mid)-fbD(q,mid))[0];fbPass(fb,c,it,'pass',16)}else fbPass(fb,c,best,long?'long':'pass',long?22:16)}else fb.hold=.4}}}
 /* everyone moves */
 const bx=b.x;for(const p of fb.P){const d=dir(p.side),poss=fb.team===p.side,[fx,fy]=FB_FORM[p.i],base=p.side==='h'?fx:105-fx;let tx,ty,sp=5.2;
  if(sc&&sc.k==='cele'){if(p.side===sc.side){tx=sc.side==='h'?100:5;ty=6+p.i;sp=7}else{tx=base;ty=fy;sp=1.5}}
  else if(!M.live){const kx=Math.min(fx*.95,50.5);tx=p.side==='h'?kx:105-kx;ty=fy;sp=3}
  else if(p===fb.own){tx=p.x+d*(sc&&sc.k==='goalrun'?6:2.5);ty=p.y+(34-p.y)*.08;sp=sc&&sc.k==='goalrun'?7.5:4.4}
  else if(sc&&(sc.k==='corner'||sc.k==='clear')&&p.i){const att=p.side===sc.side,gx=sc.side==='h'?94:11;tx=att?(p.i>=5?gx+(R()-.5)*2+(p.i-7)*.6*d:base+d*20):gx+(sc.side==='h'?3:-3)+((p.i*7)%11)-5;ty=att?(p.i>=5?24+(p.i-5)*3.4:fy):24+((p.i*5)%20);sp=6}
  else if(p.i===0){tx=p.side==='h'?Math.max(2,Math.min(11,bx*.08+2)):Math.min(103,Math.max(94,105-(105-bx)*.08-2));ty=34+(b.y-34)*.25;sp=4}
  else{tx=base+(bx-52.5)*.58+d*(poss?9:-3);ty=fy+(b.y-fy)*.24;if(poss&&p.i>=8)tx+=d*4}
  p.tx=tx;p.ty=ty;p.sp=sp}
 /* the nearest two defenders press the ball */
 if(fb.own&&M.live&&!sc){const opp=fb.P.filter(p=>p.side!==fb.own.side&&p.i).sort((p,q)=>fbD(p,b)-fbD(q,b));opp[0].tx=b.x+dir(fb.own.side)*1.4;opp[0].ty=b.y;opp[0].sp=6.2;opp[1].tx=(opp[1].tx+b.x)/2;opp[1].ty=(opp[1].ty+b.y)/2}
 if(fb.fl&&fb.fl.to){const r=fb.fl.to;r.tx=fb.fl.x1;r.ty=fb.fl.y1;r.sp=6.5}
 for(const p of fb.P){const dx=clamp(p.tx,1,104)-p.x,dy=clamp(p.ty,1,67)-p.y,d=Math.hypot(dx,dy),st=Math.min(d,p.sp*dt);if(d>.01){p.x+=dx/d*st;p.y+=dy/d*st;p.mv=st/dt;p.fx=dx/d}else p.mv=0;p.ph+=p.mv*dt*2.2}
 if(fb.own&&!fb.fl){b.x=fb.own.x+dir(fb.own.side)*.9;b.y=fb.own.y+.5;b.h=0}}
/* the projection: a TV gantry camera above the near touchline */
function fbCam(W,top,ph){const nearW=W-28,farW=nearW*.7,cx=W/2;return(x,y,z)=>{const t=y/68,s=.7+.3*t,sy=top+ph*(t*(.82+.18*t));return[cx+(x-52.5)/105*nearW*(s),sy-(z||0)*s*3.4,s]}}
function drawFootball(x,W,H,M,V,now){const mh=H*.78,ch=tc(M.h.n),ca=tc(M.a.n),dt=Math.min(.05,(now-(V.t||now))/1000);V.t=now;
 if(!V.fb){V.fb=fbInit(M);V.fb.team=M.min%2?'a':'h';V.fb.own=fbTeam(V.fb,V.fb.team).find(p=>p.i===6);V.seenEv=M.ev[0]||null}const fb=V.fb,mom=(M.mom||[0]).slice(-1)[0];
 /* engine events become scenes */
 const e=M.ev[0];if(e&&V.seenEv!==e){if(/GOAL/.test(e.t)){V.banner={t:'GOAL!',sub:M[e.side].n,c:e.side==='h'?ch:ca,w:now+1400};const S=e.side,st=fbTeam(fb,S).find(p=>p.i===9);fb.fl=null;fb.team=S;fb.own=st;st.x=S==='h'?70:35;st.y=30+R()*8;fb.script={k:'goalrun',t:2.2,side:S};sfx('goal')}
  else if(/Corner/.test(e.t)){V.banner={t:'CORNER',sub:M[e.side].n,c:e.side==='h'?ch:ca,w:now};const S=e.side;fb.fl=null;fb.own=null;fb.team=S;fb.ball={x:S==='h'?104.3:.7,y:R()<.5?.7:67.3,h:0};fb.script={k:'corner',t:1.6,side:S}}
  else if(/Yellow/.test(e.t))V.banner={t:'YELLOW CARD',sub:M[e.side].n,c:'#e9b308',w:now}}V.seenEv=e;
 if(M.live&&dt>0)fbStep(fb,M,dt,mom);else if(!M.live)fbStep(fb,M,dt||.016,0);
 /* stadium: stands, crowd, boards */
 const top=mh*.2,ph=mh-top-6,P=fbCam(W,top,ph);const sky=x.createLinearGradient(0,0,0,top);sky.addColorStop(0,'#05080f');sky.addColorStop(1,'#141c2c');x.fillStyle=sky;x.fillRect(0,0,W,top+2);
 for(const [u,v,c] of fb.crowd){x.fillStyle=c;x.globalAlpha=.55+v*.35;x.fillRect(u*W,v*(top-12)+((now/300+u*40)%2<1&&V.banner&&now-V.banner.w<2400?-1.5:0),2.4,2.4)}x.globalAlpha=1;
 const [bl]=P(0,0),[br]=P(105,0);for(let i=0;i<12;i++){const a=bl-8+(br-bl+16)*i/12,w=(br-bl+16)/12;x.fillStyle=i%3===0?ch:i%3===1?'#0b1430':ca;x.fillRect(a,top-11,w-1,8);x.fillStyle='#fff';x.font="800 6px 'Barlow Condensed',sans-serif";x.fillText(i%3===1?'STACK':'STACK SPORTS',a+3,top-5)}
 /* grass: mowing bands through the projection, then a soft light */
 const quad=(x0,y0,x1,y1,col)=>{const a=P(x0,y0),b=P(x1,y0),c=P(x1,y1),d=P(x0,y1);x.fillStyle=col;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.lineTo(c[0],c[1]);x.lineTo(d[0],d[1]);x.fill()};
 quad(-4,-3,109,71,'#1b6b35');for(let i=0;i<14;i++)quad(i*7.5,0,(i+1)*7.5,68,i%2?'#237f40':'#2a8a47');
 const lg=x.createRadialGradient(W/2,top+ph*.4,10,W/2,top+ph*.4,W*.6);lg.addColorStop(0,'rgba(255,255,255,.08)');lg.addColorStop(1,'rgba(0,0,0,.25)');x.fillStyle=lg;x.fillRect(0,top-3,W,ph+10);
 /* markings */x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=1.6;const line=pts=>{x.beginPath();pts.forEach(([a,b,c],i)=>{const q=P(a,b,c);i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});x.stroke()};
 const arc=(cx,cy,r,a0,a1)=>{const pts=[];for(let k=0;k<=24;k++){const a=a0+(a1-a0)*k/24;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}line(pts)};
 line([[0,0],[105,0],[105,68],[0,68],[0,0]]);line([[52.5,0],[52.5,68]]);arc(52.5,34,9.15,0,6.3);
 for(const s of[0,1]){const g=s?105:0,k=s?-1:1;line([[g,13.85],[g+k*16.5,13.85],[g+k*16.5,54.15],[g,54.15]]);line([[g,24.85],[g+k*5.5,24.85],[g+k*5.5,43.15],[g,43.15]]);arc(g+k*11,34,9.15,s?Math.PI-.93:-.93,s?Math.PI+.93:.93);
  const q=P(g+k*11,34);x.fillStyle='#fff';x.beginPath();x.arc(q[0],q[1],1.4,0,7);x.fill()}
 /* attacking zone tint */const adv=fb.team==='h'?fb.ball.x/105:1-fb.ball.x/105,mode=fb.script?fb.script.k:!M.live?'idle':adv>.78?'danger':adv>.55?'attack':'safe';
 if(M.live&&(mode==='danger'||mode==='attack')){const hm=fb.team==='h',x0=hm?(mode==='danger'?70:52.5):0,x1=hm?105:(mode==='danger'?35:52.5);x.globalAlpha=mode==='danger'?.28+Math.sin(now/170)*.1:.16;quad(x0,0,x1,68,hm?ch:ca);x.globalAlpha=1}
 /* goals: posts, crossbar and net, drawn behind the far post first */
 const goal=s=>{const g=s?105:0,k=s?1:-1,y0=30.34,y1=37.66,hh=2.44;const net=[];x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=.8;for(let j=0;j<=8;j++){const yy=y0+(y1-y0)*j/8;line([[g,yy,hh],[g+k*2,yy,hh*.7],[g+k*2,yy,0]])}for(let j=0;j<=4;j++){const z=hh*j/4;line([[g+k*2,y0,z*.7],[g+k*2,y1,z*.7]])}
  x.strokeStyle='#fff';x.lineWidth=2.2;const L=pts=>{x.beginPath();pts.forEach(([a,b,c],i)=>{const q=P(a,b,c);i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});x.stroke()};L([[g,y0,0],[g,y0,hh],[g,y1,hh],[g,y1,0]])};goal(0);goal(1);
 /* players and ball, back to front */
 const b=fb.ball,items=fb.P.map(p=>({p,y:p.y})).concat([{ball:1,y:b.y}]).sort((a,c)=>a.y-c.y);
 for(const it of items){if(it.ball){const [sx,sy,s0]=P(b.x,b.y),s=s0*1.5,[,hy]=P(b.x,b.y,b.h);x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(sx,sy,4*s,1.6*s,0,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(sx,hy-3*s,3.3*s,0,7);x.fill();x.fillStyle='#222';x.beginPath();x.arc(sx+.8*s,hy-3.4*s,1.1*s,0,7);x.fill();continue}
  const p=it.p,[sx,sy,s0]=P(p.x,p.y),s=s0*1.75,gk=p.i===0,shirt=gk?(p.side==='h'?'#f4d03f':'#9b5de5'):p.side==='h'?ch:ca,swing=p.mv>.4?Math.sin(p.ph)*2.6*s:0;
  x.fillStyle='rgba(0,0,0,.3)';x.beginPath();x.ellipse(sx+2*s,sy,5.5*s,2*s,0,0,7);x.fill();
  x.strokeStyle='#1a1a1a';x.lineWidth=2*s;x.lineCap='round';x.beginPath();x.moveTo(sx-1.4*s,sy-6*s);x.lineTo(sx-1.4*s+swing,sy-.5*s);x.moveTo(sx+1.4*s,sy-6*s);x.lineTo(sx+1.4*s-swing,sy-.5*s);x.stroke();
  x.fillStyle=p.side==='h'?'#f2f2f2':'#1c1c24';x.fillRect(sx-3*s,sy-8.5*s,6*s,3.2*s);
  x.fillStyle=shirt;x.beginPath();x.roundRect?x.roundRect(sx-3.6*s,sy-15.5*s,7.2*s,7.6*s,2*s):x.rect(sx-3.6*s,sy-15.5*s,7.2*s,7.6*s);x.fill();x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=.8;x.stroke();
  x.fillStyle=['#e8b896','#8d5a3b','#c68d64','#5a3825'][(p.i*3+(p.side==='h'?0:1))%4];x.beginPath();x.arc(sx,sy-17.6*s,2.3*s,0,7);x.fill();x.lineCap='butt';
  if(p===fb.own){x.fillStyle='#c8f53a';x.beginPath();x.moveTo(sx,sy-21.5*s);x.lineTo(sx-3*s,sy-25.5*s);x.lineTo(sx+3*s,sy-25.5*s);x.fill()}}
 /* captions */const lab=!M.live?(M.done?'FULL TIME':'KICK-OFF SOON'):mode==='goalrun'||mode==='goal'?'GOAL CHANCE':mode==='cele'?'GOAL':mode==='corner'||mode==='clear'?'CORNER':mode==='danger'?'DANGEROUS ATTACK':mode==='attack'?'ATTACK':'BALL SAFE',tm=fb.team==='h'?M.h.n:M.a.n;
 label(x,`${lab}${M.live&&mode!=='cele'?' · '+tm:''}`,W/2,top+14,mode==='danger'||mode==='goalrun'||mode==='cele'?(fb.team==='h'?ch:ca):'rgba(10,17,32,.85)');
 if(V.banner&&now-V.banner.w<2600&&now>=V.banner.w){const a=Math.min(1,(now-V.banner.w)/200);x.globalAlpha=a;label(x,V.banner.t,W/2,top+ph*.45,V.banner.c,1);x.font="700 13px 'Barlow Condensed',sans-serif";x.fillStyle='#fff';x.textAlign='center';x.fillText(V.banner.sub.toUpperCase(),W/2,top+ph*.45+38);x.textAlign='left';x.globalAlpha=1}
 /* momentum strip */const X=u=>12+u*(W-24),pw=W-24;const momA=M.mom||[],y0=mh+(H-mh)/2,bw=pw/90;x.fillStyle='rgba(255,255,255,.06)';x.fillRect(X(0),mh+4,pw,H-mh-8);x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=1;x.beginPath();x.moveTo(X(0),y0);x.lineTo(X(1),y0);x.stroke();
 momA.forEach((v,i)=>{x.fillStyle=v>0?ch:ca;const h=Math.abs(v)*(H-mh-14)/2;x.fillRect(X(i/90),v>0?y0-h:y0,Math.max(1,bw-1),h)});M.ev.filter(e=>/GOAL/.test(e.t)&&e.min!=null).forEach(e=>{x.fillStyle='#fff';x.beginPath();x.arc(X(e.min/90),e.side==='h'?mh+11:H-8,3.5,0,7);x.fill()});
 x.fillStyle='rgba(255,255,255,.55)';x.font="600 10px 'IBM Plex Mono',monospace";x.fillText('ATTACK MOMENTUM',X(0)+4,mh+14)}
/* basketball: court, the real shot chart, the last basket arcing in, the scoring margin */
function drawBasket(x,W,H,M,V,now){const ch=tc(M.h.n),ca=tc(M.a.n),cw=W-24,chh=H*.74,X=u=>12+u*cw,Y=v=>10+v*chh;const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#c98f52');g.addColorStop(1,'#b97b40');x.fillStyle=g;x.fillRect(X(0),Y(0),cw,chh);
 x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=2;x.strokeRect(X(0),Y(0),cw,chh);x.beginPath();x.moveTo(X(.5),Y(0));x.lineTo(X(.5),Y(1));x.stroke();x.beginPath();x.arc(X(.5),Y(.5),chh*.15,0,7);x.stroke();
 for(const s of[0,1]){const hx=s?X(.95):X(.05);x.beginPath();x.arc(hx,Y(.5),chh*.47,s?Math.PI/2:-Math.PI/2,s?Math.PI*1.5:Math.PI/2,!!s);x.stroke();x.strokeRect(s?X(.81):X(0),Y(.33),cw*.19,chh*.34);x.beginPath();x.arc(hx,Y(.5),6,0,7);x.strokeStyle='#ff6a00';x.stroke();x.strokeStyle='rgba(255,255,255,.8)'}
 /* shots: home attacks the right hoop */for(const s of M.shots||[]){const right=s.t===0,hx=right?.95:.05,px=hx+(right?-1:1)*Math.abs(s.y)*.4,py=.5+(s.x-.5)*.95;x.beginPath();x.arc(X(px),Y(py),s.made?5:4,0,7);if(s.made){x.fillStyle=right?ch:ca;x.fill()}else{x.strokeStyle=right?ch:ca;x.lineWidth=2;x.stroke();x.lineWidth=2}}
 const last=(M.shots||[]).slice(-1)[0];if(last&&last!==V.ls){V.ls=last;V.arc=now}if(V.arc&&now-V.arc<700&&last){const t=(now-V.arc)/700,right=last.t===0,sx=(right?.95:.05)+(right?-1:1)*Math.abs(last.y)*.4,sy=.5+(last.x-.5)*.95,ex=right?.95:.05,px=sx+(ex-sx)*t,py=sy+(.5-sy)*t-Math.sin(t*Math.PI)*.25;x.fillStyle='#ff7a00';x.beginPath();x.arc(X(px),Y(py),7,0,7);x.fill();
  if(t>.85&&last.made)label(x,last.three?'THREE!':'SCORES',X(right?.8:.2),Y(.12),right?ch:ca)}
 label(x,M.live?`${M.off===0?M.h.n:M.a.n} on offence ${M.off===0?'→':'←'}`:M.done?'FINAL':'TIP-OFF SOON',X(.5),Y(0)+16,'rgba(10,17,32,.85)');
 const run=M.run||[],top=chh+18,hh=H-top-6;x.fillStyle='rgba(255,255,255,.06)';x.fillRect(X(0),top,cw,hh);const mx=Math.max(8,...run.map(Math.abs)),yy=v=>top+hh/2-v/mx*hh/2;x.strokeStyle='rgba(255,255,255,.2)';x.beginPath();x.moveTo(X(0),top+hh/2);x.lineTo(X(1),top+hh/2);x.stroke();
 x.lineWidth=2.5;x.beginPath();run.forEach((v,i)=>{const px=X(i/36);i?x.lineTo(px,yy(v)):x.moveTo(px,yy(v))});x.strokeStyle='#fff';x.stroke();x.lineWidth=2;x.fillStyle='rgba(255,255,255,.55)';x.font="600 10px 'IBM Plex Mono',monospace";x.fillText('SCORE MARGIN · '+M.h.n.toUpperCase()+' ABOVE',X(0)+4,top+12)}
/* tennis: court, server, every point played out as a rally of the right length */
function drawTennis(x,W,H,M,V,now){const cw=W-40,chh=H*.68,X=u=>20+u*cw,Y=v=>12+v*chh;x.fillStyle='#2f6fb5';x.fillRect(0,0,W,chh+24);x.fillStyle='#3b84cf';x.fillRect(X(.08),Y(.08),cw*.84,chh*.84);x.strokeStyle='#fff';x.lineWidth=2;
 x.strokeRect(X(.08),Y(.08),cw*.84,chh*.84);x.strokeRect(X(.08),Y(.2),cw*.84,chh*.6);x.beginPath();x.moveTo(X(.5),Y(.02));x.lineTo(X(.5),Y(.98));x.lineWidth=4;x.stroke();x.lineWidth=2;x.beginPath();x.moveTo(X(.28),Y(.2));x.lineTo(X(.28),Y(.8));x.moveTo(X(.72),Y(.2));x.lineTo(X(.72),Y(.8));x.moveTo(X(.28),Y(.5));x.lineTo(X(.72),Y(.5));x.stroke();
 const hx=.04,ax=.96,pl=[[hx,M.h.n],[ax,M.a.n]];if(M.last&&M.last.w!==V.lastPt){V.lastPt=M.last.w;V.rally={...M.last,t0:now}}
 let bx=.5,by=.5,lab=null;const R0=V.rally;if(R0&&M.live){const shots=R0.rally+1,dur=shots*260+400,t=now-R0.t0;if(t<dur){const k=Math.min(shots-1,Math.floor(t/260)),f=(t%260)/260,from=k%2===0?R0.sv:1-R0.sv,to=1-from,yA=.3+((k*37)%40)/100,yB=.3+(((k+1)*37)%40)/100;
   bx=(from?ax-.05:hx+.05)+((to?ax-.05:hx+.05)-(from?ax-.05:hx+.05))*f;by=yA+(yB-yA)*f;if(k===shots-1&&f>.8)lab=R0.rally===0?'ACE':R0.df?'DOUBLE FAULT':'WINNER'}else lab=t<dur+1200?(R0.won===0?M.h.n:M.a.n)+' wins the point':null}
 for(const [px,n] of pl){const sv=(px===hx?0:1)===M.server;x.fillStyle=tc(n);x.beginPath();x.arc(X(px),Y(.5+(bx-.5)*0),10,0,7);x.fill();x.fillStyle='#fff';x.font="800 11px 'Barlow Condensed',sans-serif";x.textAlign='center';x.fillText(n.split(' ').pop().toUpperCase()+(sv?' · SERVING':''),X(px+(px<.5?.1:-.1)),Y(.06));x.textAlign='left'}
 x.fillStyle='#e8ff3a';x.beginPath();x.arc(X(bx),Y(by),6,0,7);x.fill();if(lab)label(x,lab.toUpperCase(),X(.5),Y(.5),'rgba(10,17,32,.85)');
 /* points: the last 24, coloured by who won them */const top=chh+34;(M.ptl||[]).forEach((p,i)=>{x.fillStyle=tc(p===0?M.h.n:M.a.n);x.beginPath();x.arc(24+i*((W-48)/23),top+10,6,0,7);x.fill()});x.fillStyle='rgba(255,255,255,.55)';x.font="600 10px 'IBM Plex Mono',monospace";x.fillText('LAST 24 POINTS',24,H-6)}
/* ---------- live refresh hook (called by the engine loop) ---------- */
setInterval(()=>{if(document.hidden||!loggedIn())return;const f=document.querySelector('.feat');if(f&&$('ftSc')){const m=MATCHES.find(z=>z.id==f.dataset.mt);if(m){$('ftSc').innerHTML=scoreTxt(m);$('ftC').textContent=clockTxt(m)}}
 document.querySelectorAll('.mc[data-mt]').forEach(c=>{const m=MATCHES.find(z=>z.id==c.dataset.mt);if(!m)return;const sc=c.querySelectorAll('.sc');if(sc.length===2){sc[0].textContent=m.live||m.done?(m.sp==='tennis'?m.sets[0]:m.hs):'';sc[1].textContent=m.live||m.done?(m.sp==='tennis'?m.sets[1]:m.as):''}const lv=c.querySelector('.lv');if(lv)lv.textContent='● '+clockShort(m);const pb=c.querySelector('.mpb i');if(pb)pb.style.width=progress(m)*100+'%'})},1000);
/* sports mode: its own palette while on sports or a match page */
const spMode=()=>document.body.classList.toggle('spm',/^#\/(sports|match)/.test(location.hash));addEventListener('hashchange',spMode);spMode();
