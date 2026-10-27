/**
 * Bases pratiques du fiqh selon les écoles malikite et shafi'ite.
 * Résumés tirés des manuels classiques de base (al-Murshid al-Mu‘in d’Ibn ‘Ashir, ar-Risala ;
 * Matn Abi Shuja‘, Safinat an-Naja). Pour tout cas particulier, consulter un imam / savant.
 */
export type Madhab = 'maliki' | 'shafii';
export type FiqhSection = { id: string; title: string; ar: string; icon: string; intro?: string; lists: { title: string; items: string[] }[] };

const common = {
  nawaqidCommon: ['Tout ce qui sort des deux voies naturelles (urine, selles, gaz, liquide prostatique…).', 'La perte de conscience : sommeil profond, évanouissement, ivresse, folie.'],
};

export const FIQH: Record<Madhab, FiqhSection[]> = {
  maliki: [
    {
      id: 'wudu', title: 'Les ablutions (wudu)', ar: 'الوضوء', icon: 'water',
      lists: [
        { title: 'Les 7 obligations (fara’id)', items: ['L’intention (niyya), au moment de laver le visage.', 'Laver le visage.', 'Laver les mains et avant-bras jusqu’aux coudes inclus.', 'Passer les mains mouillées sur toute la tête (mash).', 'Laver les pieds jusqu’aux chevilles incluses.', 'Le frottement (dalk) de chaque membre.', 'L’enchaînement sans interruption (fawr / muwalat).'] },
        { title: 'Sunan principales', items: ['Laver les mains jusqu’aux poignets au début.', 'Se rincer la bouche (madmada).', 'Aspirer l’eau par le nez (istinshaq) et la rejeter (istinthar).', 'Ramener les mains sur la tête (radd al-mash).', 'Essuyer les oreilles avec une eau renouvelée.', 'Respecter l’ordre des membres (tartib).'] },
        { title: 'Ce qui annule les ablutions', items: [...common.nawaqidCommon, 'Toucher une personne qui suscite le désir, si l’on recherche ou ressent le plaisir.', 'Toucher son sexe avec la paume ou l’intérieur des doigts.', 'Le doute sur la persistance de ses ablutions (on les refait).'] },
      ],
    },
    {
      id: 'ghusl', title: 'Le grand lavage (ghusl)', ar: 'الغسل', icon: 'rainy',
      intro: 'Obligatoire après l’état de janaba (rapport, émission de sperme), et à la fin des règles ou des lochies.',
      lists: [{ title: 'Obligations', items: ['L’intention.', 'Faire parvenir l’eau sur tout le corps (ta‘mim), cheveux compris.', 'Le frottement (dalk).', 'L’enchaînement sans interruption (muwalat).'] }],
    },
    {
      id: 'tayammum', title: 'Les ablutions sèches (tayammum)', ar: 'التيمم', icon: 'leaf',
      intro: 'Permises en l’absence d’eau, ou si son usage est nuisible (maladie, froid extrême…), une fois l’heure de la prière entrée.',
      lists: [{ title: 'Obligations', items: ['L’intention.', 'Poser les mains sur une terre pure (sa‘id : terre, sable, pierre…) — première frappe.', 'Essuyer tout le visage.', 'Essuyer les mains jusqu’aux poignets (jusqu’aux coudes : sunna).', 'L’enchaînement, et prier aussitôt après.'] }],
    },
    {
      id: 'salat', title: 'La prière (salat)', ar: 'الصلاة', icon: 'body',
      lists: [
        { title: 'Les obligations (fara’id)', items: ['L’intention.', 'Le takbir d’ouverture (takbirat al-ihram) et la station debout pour lui.', 'La Fatiha et la station debout pour elle.', 'L’inclinaison (ruku‘) et le redressement.', 'La prosternation (sujud) et le redressement entre les deux.', 'Le salam final et la position assise pour lui.', 'La sérénité (tuma’nina) et l’équilibre (i‘tidal) dans chaque position.', 'Respecter l’ordre des actes.'] },
        { title: 'Conditions de validité', items: ['Être en état de pureté (ablutions).', 'Pureté du corps, du vêtement et du lieu.', 'Couvrir sa ‘awra.', 'Se tourner vers la qibla.', 'Que l’heure de la prière soit entrée.'] },
      ],
    },
  ],
  shafii: [
    {
      id: 'wudu', title: 'Les ablutions (wudu)', ar: 'الوضوء', icon: 'water',
      lists: [
        { title: 'Les 6 obligations (fara’id)', items: ['L’intention (niyya), au moment de laver le visage.', 'Laver le visage.', 'Laver les mains et avant-bras jusqu’aux coudes inclus.', 'Essuyer une partie de la tête (mash), même minime.', 'Laver les pieds jusqu’aux chevilles incluses.', 'Respecter l’ordre (tartib).'] },
        { title: 'Sunan principales', items: ['Dire « Bismillah » et utiliser le siwak.', 'Laver les mains au début.', 'Rinçage de la bouche et du nez.', 'Essuyer toute la tête et les oreilles.', 'Laver chaque membre trois fois.', 'Commencer par la droite ; enchaîner sans interruption.'] },
        { title: 'Ce qui annule les ablutions', items: [...common.nawaqidCommon, 'Le contact de peau à peau avec une personne adulte du sexe opposé, non mahram (même sans désir).', 'Toucher le sexe (le sien ou celui d’autrui) avec l’intérieur de la main.'] },
      ],
    },
    {
      id: 'ghusl', title: 'Le grand lavage (ghusl)', ar: 'الغسل', icon: 'rainy',
      intro: 'Obligatoire après l’état de janaba (rapport, émission de sperme), et à la fin des règles ou des lochies.',
      lists: [{ title: 'Obligations', items: ['L’intention.', 'Faire parvenir l’eau sur tout le corps, peau et cheveux compris.'] }, { title: 'Recommandé', items: ['Commencer par les ablutions, frotter, laver trois fois, commencer par la droite.'] }],
    },
    {
      id: 'tayammum', title: 'Les ablutions sèches (tayammum)', ar: 'التيمم', icon: 'leaf',
      intro: 'Permises en l’absence d’eau ou si son usage est nuisible, une fois l’heure de la prière entrée. Il faut de la poussière (turab) pure.',
      lists: [{ title: 'Obligations', items: ['Prendre de la poussière pure avec les mains (naql).', 'L’intention.', 'Essuyer le visage.', 'Essuyer les mains et avant-bras jusqu’aux coudes.', 'Respecter l’ordre.'] }],
    },
    {
      id: 'salat', title: 'La prière (salat)', ar: 'الصلاة', icon: 'body',
      lists: [
        { title: 'Les 13 piliers (arkan)', items: ['L’intention.', 'Le takbir d’ouverture.', 'La station debout (si on le peut).', 'La Fatiha.', 'Le ruku‘ avec sérénité (tuma’nina).', 'Le redressement (i‘tidal) avec sérénité.', 'Les deux prosternations avec sérénité.', 'La position assise entre elles, avec sérénité.', 'Le dernier tashahhud.', 'La position assise pour celui-ci.', 'La prière sur le Prophète ﷺ dans ce tashahhud.', 'Le premier salam.', 'L’ordre (tartib).'] },
        { title: 'Conditions de validité', items: ['Être en état de pureté.', 'Pureté du corps, du vêtement et du lieu.', 'Couvrir sa ‘awra.', 'Se tourner vers la qibla.', 'Connaître l’entrée de l’heure.'] },
      ],
    },
  ],
};
