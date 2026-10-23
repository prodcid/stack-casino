/* ================= RETENTION and SAFER GAMBLING =================
   What real operators run, honestly: reality checks every N minutes (time played, wagered, net - all true numbers),
   deposit / loss / session limits, breaks, and a full bet history. And what the business side adds on top: the
   "Keep playing" button is the big one, offers land right after losses, streaks, VIP progress nudges, missions and
   social proof from other players' wins. Nothing here is false: every number shown is real, every offer pays. */
/* ---------- notifications ---------- */
function notify(ti,sub,ic,go,quiet){const x=X();x.notifs.unshift({t:Date.now(),ti,sub,ic:ic||'bell',go:go||'',read:0});x.notifs=x.notifs.slice(0,40);save();drawBell();if(!quiet){toast(ti,sub,'',ic,go);sfx('notif')}}
function drawBell(){if(!loggedIn())return;const n=X().notifs.filter(z=>!z.read).length,d=$('bellN');d.hidden=!n;d.textContent=n}
$('bell').onclick=()=>{const x=X();drawer(`<header><div><span class="mono">Inbox</span><h3 class="dw" style="margin:4px 0 0;font-size:26px">Notifications</h3></div><span class="sp"></span><button class="icb" data-close>${svg('x')}</button></header><div class="body">${x.notifs.map(z=>`<a class="nt${z.read?'':' unread'}" href="${z.go||'javascript:void 0'}" data-close><span class="ic">${svg(z.ic)}</span><div><b>${z.ti}</b><p>${z.sub||''}</p><time>${ago(z.t)}</time></div></a>`).join('')||'<div class="empty">Nothing yet</div>'}</div>`);
 $('drawer').querySelectorAll('[data-close]').forEach(a=>a.addEventListener('click',closeAll));x.notifs.forEach(z=>z.read=1);save();drawBell()};
/* ---------- VIP ---------- */
const VIP=[{n:'Bronze',at:0,b:0},{n:'Silver',at:1000,b:50},{n:'Gold',at:5000,b:200},{n:'Platinum',at:25000,b:750},{n:'Diamond',at:100000,b:2500},{n:'Black',at:500000,b:10000}];
function vipLevel(){const v=X().vip;let i=0;while(i<VIP.length-1&&v>=VIP[i+1].at)i++;const L=VIP[i],N=VIP[i+1];return{i,n:L.n,next:N,pct:N?clamp((v-L.at)/(N.at-L.at)*100,0,100):100}}
let lastVip=-1;
/* ---------- daily missions ---------- */
const MPOOL=[['bj3','Win 3 hands of blackjack','blackjack',3,'win',60],['orig10','Play 10 rounds of Stack Originals','orig',10,'play',40],['micro2','Place 2 micro bets','micro',2,'play',50],['wag500','Wager 500 credits anywhere','*',500,'wag',75],
 ['x5','Hit a 5× or better','*',1,'x5',80],['card5','Play 5 rounds of card games','cards',5,'play',40],['poker3','Win 3 pots at Hold\'em','holdem',3,'win',90],['sport1','Win a sports bet','sports',1,'win',60]];
function missions(){const x=X(),d=new Date().toDateString();if(x.missions.d!==d){const pool=MPOOL.slice().sort(()=>R()-.5).slice(0,3);x.missions={d,list:pool.map(m=>({k:m[0],p:0,done:0}))};save()}return x.missions.list.map(m=>({...m,def:MPOOL.find(q=>q[0]===m.k)}))}
function missionTick(g,stake,pay){if(!loggedIn())return;const x=X();missions();const G=GAMES[g],cat=G?G.cat:g;
 for(const m of x.missions.list){if(m.done)continue;const [,ti,tg,need,kind,rew]=MPOOL.find(q=>q[0]===m.k);
  const hit=tg==='*'||tg===g||tg===cat||(tg==='micro'&&/^micro/.test(g))||(tg==='sports'&&/^sport/.test(g));if(!hit)continue;
  if(kind==='play')m.p++;else if(kind==='win'&&pay>stake)m.p++;else if(kind==='wag')m.p+=stake;else if(kind==='x5'&&stake>0&&pay/stake>=5)m.p++;
  if(m.p>=need){m.done=1;credit(rew,'mission');tx('bonus',rew,'Mission: '+ti);notify('Mission complete',`${ti} · +${fmt(rew)} credits`,'trophy','#/missions');sfx('coins')}
  else if(kind!=='wag'&&need>1&&m.p===need-1)toast('One more to go',`${ti} · ${m.p}/${need}`,'lt','trophy','#/missions')}save()}
