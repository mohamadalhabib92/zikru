import json, re, time, html, urllib.request, os
keys=[k for k in open('keys.txt').read().split('\n') if k]
def get(u):
    req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (Zikru content verification)'})
    try:
        with urllib.request.urlopen(req,timeout=30) as r: return r.status, r.read().decode('utf8','replace')
    except urllib.error.HTTPError as e: return e.code, ''
out={}
for k in keys:
    fn='html/'+k.replace(':','_')+'.html'
    u='https://sunnah.com/'+k
    if not os.path.exists(fn):
        st,h=get(u)
        if st==404 and k.startswith('muslim:'):
            u=u+'a'; st,h=get(u)
        if st==200: open(fn,'w').write(u+'\n'+h)
        time.sleep(0.6)
    if not os.path.exists(fn): out[k]={'url':u,'status':404}; continue
    raw=open(fn).read(); u,h=raw.split('\n',1)
    # first hadith block only
    blocks=re.split(r'<div class="actualHadithContainer',h)[1:] or [h]
    b=blocks[0]
    ref=re.search(r'<td>&nbsp;:&nbsp;<a href="([^"]*)">([^<]*)</a>',b)
    ge=re.search(r'class=english_grade width="36%">&nbsp;(.*?)</td>',b,re.S)
    ga=re.search(r'class="arabic_grade arabic">&nbsp;(.*?)</td>',b,re.S)
    clean=lambda s: re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape(s))).strip() if s else ''
    ar=' '.join(clean(a) for a in re.findall(r'class="arabic_hadith_full arabic">(.*?)</div>',h,re.S))
    out[k]={'url':u,'status':200,'ref':ref.group(2) if ref else '','grade_en':clean(ge.group(1)) if ge else '','grade_ar':clean(ga.group(1)) if ga else '','arabic':ar,'blocks':len(blocks)}
json.dump(out,open('sunnah.json','w'),ensure_ascii=False,indent=1)
for k,v in out.items():
    if not k.startswith(('bukhari','muslim')) or v['status']!=200: print(k,v['status'],v.get('ref'),'|',v.get('grade_en'),'|',v.get('grade_ar'))
