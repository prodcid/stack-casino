# Stack Casino rebrand site: src.html + site.js + the Stack Motion Vault catalogue -> stack-site.html
import io,os,sys,re
here=os.path.dirname(os.path.abspath(__file__))
VAULT=sys.argv[2] if len(sys.argv)>2 else os.path.join(here,'motion-vault.html')
OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(here,'..','stack-site.html')
v=io.open(VAULT,encoding='utf8').read()
# shared primitives CSS (chips, cards, dice, buttons, icons...) - the specimen CSS is added at runtime from the catalogue
a=v.index('/* shared primitives */');b=v.index('</style>',a);css=v[a:b]
# the catalogue and its helpers, minus the vault page's own build/UI
s0=v.index('/* ================= helpers');s1=v.index('/* ================= build',s0);js=v[s0:s1]
mv="const MV=(()=>{\n"+js+"""
function applySpeed(root){}
function play(st){st.classList.remove('go');void st.offsetWidth;st.classList.add('go');st._last=performance.now();const it=st._item;if(it&&it.j)try{it.j(st)}catch(e){console.error(it.id,e)}}
const style=document.createElement('style');style.textContent=CATS.flatMap(c=>c.items.map(i=>i.c||'')).join(String.fromCharCode(10))+' .skb{display:grid;gap:8px}';document.head.appendChild(style);
return{CATS,play,odoHTML,odoSet,fmt,RIB,tween,countTo};})();"""
src=io.open(os.path.join(here,'src.html'),encoding='utf8').read()
site=io.open(os.path.join(here,'site.js'),encoding='utf8').read()
out=src.replace('/*@@MV_CSS@@*/',css).replace('/*@@MV_JS@@*/',mv).replace('/*@@SITE_JS@@*/',site)
assert '@@' not in out
io.open(OUT,'w',encoding='utf8',newline='\n').write(out)
print('built',OUT,len(out))
