// GÉNÉRÉ par scripts/split-quran-sura.mjs — ne pas modifier.
// Extrait verbatim de Tanzil « Uthmani » v1.1 (Hafs). Source : https://tanzil.net — CC BY 3.0.
// Le texte de chaque verset est recopié tel quel (basmala d’ouverture comprise).

export type SurahModule = { AYAHS: readonly string[] };

const LOADERS: (() => Promise<SurahModule>)[] = [
  () => import('./s001'),
  () => import('./s002'),
  () => import('./s003'),
  () => import('./s004'),
  () => import('./s005'),
  () => import('./s006'),
  () => import('./s007'),
  () => import('./s008'),
  () => import('./s009'),
  () => import('./s010'),
  () => import('./s011'),
  () => import('./s012'),
  () => import('./s013'),
  () => import('./s014'),
  () => import('./s015'),
  () => import('./s016'),
  () => import('./s017'),
  () => import('./s018'),
  () => import('./s019'),
  () => import('./s020'),
  () => import('./s021'),
  () => import('./s022'),
  () => import('./s023'),
  () => import('./s024'),
  () => import('./s025'),
  () => import('./s026'),
  () => import('./s027'),
  () => import('./s028'),
  () => import('./s029'),
  () => import('./s030'),
  () => import('./s031'),
  () => import('./s032'),
  () => import('./s033'),
  () => import('./s034'),
  () => import('./s035'),
  () => import('./s036'),
  () => import('./s037'),
  () => import('./s038'),
  () => import('./s039'),
  () => import('./s040'),
  () => import('./s041'),
  () => import('./s042'),
  () => import('./s043'),
  () => import('./s044'),
  () => import('./s045'),
  () => import('./s046'),
  () => import('./s047'),
  () => import('./s048'),
  () => import('./s049'),
  () => import('./s050'),
  () => import('./s051'),
  () => import('./s052'),
  () => import('./s053'),
  () => import('./s054'),
  () => import('./s055'),
  () => import('./s056'),
  () => import('./s057'),
  () => import('./s058'),
  () => import('./s059'),
  () => import('./s060'),
  () => import('./s061'),
  () => import('./s062'),
  () => import('./s063'),
  () => import('./s064'),
  () => import('./s065'),
  () => import('./s066'),
  () => import('./s067'),
  () => import('./s068'),
  () => import('./s069'),
  () => import('./s070'),
  () => import('./s071'),
  () => import('./s072'),
  () => import('./s073'),
  () => import('./s074'),
  () => import('./s075'),
  () => import('./s076'),
  () => import('./s077'),
  () => import('./s078'),
  () => import('./s079'),
  () => import('./s080'),
  () => import('./s081'),
  () => import('./s082'),
  () => import('./s083'),
  () => import('./s084'),
  () => import('./s085'),
  () => import('./s086'),
  () => import('./s087'),
  () => import('./s088'),
  () => import('./s089'),
  () => import('./s090'),
  () => import('./s091'),
  () => import('./s092'),
  () => import('./s093'),
  () => import('./s094'),
  () => import('./s095'),
  () => import('./s096'),
  () => import('./s097'),
  () => import('./s098'),
  () => import('./s099'),
  () => import('./s100'),
  () => import('./s101'),
  () => import('./s102'),
  () => import('./s103'),
  () => import('./s104'),
  () => import('./s105'),
  () => import('./s106'),
  () => import('./s107'),
  () => import('./s108'),
  () => import('./s109'),
  () => import('./s110'),
  () => import('./s111'),
  () => import('./s112'),
  () => import('./s113'),
  () => import('./s114'),
];

const cache = new Map<number, readonly string[]>();
const inflight = new Map<number, Promise<readonly string[]>>();

/** Versets Tanzil bruts de la sourate, déjà en mémoire s’ils ont été lus. */
export function peekSurahRaw(n: number): readonly string[] | null {
  return cache.get(n) ?? null;
}

/** Charge une seule sourate (module séparé, mis en cache pour la suite de la session). */
export function loadSurahRaw(n: number): Promise<readonly string[]> {
  const hit = cache.get(n);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(n);
  if (!p) {
    const load = LOADERS[n - 1];
    if (!load) return Promise.reject(new Error('sourate ' + n));
    p = load().then((m) => {
      cache.set(n, m.AYAHS);
      inflight.delete(n);
      return m.AYAHS;
    });
    inflight.set(n, p);
  }
  return p;
}

/** Sourate suivante, sans attendre : le défilement ou le bouton « suivant » la trouve déjà prête. */
export function preloadSurahRaw(n: number) {
  if (n >= 1 && n <= 114) void loadSurahRaw(n);
}
