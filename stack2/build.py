# Stack 2: stack2/*.html|js parts + a selection of the recorded Kenney sounds (from stack-tables.html) -> ../stack-casino.html
import io,os,re,json,collections
here=os.path.dirname(os.path.abspath(__file__));root=os.path.dirname(here)
t=io.open(os.path.join(root,'stack-tables.html'),encoding='utf8').read();i=t.index('const SND_B64=');j=t.index(';\n',i);allsnd=json.loads(t[i+14:j])
keep=[k for k in allsnd if re.match(r'(card-place-[1-3]|card-slide-[1-4]|card-shuffle|card-fan-1|chip-lay-[1-3]|chips-stack-[1-3]|chips-collide-[1-2]|chips-handle-[1-3]|dice-throw-[1-2]|dice-shake-1)$',k)]
snd='/* Kenney "Casino Audio" (kenney.nl), CC0 - recorded card, chip and dice sounds */\nconst SND_B64='+json.dumps({k:allsnd[k] for k in keep},separators=(',',':'))+';\n'
parts=sorted(p for p in os.listdir(here) if re.match(r'\d\d-.*\.(html|js)$',p))
head=io.open(os.path.join(here,parts[0]),encoding='utf8').read()
js=snd+''.join(io.open(os.path.join(here,p),encoding='utf8').read().rstrip('\n')+'\n' for p in parts[1:])
out=head+js+'</script>\n</body>\n</html>\n'
names=re.findall(r'^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*))',js,re.M)
c=collections.Counter([a or b for a,b in names]);d=[k for k,v in c.items() if v>1]
assert not d,('duplicate declarations',d)
dst=os.path.join(root,'stack-casino.html')
old=io.open(dst,encoding='utf8').read() if os.path.exists(dst) else ''
old=re.sub(r'<meta name="stack-version" content="[^"]*">','<meta name="stack-version" content="dev">',old)
if old!=out:  # unchanged: leave the file (and its version stamp) alone, so ship.js doesn't make CLAUDE.md look stale
    io.open(dst,'w',encoding='utf8',newline='\n').write(out)
print('built stack-casino.html',len(out),'bytes,',len(keep),'sounds,',', '.join(parts),'' if old!=out else '(unchanged)')
