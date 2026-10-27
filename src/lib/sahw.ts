/**
 * Sujud al-Sahw (prosternations de l'oubli) — résumé pédagogique selon les écoles malikite et chaféite.
 * Références générales : al-Risala d'Ibn Abi Zayd al-Qayrawani et Mukhtasar Khalil (malikite) ;
 * Minhaj al-Talibin d'al-Nawawi (chaféite). Pour un cas précis, consultez une personne de savoir.
 */
export type Madhab = 'maliki' | 'shafii';
export type When = 'avant' | 'après' | 'aucun' | 'refaire';

export const HOW: Record<Madhab, { title: string; steps: string[] }> = {
  maliki: {
    title: 'Comment faire (malikite)',
    steps: [
      'Avant le salam (manque) : après le tashahhud final, faire deux prosternations avec takbir, refaire le tashahhud, puis le salam.',
      'Après le salam (ajout) : après le salam, faire deux prosternations avec takbir, un tashahhud, puis un second salam.',
      'Manque et ajout dans la même prière : avant le salam (le manque l’emporte).',
    ],
  },
  shafii: {
    title: 'Comment faire (chaféite)',
    steps: [
      'Toujours avant le salam, qu’il y ait manque, ajout ou doute.',
      'Après le tashahhud final (et la prière sur le Prophète ﷺ), faire deux prosternations comme celles de la prière, puis le salam.',
      'La prosternation de l’oubli est une sunna : la prière reste valide si on l’omet.',
    ],
  },
};

export type Case = { id: string; q: string; maliki: { when: When; text: string }; shafii: { when: When; text: string } };

export const CASES: Case[] = [
  {
    id: 'doubt',
    q: 'J’ai un doute sur le nombre de rak‘as',
    maliki: { when: 'après', text: 'Se baser sur le nombre le plus petit (certain), compléter la prière, puis se prosterner après le salam (ajout possible).' },
    shafii: { when: 'avant', text: 'Se baser sur le nombre le plus petit (certain), compléter, puis se prosterner avant le salam.' },
  },
  {
    id: 'extra',
    q: 'J’ai ajouté une rak‘a (ex. 5 au lieu de 4)',
    maliki: { when: 'après', text: 'S’asseoir dès qu’on s’en rend compte, faire le tashahhud et le salam, puis se prosterner après le salam.' },
    shafii: { when: 'avant', text: 'S’asseoir dès qu’on s’en rend compte, faire le tashahhud, se prosterner avant le salam.' },
  },
  {
    id: 'first-tashahhud',
    q: 'J’ai oublié le premier tashahhud',
    maliki: { when: 'avant', text: 'Si l’on s’est déjà levé complètement, ne pas revenir : continuer et se prosterner avant le salam (manque d’une sunna confirmée).' },
    shafii: { when: 'avant', text: 'Si l’on est déjà debout, ne pas revenir : continuer et se prosterner avant le salam (c’est l’un des ab‘ad).' },
  },
  {
    id: 'early-salam',
    q: 'J’ai fait le salam trop tôt (prière incomplète)',
    maliki: { when: 'après', text: 'Si peu de temps s’est écoulé, reprendre et compléter la prière, puis se prosterner après le salam. Sinon, recommencer la prière.' },
    shafii: { when: 'avant', text: 'Si peu de temps s’est écoulé, compléter la prière et se prosterner avant le salam. Sinon, recommencer la prière.' },
  },
  {
    id: 'qunut',
    q: 'J’ai oublié le qunut du Subh',
    maliki: { when: 'aucun', text: 'Le qunut est une vertu (fadila) : pas de prosternation de l’oubli.' },
    shafii: { when: 'avant', text: 'Le qunut du Subh fait partie des ab‘ad : se prosterner avant le salam.' },
  },
  {
    id: 'pillar',
    q: 'J’ai oublié un pilier (ex. une prosternation, le ruku‘)',
    maliki: { when: 'refaire', text: 'Un pilier (fard) n’est pas remplacé par la prosternation de l’oubli : il faut l’accomplir (refaire la rak‘a concernée si on a dépassé le point), puis se prosterner selon le cas.' },
    shafii: { when: 'refaire', text: 'Un pilier (rukn) doit être accompli ; la rak‘a incomplète est remplacée, puis prosternation avant le salam.' },
  },
  {
    id: 'loud-quiet',
    q: 'J’ai récité à voix basse au lieu de haute (ou l’inverse)',
    maliki: { when: 'avant', text: 'Récitation basse au lieu de haute : manque d’une sunna, avant le salam. Haute au lieu de basse : ajout, après le salam.' },
    shafii: { when: 'aucun', text: 'C’est une hay’a (sunna simple) : pas de prosternation de l’oubli.' },
  },
  {
    id: 'takbir',
    q: 'J’ai oublié plusieurs takbirs de transition',
    maliki: { when: 'avant', text: 'L’oubli de deux takbirs ou plus (sunna) entraîne une prosternation avant le salam ; un seul est sans conséquence selon l’avis courant.' },
    shafii: { when: 'aucun', text: 'Ce sont des hay’at : pas de prosternation de l’oubli.' },
  },
];

