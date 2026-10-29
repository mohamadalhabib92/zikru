// Exporte en JSON tous les extraits arabes (fiqh + sahw) avec leur édition, pour check_textar.py.
import { loadLib } from '../load-lib.mjs';
const { 'fiqh-rulings': F, sahw: S } = await loadLib(['fiqh-rulings', 'sahw'], 'dump');
const ed = (u) => (u.includes('14249') ? 'mayyara' : u.includes('11373') ? 'risala' : u.includes('11370') ? 'shuja' : u.includes('25509') ? 'safina' : u.includes('12096') ? 'minhaj' : u.includes('12117') ? 'nur' : 'umda');
const out = F.RULINGS.map((r) => ({ id: r.id, ed: ed(r.source.url), t: r.textAr }));
for (const x of S.allSahwAnswers()) out.push({ id: x.uid, ed: ed(x.a.source.url), t: x.a.textAr, alt: (x.a.also ?? []).map((s) => ed(s.url)) });
for (const m of F.SCHOOLS) out.push({ id: 'sahw-how:' + m, ed: ed(S.HOW[m].source.url), t: S.HOW[m].textAr });
console.log(JSON.stringify(out));
