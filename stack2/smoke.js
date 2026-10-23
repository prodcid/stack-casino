const pw=require('D:/Stack Casino/node_modules/playwright');const OUT='D:/Stack Casino/stack2/shots/';const P=process.argv[2]||'a';
(async()=>{const b=await pw.chromium.launch(),errs=[];const pg=await b.newPage({viewport:{width:1500,height:920}});pg.on('pageerror',e=>errs.push(''+e.stack));pg.on('console',m=>{if(m.type()==='error')errs.push('c:'+m.text())});
 await pg.goto('file:///D:/Stack Casino/stack-casino.html');await pg.waitForTimeout(800);await pg.screenshot({path:OUT+P+'-gate.png'});
 await pg.click('#auSw');await pg.fill('#auU','tester');await pg.fill('#auP','pw1');await pg.fill('#auP2','pw1');await pg.click('#auGo');await pg.waitForTimeout(1500);
 await pg.evaluate("closeAll()");await pg.waitForTimeout(500);await pg.screenshot({path:OUT+P+'-lobby.png'});
 const routes=['#/c/orig','#/play/crash','#/play/dice','#/play/plinko','#/play/mines','#/play/blackjack','#/play/baccarat','#/play/vpoker','#/play/holdem','#/play/roulette','#/sports','#/micro','#/promos','#/vip','#/safer','#/account/wallet','#/missions','#/play/penalty','#/play/towers','#/play/wheel','#/play/hilo','#/play/reddog','#/play/tcp','#/play/war','#/play/coin','#/play/limbo'];
 for(const r of routes){await pg.evaluate(h=>location.hash=h,r);await pg.waitForTimeout(r.startsWith('#/play')?1100:700);const n=r.replace(/[#/]/g,'_');if(['#/play/crash','#/play/blackjack','#/play/holdem','#/play/roulette','#/sports','#/micro','#/play/plinko','#/promos','#/safer'].includes(r))await pg.screenshot({path:OUT+P+n+'.png'})}
 const mid=await pg.evaluate("MATCHES.find(m=>m.live&&m.sp==='football').id");await pg.evaluate(id=>location.hash='#/match/'+id,mid);await pg.waitForTimeout(1500);await pg.screenshot({path:OUT+P+'-match.png'});
 console.log(errs.slice(0,10).join('\n')||'no errors');await b.close()})();