export type RefItem = { act: string; cat: string };
export const REFERENCE: Record<Madhab, { cats: { name: string; rule: string }[]; items: RefItem[] }> = {
  maliki: {
    cats: [
      { name: 'Fara’id (piliers)', rule: 'Obligatoires : leur oubli n’est pas réparé par la prosternation ; il faut les accomplir.' },
      { name: 'Sunan mu’akkada', rule: 'Sunnas confirmées : leur oubli entraîne une prosternation avant le salam.' },
      { name: 'Fada’il', rule: 'Vertus : pas de prosternation de l’oubli.' },
    ],
    items: [
      { act: 'Takbir d’ouverture', cat: 'Fara’id (piliers)' },
      { act: 'Al-Fatiha', cat: 'Fara’id (piliers)' },
      { act: 'Ruku‘ et sujud', cat: 'Fara’id (piliers)' },
      { act: 'Position assise finale (le temps du salam)', cat: 'Fara’id (piliers)' },
      { act: 'Salam', cat: 'Fara’id (piliers)' },
      { act: 'Sourate après la Fatiha', cat: 'Sunan mu’akkada' },
      { act: 'Récitation à voix haute / basse', cat: 'Sunan mu’akkada' },
      { act: 'Les deux tashahhuds et leurs positions assises', cat: 'Sunan mu’akkada' },
      { act: 'Takbirs de transition (deux ou plus)', cat: 'Sunan mu’akkada' },
      { act: 'Qunut du Subh', cat: 'Fada’il' },
      { act: 'Lever les mains au takbir d’ouverture', cat: 'Fada’il' },
      { act: '« Rabbana wa laka-l-hamd »', cat: 'Fada’il' },
    ],
  },
  shafii: {
    cats: [
      { name: 'Arkan (piliers)', rule: 'Obligatoires : à accomplir ; la prosternation ne les remplace pas.' },
      { name: 'Ab‘ad', rule: 'Sunnas importantes : leur oubli entraîne une prosternation avant le salam.' },
      { name: 'Hay’at', rule: 'Sunnas simples : pas de prosternation de l’oubli.' },
    ],
    items: [
      { act: 'Intention et takbir d’ouverture', cat: 'Arkan (piliers)' },
      { act: 'Al-Fatiha', cat: 'Arkan (piliers)' },
      { act: 'Ruku‘, i‘tidal, sujud, assise entre les sujud', cat: 'Arkan (piliers)' },
      { act: 'Dernier tashahhud, prière sur le Prophète ﷺ, salam', cat: 'Arkan (piliers)' },
      { act: 'Premier tashahhud et sa position assise', cat: 'Ab‘ad' },
      { act: 'Qunut du Subh (et du witr de la seconde moitié de Ramadan) et sa station debout', cat: 'Ab‘ad' },
      { act: 'Prière sur le Prophète ﷺ dans le premier tashahhud', cat: 'Ab‘ad' },
      { act: 'Prière sur la famille du Prophète ﷺ dans le dernier tashahhud', cat: 'Ab‘ad' },
      { act: 'Invocation d’ouverture, ta‘awwudh', cat: 'Hay’at' },
      { act: 'Sourate après la Fatiha', cat: 'Hay’at' },
      { act: 'Takbirs de transition, tasbih du ruku‘ et du sujud', cat: 'Hay’at' },
      { act: 'Voix haute / basse', cat: 'Hay’at' },
    ],
  },
};

export const SAHW_SOURCES =
  'Synthèse générale d’après les manuels de référence : al-Risala (Ibn Abi Zayd al-Qayrawani) et le Mukhtasar de Khalil pour l’école malikite ; le Minhaj al-Talibin (al-Nawawi) pour l’école chaféite. Résumé pédagogique : pour un cas particulier, demandez à une personne de savoir.';