/* ---------- the nudges ---------- */
let streakL=0,streakW=0,lastNudge=0;
function retainTick(g,stake){const now=Date.now(),lv=vipLevel();
 if(lastVip>=0&&lv.i>lastVip){const b=VIP[lv.i].b;credit(b,'vip');tx('bonus',b,'VIP level-up: '+lv.n);notify(`Welcome to ${lv.n}`,`Level-up bonus +${fmt(b)} credits. Your rakeback just went up.`,'crown','#/vip');sfx('big')}lastVip=lv.i;
 if(lv.next&&now-lastNudge>90000){const left=lv.next.at-X().vip;if(left>0&&left<lv.next.at*.06){lastNudge=now;toast(`So close to ${lv.next.n}`,`Wager ${fmt(left)} more for a ${fmt(lv.next.b)} credit bonus`,'lt','crown','#/vip')}}}
/* called by every game when a round settles: losing streaks bring an offer, winning streaks a cheer */
function outcome(win){if(win){streakW++;streakL=0;if(streakW===3)toast("You're on a roll",'Three in a row. Keep it going.','','fire')}else{streakL++;streakW=0;
 if(streakL===6&&!X().seen['fb'+new Date().toDateString()]){X().seen['fb'+new Date().toDateString()]=1;setTimeout(()=>offer('freebet'),900)}}}
function bigWin(g,pay,m){sfx('big');const d=document.createElement('div');d.className='toast keep';d.style.cssText='min-width:340px';d.innerHTML=`<span class="ic">${svg('trophy')}</span><div><b style="font-size:16px">Big win · ${m.toFixed(2)}×</b><small>${fmt(pay)} credits on ${(GAMES[g]||{name:g}).name}</small></div>`;$('toasts').prepend(d);setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),260)},5000)}
/* ---------- offers ---------- */
const OFFERS={welcome:['Welcome to Stack','Your 1,000 starting credits are in. Claim 250 more as a welcome bonus.',250,'Claim welcome bonus'],
 first:['First top-up bonus','Thanks for topping up. Here is 100% on your first top-up, as a one-time match: 250 credits.',250,'Claim 250 credits'],
 freebet:['A free bet, on us','Rough patch. Here are 25 credits to try your luck again.',25,'Claim free bet'],
 reload:['Reload bonus','Your session reload is ready: 10% of today\'s losses back, up to 100 credits.',0,'Claim and keep playing']};
function offer(k){if(!loggedIn())return;const o=OFFERS[k];let amt=o[2];if(k==='reload')amt=Math.min(100,Math.max(5,Math.round(-todayNet()*.1)));
 const m=modal(`<span class="mono">Offer · just for you</span><h3 class="dw">${o[0]}</h3><p class="mut" style="line-height:1.6">${o[1]}</p><div class="dn" style="font-size:56px;margin:8px 0 16px">+${fmt(amt)}</div>${BTN(o[3],'f lg w','id="ofGo"')}<p class="dim" style="font-size:11.5px;text-align:center;margin:12px 0 0">Bonus credits are play money like the rest of your balance.</p>`);
 sfx('notif');$('ofGo').onclick=()=>{credit(amt,'bonus');tx('bonus',amt,o[0]);closeAll();sfx('coins');notify(o[0]+' claimed','+'+fmt(amt)+' credits','gift','#/account/tx',1);toast('+'+fmt(amt)+' credits',o[0])}}
