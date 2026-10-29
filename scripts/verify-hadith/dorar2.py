import json,re,html,urllib.request,urllib.parse,time,os
items=json.load(open('items.json')); sun=json.load(open('sunnah.json'))
D=re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]')
def norm(s):
    s=D.sub('',s or ''); s=re.sub('[إأآٱ]','ا',s); s=s.replace('ى','ي').replace('ة','ه')
    return re.findall(r'[\u0621-\u064A]+',s)
def overlap(app,src):
    a=norm(app); b=set(norm(src))
    return round(sum(1 for w in a if w in b)/max(1,len(a)),2)
# text match
tm={}
for it in items:
    for k in it['hadith']:
        s=sun.get(k,{})
        tm[it['set']+':'+it['id']+'|'+k]=overlap(it['ar'],s.get('arabic','')) if it['ar'] else None
json.dump(tm,open('textmatch.json','w'),indent=1)
low=[(k,v) for k,v in tm.items() if v is not None and v<0.6]
print('low overlap',len(low)); [print(' ',k,v) for k,v in low]
# dorar
cache=json.load(open('dorar.json')) if os.path.exists('dorar.json') else {}
COLL={'tirmidhi':'الترمذي','ibnmajah':'ابن ماجه','ahmad':'أحمد'}
def search(q,m):
    u='https://dorar.net/hadith/search?q='+urllib.parse.quote(q)+'&st=w&m%5B%5D='+m
    req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'})
    h=urllib.request.urlopen(req,timeout=40).read().decode('utf8','replace')
    t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape(h)))
    res=[]
    for m_ in re.finditer(r'\ufeff ?\d+ - (.*?)(?=\ufeff ?\d+ - |× غلق)',t):
        b=m_.group(1)
        g=re.search(r'خلاصة حكم المحدث : (.*?) الراوي',b); src=re.search(r'المصدر : (.*?) الصفحة أو الرقم : (\S+)',b); tk=re.search(r'التخريج : (.*?)(?: التصنيف|$)',b)
        res.append({'text':b[:160],'grade':g.group(1).strip() if g else '','book':src.group(1).strip() if src else '','num':src.group(2) if src else '','takhrij':tk.group(1)[:300] if tk else ''})
    return u,res
for it in items:
    for k in it['hadith']:
        c,n=k.split(':')
        if c not in COLL or not it['ar']: continue
        ck=it['set']+':'+it['id']+'|'+k
        if ck in cache: continue
        words=[w for w in norm(it['ar'])][:7]
        q=' '.join(words)
        out={'q':q,'hits':[]}
        for m,name in (('1420','al-Albani'),('1438',"Shu'ayb al-Arna'ut")):
            try: u,res=search(q,m)
            except Exception as e: print('err',ck,e); continue
            cn=COLL[c]
            for r in res:
                okbook=re.search(r'(صحيح|ضعيف) '+cn+'$',r['book']) and r['num']==n
                oktk=(cn+' ('+n+')') in r['takhrij'] or (cn+' ('+n+')') in r['takhrij'].replace('وابن ماجه','ابن ماجه')
                if okbook or oktk: r['grader']=name; r['url']=u; r['matchBy']='book' if okbook else 'takhrij'; out['hits'].append(r)
            time.sleep(0.8)
        cache[ck]=out; json.dump(cache,open('dorar.json','w'),ensure_ascii=False,indent=1)
        print(ck,'|',q,'|',[(h['grader'],h['grade'],h['book'],h['num']) for h in out['hits']][:4],flush=True)
