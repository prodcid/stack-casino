/* ================= BOOT ================= */
function boot2(){gate();if(!loggedIn())return;const x=X();AU.on=x.snd;lastVip=vipLevel().i;drawNav();drawBal();drawBell();missions();voidOldBets();
 $('avBtn').textContent=P().name[0].toUpperCase();$('mtrack')._k='';
 if(!location.hash||location.hash==='#/')location.hash='#/lobby';else route();
 const days=Math.floor((Date.now()-(x.lastSeen||Date.now()))/864e5);x.lastSeen=Date.now();save();
 setTimeout(()=>{if(canDaily())notify(days>=2?`We missed you, ${esc(P().name)}`:`Welcome back, ${esc(P().name)}`,'Your daily spin is ready. Keep your streak going.','gift','#/promos');else toast(`Welcome back, ${esc(P().name)}`,`${vipLevel().n} · ${fmt(P().bal)} credits`,'lt','user')},1200)}
loadStore();if(S.session&&S.session.u){const i=acctIdx(S.session.u);if(i>=0)S.cur=i}
seedMatches();for(let i=0;i<14;i++)simBet();boot2();
