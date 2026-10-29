"""Construit src/lib/gradings.gen.ts à partir des pages réellement consultées
(sunnah.com : sunnah.json ; dorar.net : dorar.json). Aucun jugement n'est inventé :
seules les mentions affichées par ces sites sont recopiées (texte brut conservé)."""
import json, re, sys, os
CACHE = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'src/lib/gradings.gen.ts'
CHECKED = '2026-10-29'
sun = json.load(open(os.path.join(CACHE, 'sunnah.json')))
dor = json.load(open(os.path.join(CACHE, 'dorar.json')))
tm = json.load(open(os.path.join(CACHE, 'textmatch.json')))

def cls(raw):
    r = raw.replace('’', "'")
    if 'موضوع' in r or 'Fabricated' in r: return 'mawdu'
    if 'ضعيف جدا' in r or 'Very Da' in r: return 'daif_jiddan'
    if 'إسناده ضعيف' in r: return 'daif_isnad'
    if 'ضعيف' in r or "Da'if" in r: return 'daif'
    if 'صحيح لغيره' in r or 'صحيح [لغيره]' in r: return 'sahih_li_ghayrihi'
    if 'حسن لغيره' in r: return 'hasan_li_ghayrihi'
    if 'حسن صحيح' in r or 'Hasan Sahih' in r: return 'hasan_sahih'
    if 'إسناده صحيح' in r or 'Sahih in chain' in r: return 'sahih_isnad'
    if 'إسناده حسن' in r or 'حسن الإسناد' in r or 'Hasan in chain' in r: return 'hasan_isnad'
    if 'حسن' in r or 'Hasan' in r: return 'hasan'
    if 'صحيح' in r or 'Sahih' in r: return 'sahih'
    return 'autre'

COLL_AR = {'tirmidhi': 'الترمذي', 'ibnmajah': 'ابن ماجه', 'ahmad': 'أحمد', 'abudawud': 'أبي داود'}
def prio(h, c, n):
    b = h.get('book', '')
    if re.search(r'^(صحيح|ضعيف) ' + COLL_AR.get(c, '#') + '$', b) and (h.get('num') == n or c == 'ibnmajah'): return 0
    if 'تخريج المسند' in b and c == 'ahmad': return 0
    if 'السلسلة' in b: return 1
    if b in ('صحيح الجامع', 'ضعيف الجامع'): return 2
    if 'الترغيب' in b: return 3
    return 4

checks = {}
for key, s in sun.items():
    c, n = key.split(':')
    if s.get('status') != 200:
        checks[key] = {'key': key, 'label': key, 'url': s['url'], 'found': False, 'gradings': []}
        continue
    g = []
    if c in ('bukhari', 'muslim'):
        name = 'al-Bukhārī' if c == 'bukhari' else 'Muslim'
        g.append({'grade': 'sahih', 'raw': 'Ṣaḥīḥ — figure dans le Ṣaḥīḥ de ' + name, 'grader': name + ' (recueil Ṣaḥīḥ)', 'site': 'sunnah.com', 'url': s['url']})
    else:
        raw = s.get('grade_en') or s.get('grade_ar')
        if raw:
            m = re.search(r'\(([^)]+)\)\s*$', s.get('grade_en') or '') or re.search(r'\(([^)]+)\)\s*$', s.get('grade_ar') or '')
            who = m.group(1) if m else ''
            who = {'Al-Albani': 'al-Albānī', 'الألباني': 'al-Albānī', 'Darussalam': 'Darussalam (Zubair ‘Ali Za’i)'}.get(who, who)
            text = (s.get('grade_en') or '') + ((' / ' + s['grade_ar']) if s.get('grade_ar') else '')
            g.append({'grade': cls(text), 'raw': text.strip(' /'), 'grader': who, 'site': 'sunnah.com', 'url': s['url']})
    checks[key] = {'key': key, 'label': s.get('ref') or key, 'url': s['url'], 'found': True, 'gradings': g}

for ik, d in dor.items():
    key = ik.split('|')[1]
    c, n = key.split(':')
    if key not in checks: continue
    have = {x['grader'] for x in checks[key]['gradings'] if x['site'] == 'dorar.net'}
    for grader in ('al-Albani', "Shu'ayb al-Arna'ut"):
        hits = [h for h in d['hits'] if h.get('grader') == grader]
        if grader != 'al-Albani':
            # Shu‘ayb : uniquement son takhrij du même recueil au même numéro (sinon il juge une autre chaîne).
            own = {'ahmad': 'تخريج المسند لشعيب', 'abudawud': 'تخريج سنن أبي داود', 'ibnmajah': 'تخريج سنن ابن ماجه', 'tirmidhi': 'تخريج سنن الترمذي'}.get(c)
            hits = [h for h in hits if own and h.get('book') == own and h.get('num') == n]
        if not hits: continue
        best = sorted(hits, key=lambda h: prio(h, c, n))[0]
        name = 'al-Albānī' if grader == 'al-Albani' else 'Shu‘ayb al-Arna’ūṭ'
        if name in have: continue
        have.add(name)
        others = sorted({cls(h['grade']) for h in hits})
        e = {'grade': cls(best['grade']), 'raw': best['grade'], 'grader': name, 'book': best['book'] + ' ' + best['num'], 'site': 'dorar.net', 'url': best['url']}
        if len(others) > 1: e['also'] = others
        checks[key]['gradings'].append(e)

WEAK = {'daif', 'daif_isnad', 'daif_jiddan', 'mawdu'}
for k, v in checks.items():
    classes = set()
    for x in v['gradings']:
        classes.add('w' if x['grade'] in WEAK else 's')
        for o in x.get('also', []): classes.add('w' if o in WEAK else 's')
    v['divergence'] = len(classes) > 1

hdr = '''/* eslint-disable */
// FICHIER GÉNÉRÉ par scripts/verify-hadith/build.py — ne pas modifier à la main.
// Jugements recopiés tels qu'affichés par sunnah.com et dorar.net (consultés le %s).
// Aucun jugement n'est déduit ni deviné : absence = « grading non vérifié ».
import type { HadithCheck } from './provenance-types';

export const GRADINGS_CHECKED_AT = '%s';

''' % (CHECKED, CHECKED)
with open(OUT, 'w') as f:
    f.write(hdr)
    f.write('export const HADITH_CHECKS: Record<string, HadithCheck> = ' + json.dumps(checks, ensure_ascii=False, indent=1, sort_keys=True) + ';\n\n')
    f.write('/** Part des mots arabes de l’app retrouvés dans le texte de la page source (0–1). Indicatif. */\n')
    f.write('export const TEXT_MATCH: Record<string, number> = ' + json.dumps({k: v for k, v in tm.items() if v is not None}, ensure_ascii=False, indent=1, sort_keys=True) + ';\n')
print('checks', len(checks), 'with grading', sum(1 for v in checks.values() if v['gradings']), 'divergence', [k for k, v in checks.items() if v['divergence']])