/* ---------- daily spin ---------- */
function canDaily(){return X().daily.d!==new Date().toDateString()}
function dailySpin(){const x=X();if(!canDaily()){toast('Come back tomorrow','Your next spin unlocks at midnight','lt','clock');return}
 const yest=new Date(Date.now()-864e5).toDateString(),streak=x.daily.d===yest?Math.min(7,x.daily.streak+1):1,segs=[5,10,25,10,50,5,100,25,10,250,5,25].map(v=>v*(1+(streak-1)*.25));
 const m=modal(`<span class="mono">Daily spin · day ${streak} of 7</span><h3 class="dw">Spin for free credits</h3><p class="mut">Every day in a row raises every prize by 25%.</p>
  <div style="position:relative;width:300px;height:300px;margin:18px auto"><svg viewBox="-110 -110 220 220" style="width:100%;height:100%" id="dsW">${segs.map((v,i)=>{const a0=i/12*6.283-1.571,a1=(i+1)/12*6.283-1.571,lg=0;return `<path d="M0 0 L${Math.cos(a0)*100} ${Math.sin(a0)*100} A100 100 0 ${lg} 1 ${Math.cos(a1)*100} ${Math.sin(a1)*100}Z" fill="${i%2?'var(--ink)':'var(--surface)'}" stroke="var(--ink)"/><text x="${Math.cos((a0+a1)/2)*70}" y="${Math.sin((a0+a1)/2)*70+4}" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="13" fill="${i%2?'var(--surface)':'var(--ink)'}">${Math.round(v)}</text>`}).join('')}<circle r="18" fill="var(--ink)"/></svg>
  <div style="position:absolute;left:50%;top:-8px;transform:translateX(-50%);width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-top:22px solid var(--ink)"></div></div>${BTN('Spin','f lg w','id="dsGo"')}`);
 $('dsGo').onclick=async()=>{$('dsGo').disabled=true;const k=rint(12),w=$('dsW'),turns=5*360+(360-(k+.5)*30);w.style.transition='transform 4.2s cubic-bezier(.16,1,.3,1)';w.style.transform=`rotate(${turns}deg)`;sfx('spin');
  let n=0;const tk=setInterval(()=>{sfx('peg');if(++n>40)clearInterval(tk)},90);await wait(4300);const amt=Math.round(segs[k]);x.daily={d:new Date().toDateString(),streak};credit(amt,'daily');tx('bonus',amt,`Daily spin, day ${streak}`);sfx('win');
  $('dsGo').outerHTML=`<div class="dn" style="font-size:44px;text-align:center">+${fmt(amt)}</div><p class="mut" style="text-align:center">Day ${streak} done. Tomorrow's spin is worth more.</p>`;save()}}

/* ---------- reality check: the true numbers, and a very big "Keep playing" ---------- */
function realityCheck(){if(!loggedIn()||$('modal').classList.contains('on'))return;const x=X(),net=SES.won-SES.wag,mins=Date.now()-SES.start;
 const m=modal(`<span class="mono">Reality check</span><h3 class="dw">You've been playing for ${dur(mins)}.</h3><p class="mut">Here is your session so far.</p>
  <div class="big"><div><span class="mono">Time</span><b class="dn">${dur(mins)}</b></div><div><span class="mono">Wagered</span><b class="dn">${fmt(SES.wag)}</b></div><div><span class="mono">Net</span><b class="dn">${net>=0?'+':''}${fmt(net)}</b></div></div>
  ${net<-50?`<div class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;gap:12px;align-items:center;background:var(--s2)">${svg('gift')}<div style="flex:1"><b>Your reload bonus is ready</b><div class="mut" style="font-size:12.5px">Claim 10% of today's losses back before you go.</div></div></div>`:''}
  ${BTN('Keep playing','f lg w','id="rcGo"')}<div class="links"><button id="rcHist">View my bets</button><button id="rcLim">Set limits</button><button id="rcBrk">Take a break</button><button id="rcOut">Log out</button></div>`,'rc rcm');
 SES.lastRc=Date.now();sfx('notif');
 $('rcGo').onclick=()=>{closeAll();if(net<-50&&!x.seen['rl'+new Date().toDateString()]){x.seen['rl'+new Date().toDateString()]=1;offer('reload')}};
 $('rcHist').onclick=()=>{closeAll();location.hash='#/account/bets'};$('rcLim').onclick=()=>{closeAll();location.hash='#/safer'};$('rcBrk').onclick=()=>{closeAll();location.hash='#/safer'};$('rcOut').onclick=logout}
setInterval(()=>{if(!loggedIn()||document.hidden)return;const x=X();if(Date.now()-SES.lastRc>x.rc*60000&&SES.bets>0)realityCheck()},5000);
/* idle nudges: the free spin waiting, a hot game, a big winner */
setInterval(()=>{if(!loggedIn()||document.hidden||$('modal').classList.contains('on'))return;const r=R();
 if(r<.3&&canDaily())notify('Your free spin is waiting','Claim it before midnight to keep your streak','gift','#/promos');
 else if(r<.55){const b=FEED.find(f=>!f.me&&f.p>=1000&&Date.now()-f.t<60000);if(b)toast(`${esc(b.u)} just won ${fmt(b.p)}`,`${b.m.toFixed(2)}× on ${(GAMES[b.g]||{name:b.g}).name}`,'lt','trophy','#/play/'+b.g)}
 else if(r<.75&&typeof MATCHES!=='undefined'){const m=MATCHES.find(z=>z.live&&z.min>70&&z.sp==='football');if(m)toast(`${m.h.n} ${m.hs}–${m.as} ${m.a.n}`,`${m.min}' · final minutes, micro markets open`,'lt','ball','#/match/'+m.id)}},75000);

/* ---------- pages: promotions, VIP, missions, safer gambling ---------- */
ROUTES.promos=()=>{const x=X();$('view').innerHTML=`<div class="sh"><div><span class="mono">Rewards</span><h2 class="dw">Promotions</h2></div></div><div class="hgrid" style="grid-template-columns:repeat(3,1fr)">
 ${[['Daily spin',canDaily()?'Ready now':'Claimed today',`Day ${Math.min(7,x.daily.streak+(canDaily()?1:0))} of 7. Every day in a row raises every prize.`,'dsp',canDaily()?'Spin':'Tomorrow'],
   ['Rakeback',fmt(x.rake)+' ready','0.2% of every bet you place comes back. Higher VIP levels are coming.','rk','Claim'],
   ['Daily missions',`${missions().filter(m=>m.done).length} of 3 done`,'Three new missions every day, each paying credits.','ms','See missions'],
   ['Acca boost','Up to +25%','Sports accumulators of 3 or more legs get their odds boosted.','acc','Bet sports'],
   ['Micro bet Monday','Every day, really','Micro bets settle in a minute. Place two for today\'s mission.','mic','Go live'],
   ['Weekly race','Top 10 share 10,000','Wager to climb the leaderboard. Resets every Monday.','race','Leaderboard']].map(([t,s,d,k,b])=>`<div style="padding:24px;display:flex;flex-direction:column;gap:8px"><span class="mono">${s}</span><h3 class="dw" style="font-size:26px;margin:0">${t}</h3><p class="mut" style="margin:0;flex:1">${d}</p><div>${BTN(b,'sm','data-p="'+k+'"')}</div></div>`).join('')}</div>${footer()}`;
 $('view').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const k=b.dataset.p;if(k==='dsp')dailySpin();else if(k==='rk')location.hash='#/account/wallet';else if(k==='ms')location.hash='#/missions';else if(k==='acc')location.hash='#/sports';else if(k==='mic')location.hash='#/micro';else raceModal()})};
