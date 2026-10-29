// Génère src/lib/quran-duas.ts : texte coranique exact (api.alquran.cloud, quran-simple-enhanced),
// translittération (en.transliteration), traduction Hamidullah (fr.hamidullah) et Pickthall (en.pickthall, domaine public). Usage : node scripts/gen-quran-duas.mjs
import { writeFileSync } from 'node:fs';
const L = [
  ['fatiha', '1:6-7', 'Guide-nous sur le droit chemin', 'Al-Fātiḥa, récitée à chaque rak‘a'],
  ['b127', '2:127', 'Accepte de nous nos œuvres', 'Ibrāhīm et Ismā‘īl en élevant la Ka‘ba'],
  ['b128', '2:128', 'Fais de nous des soumis et accepte notre repentir', 'Ibrāhīm et Ismā‘īl'],
  ['b201', '2:201', 'Le bien ici-bas et dans l’au-delà', 'Rabbanā ātinā'],
  ['b250', '2:250', 'Patience et fermeté', 'Les compagnons de Ṭālūt face à Jālūt'],
  ['b286', '2:286', 'Ne nous charge pas au-delà de nos forces', 'Fin de sourate al-Baqara'],
  ['a8', '3:8', 'Ne fais pas dévier nos cœurs', 'Les gens enracinés dans la science'],
  ['a9', '3:9', 'Tu rassembleras les hommes', ''],
  ['a16', '3:16', 'Pardonne nos péchés, préserve-nous du Feu', ''],
  ['a26', '3:26', 'Ô Allah, Maître de la royauté', ''],
  ['a38', '3:38', 'Une descendance bonne', 'Zakariyyā'],
  ['a53', '3:53', 'Inscris-nous parmi les témoins', 'Les apôtres de ‘Īsā'],
  ['a147', '3:147', 'Pardonne nos excès, affermis nos pas', ''],
  ['a191', '3:191', 'Tu n’as pas créé cela en vain', 'Les doués d’intelligence'],
  ['a193', '3:193', 'Nous avons entendu l’appel à la foi', ''],
  ['a194', '3:194', 'Donne-nous ce que Tu as promis', ''],
  ['m83', '5:83', 'Inscris-nous parmi les témoins', ''],
  ['f23', '7:23', 'Nous nous sommes fait du tort', 'Ādam et Ḥawwā’'],
  ['f47', '7:47', 'Ne nous place pas avec les injustes', ''],
  ['f126', '7:126', 'Déverse sur nous l’endurance', 'Les magiciens de Pharaon devenus croyants'],
  ['y85', '10:85-86', 'Ne fais pas de nous une épreuve pour les injustes', 'Le peuple de Mūsā'],
  ['h47', '11:47', 'Je cherche refuge auprès de Toi', 'Nūḥ'],
  ['yu101', '12:101', 'Fais-moi mourir soumis', 'Yūsuf'],
  ['i40', '14:40-41', 'Accomplir la prière ; pardon pour mes parents', 'Ibrāhīm'],
  ['is24', '17:24', 'Fais-leur miséricorde comme ils m’ont élevé', 'Pour les parents'],
  ['is80', '17:80', 'Une entrée et une sortie de vérité', ''],
  ['k10', '18:10', 'Miséricorde et droiture', 'Les gens de la Caverne'],
  ['t25', '20:25-28', 'Ouvre-moi ma poitrine', 'Mūsā'],
  ['t114', '20:114', 'Accrois-moi en science', ''],
  ['an83', '21:83', 'Le mal m’a touché', 'Ayyūb'],
  ['an87', '21:87', 'Il n’y a de divinité que Toi', 'Yūnus (Dhū-n-Nūn)'],
  ['an89', '21:89', 'Ne me laisse pas seul', 'Zakariyyā'],
  ['mu29', '23:29', 'Fais-moi débarquer en un lieu béni', 'Nūḥ'],
  ['mu97', '23:97-98', 'Refuge contre les suggestions des démons', ''],
  ['mu109', '23:109', 'Pardonne-nous et fais-nous miséricorde', ''],
  ['mu118', '23:118', 'Seigneur, pardonne et fais miséricorde', 'Fin de sourate al-Mu’minūn'],
  ['fu65', '25:65-66', 'Écarte de nous le châtiment de l’Enfer', 'Les serviteurs du Tout-Miséricordieux'],
  ['fu74', '25:74', 'Des épouses et des enfants, joie de nos yeux', ''],
  ['sh83', '26:83-85', 'Accorde-moi sagesse et bonne renommée', 'Ibrāhīm'],
  ['na19', '27:19', 'Inspire-moi de Te remercier', 'Sulaymān'],
  ['q16', '28:16', 'Je me suis fait du tort, pardonne-moi', 'Mūsā'],
  ['q21', '28:21', 'Sauve-moi du peuple injuste', 'Mūsā'],
  ['q24', '28:24', 'J’ai grand besoin du bien que Tu feras descendre', 'Mūsā à Madyan'],
  ['ank30', '29:30', 'Secours-moi contre les corrupteurs', 'Lūṭ'],
  ['saf100', '37:100', 'Un enfant d’entre les vertueux', 'Ibrāhīm'],
  ['ah15', '46:15', 'Gratitude, bonnes œuvres et descendance', ''],
  ['ha10', '59:10', 'Pardonne-nous ainsi qu’à nos frères', ''],
  ['mt4', '60:4-5', 'C’est en Toi que nous plaçons notre confiance', 'Ibrāhīm et ceux qui étaient avec lui'],
  ['tah8', '66:8', 'Parachève-nous notre lumière', ''],
  ['nuh28', '71:28', 'Pardonne-moi ainsi qu’à mes parents', 'Nūḥ'],
];
const out = [];
for (const [id, ref, title, who] of L) {
  const [s, r] = ref.split(':');
  const [a0, a1] = r.split('-').map(Number);
  const ar = [], tr = [], fr = [], en = [];
  for (let a = a0; a <= (a1 || a0); a++) {
    let j;
    for (let k = 0; k < 8; k++) {
      j = await (await fetch(`https://api.alquran.cloud/v1/ayah/${s}:${a}/editions/quran-simple-enhanced,en.transliteration,fr.hamidullah,en.pickthall`)).json().catch(() => ({}));
      if (Array.isArray(j.data)) break;
      await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
    }
    await new Promise((r) => setTimeout(r, 250));
    const [x, y, z, w] = j.data;
    ar.push(x.text.replace(/^\ufeff/, '').trim()); tr.push(y.text.trim()); fr.push(z.text.trim()); en.push(w.text.trim());
  }
  out.push({ id: 'q-' + id, ref, surah: Number(s), title, who: who || undefined, ar: ar.join(' ۝ '), tr: tr.join(' · '), fr: fr.join(' '), en: en.join(' ') });
  process.stdout.write('.');
}
const head = `/** Du‘as coraniques — GÉNÉRÉ par scripts/gen-quran-duas.mjs depuis api.alquran.cloud (ne pas éditer à la main).\n * Texte : quran-simple-enhanced · translittération : en.transliteration · traduction : Muhammad Hamidullah (fr.hamidullah) · anglais : Marmaduke Pickthall (en.pickthall, 1930, domaine public). */\n`;
writeFileSync(new URL('../src/lib/quran-duas.ts', import.meta.url), head + `export type QuranDua = { id: string; ref: string; surah: number; title: string; who?: string; ar: string; tr: string; fr: string; en: string };\nexport const QURAN_DUAS: QuranDua[] = ${JSON.stringify(out, null, 1)};\n`);
console.log('\n', out.length, 'du‘as');
