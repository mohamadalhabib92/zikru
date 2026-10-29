"""Vérifie que chaque extrait arabe (textAr) figure mot à mot dans l’édition citée.
Nécessite les pages Shamela/islamarchive en cache dans node_modules/.cache/fiqh/ (outil de dev, hors CI).
Usage : python3 scripts/verify-fiqh/check_textar.py"""
import re,glob,html,json,subprocess,sys
D='node_modules/.cache/fiqh/'
def norm(s):
    s=html.unescape(re.sub(r'<[^>]+>',' ',s))
    s=re.sub(r'[\u064B-\u0652\u0670\u0640]','',s)
    s=re.sub(r'[إأآٱ]','ا',s); s=s.replace('ى','ي').replace('ة','ه')
    s=re.sub(r'[^\u0621-\u064A]+',' ',s)
    return re.sub(r'\s+',' ',s).strip()
files={'mayyara':glob.glob(D+'14249_*.html')+glob.glob(D+'mayyara*.txt'),'risala':glob.glob(D+'11373_*')+glob.glob(D+'risala*'),
'shuja':glob.glob(D+'11370_*')+[D+'shuja.txt'],'safina':glob.glob(D+'ia_*')+[D+'ia01.txt'],'minhaj':glob.glob(D+'12096_*')+[D+'minhaj.txt'],
'nur':glob.glob(D+'12117_*')+glob.glob(D+'nur*.txt'),'umda':glob.glob(D+'11315_*')+[D+'umda.txt']}
corp={k:norm(' '.join(open(f,errors='ignore').read() for f in v)) for k,v in files.items()}
# extraits exportés par dump.mjs (fiqh + sahw)
out=subprocess.run(['node','scripts/verify-fiqh/dump.mjs'],capture_output=True,text=True)
bad=0
for r in json.loads(out.stdout):
    t=re.sub(r'\[[^\]]*\]','...',r['t']); t=re.sub(r'\([^)]*\)','...',t)
    for seg in t.split('...'):
        n=norm(seg)
        if len(n)<4: continue
        eds=[r['ed']]+r.get('alt',[])
        if not any(n in corp[e] for e in eds):
            # find longest matching prefix words
            w=n.split(); k=0
            while k<len(w) and ' '.join(w[:k+1]) in corp[r['ed']]: k+=1
            print('MISS',r['id'],'|',seg.strip()[:90],'| ok words',k,'/',len(w)); bad+=1
print('bad',bad)