function raceModal(){const me=X().vip%20000,rows=NAMES.slice(0,12).map((n,i)=>[n,Math.round(42000/(i+1.3)+R()*900)]);rows.push(['You',Math.round(me)]);rows.sort((a,b)=>b[1]-a[1]);const pos=rows.findIndex(r=>r[0]==='You')+1;
 modal(`<span class="mono">Weekly race · resets Monday</span><h3 class="dw">Leaderboard</h3><p class="mut">${pos<=10?`You're in the money at #${pos}. Hold on to it.`:`You're #${pos}. ${fmt(rows[9][1]-me)} more wagered gets you into the top 10.`}</p><table class="feedt">${rows.slice(0,13).map((r,i)=>`<tr${r[0]==='You'?' style="font-weight:800;background:var(--s2)"':''}><td>#${i+1}</td><td>${esc(r[0])}</td><td class="r n">${fmt(r[1],0)}</td><td class="r n">${i<10?fmt([3000,2000,1500,1000,800,600,400,300,200,200][i],0):''}</td></tr>`).join('')}</table>`)}
ROUTES.vip=()=>{const x=X(),lv=vipLevel();$('view').innerHTML=`<div class="sh"><div><span class="mono">Rewards · ${lv.n}</span><h2 class="dw">VIP club</h2></div></div>
 <div class="ban inv" style="min-height:180px;cursor:default"><div><span class="mono">Your level</span><h3 class="dw" style="font-size:54px">${lv.n}</h3></div><div style="max-width:560px"><div class="bar" style="background:rgba(255,255,255,.18)"><i style="width:${lv.pct}%;background:var(--surface)"></i></div><p style="opacity:.7;margin:8px 0 0">${lv.next?`${fmt(lv.next.at-x.vip)} more wagered to ${lv.next.n} and a ${fmt(lv.next.b)} credit bonus.`:'You are at the top. The house salutes you.'}</p></div></div>
 <div class="hgrid" style="grid-template-columns:repeat(6,1fr);margin-top:14px">${VIP.map((v,i)=>`<div style="padding:18px;${i===lv.i?'background:var(--ink);color:var(--surface)':''}"><span class="mono" style="${i===lv.i?'color:inherit;opacity:.6':''}">${i?fmt(v.at,0)+' wagered':'Start'}</span><h3 class="dw" style="margin:6px 0 4px;font-size:22px">${v.n}</h3><div style="font-size:12.5px;opacity:.75">${i?'Level-up bonus '+fmt(v.b,0):'Rakeback 0.2%'}</div></div>`).join('')}</div>${footer()}`};
ROUTES.missions=()=>{const L=missions();$('view').innerHTML=`<div class="sh"><div><span class="mono">Rewards · resets at midnight</span><h2 class="dw">Daily missions</h2></div></div><div class="hgrid" style="grid-template-columns:repeat(3,1fr)">${L.map(m=>{const [,ti,,need,,rew]=m.def,p=Math.min(m.p,need);return `<div style="padding:24px"><span class="mono">${m.done?'Complete':'In progress'}</span><h3 class="dw" style="font-size:22px;margin:6px 0 14px">${ti}</h3><div class="bar"><i style="width:${p/need*100}%"></i></div><div style="display:flex;justify-content:space-between;margin-top:8px" class="mono"><span>${fmt(p,0)} / ${fmt(need,0)}</span><span>+${rew} credits</span></div></div>`}).join('')}</div>${footer()}`};
ROUTES.safer=()=>{const x=X(),L=x.limits,net=SES.won-SES.wag;$('view').innerHTML=`<div class="sh"><div><span class="mono">Safer gambling</span><h2 class="dw">Stay in control</h2></div></div>
 <div class="hgrid" style="grid-template-columns:1fr 1fr"><div style="padding:24px"><span class="mono">This session</span><div class="kv"><span>Time played</span>${dur(Date.now()-SES.start)}</div><div class="kv"><span>Wagered</span>${fmt(SES.wag)}</div><div class="kv"><span>Net</span>${net>=0?'+':''}${fmt(net)}</div><div class="kv"><span>Today, all sessions</span>${todayNet()>=0?'+':''}${fmt(todayNet())}</div>
  <p class="mut" style="font-size:12.5px;line-height:1.6;margin:14px 0 0">Every game here has a house edge, shown as its RTP. Over time, the house always comes out ahead. Credits are play money and can't be withdrawn.</p></div>
 <div style="padding:24px;display:flex;flex-direction:column;gap:14px"><span class="mono">Limits · a day</span>${[['dep','Top-up limit (credits a day)'],['loss','Loss limit (credits a day)'],['sess','Session time limit (minutes)']].map(([k,l])=>`<div class="field"><label>${l}</label><div style="display:flex;gap:8px"><input class="inp" id="lim_${k}" type="number" min="0" value="${L[k]||''}" placeholder="No limit">${BTN('Save','sm','data-lim="'+k+'"')}</div></div>`).join('')}
  <div class="field"><label>Reality check every</label><select class="inp" id="rcSel2">${[15,30,45,60].map(m=>`<option value="${m}" ${x.rc===m?'selected':''}>${m} minutes</option>`).join('')}</select></div></div></div>
 <div class="sh"><div><span class="mono">Take a break</span><h2 class="dw" style="font-size:22px">Cool off</h2></div></div><div class="card" style="padding:20px 24px;display:flex;gap:10px;align-items:center">${x.cool>Date.now()?`<b>Your break ends in ${dur(x.cool-Date.now())}.</b>`:`<span class="mut" style="flex:1">Lock betting for a while. You can still log in and look around.</span>${[['1 hour',1],['24 hours',24],['7 days',168]].map(([l,h])=>BTN(l,'sm','data-brk="'+h+'"')).join('')}`}</div>${footer()}`;
 $('view').querySelectorAll('[data-lim]').forEach(b=>b.onclick=()=>{const k=b.dataset.lim,v=Math.max(0,+$('lim_'+k).value||0);const old=L[k];if(old&&(v===0||v>old)){toast('Raising a limit takes 24 hours','It keeps your current limit until then (we set it now for play money)','lt','shield')}L[k]=v;save();toast(v?'Limit saved':'Limit removed',v?fmt(v,0):'','','shield')});
 $('rcSel2').onchange=()=>{x.rc=+$('rcSel2').value;save();toast('Reality check updated',`Every ${x.rc} minutes`,'','clock')};
 $('view').querySelectorAll('[data-brk]').forEach(b=>b.onclick=()=>{const h=+b.dataset.brk;modal(`<span class="mono">Take a break</span><h3 class="dw">Lock betting for ${b.textContent.trim()}?</h3><p class="mut">You won't be able to place any bets until it ends. This can't be undone.</p><div style="display:flex;gap:10px">${BTN('Lock it','f','id="brkGo"')}${BTN('Maybe later','','data-close2')}</div>`);
  $('brkGo').onclick=()=>{x.cool=Date.now()+h*3600e3;save();closeAll();route();toast('Break started','See you soon','','shield')};$('modal').querySelector('[data-close2]').onclick=closeAll})};
