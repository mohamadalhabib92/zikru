/**
 * Sujūd as-sahw — anglais (P5), traduit du résumé français relu (lui-même fait sur l’extrait arabe cité).
 * « Traduction Zikru — à relire ». En arabe, l’app affiche l’extrait classique (`textAr`) et des libellés arabes, sans paraphrase.
 */
type M = 'maliki' | 'shafii' | 'hanafi' | 'hanbali';

export const SAHW_HOW_EN: Record<M, { title: string; steps: string[] }> = {
  maliki: {
    title: 'How to do it (Maliki)',
    steps: [
      'Before the salām (omission of a confirmed sunna): after the tashahhud, two prostrations, then tashahhud and salām.',
      'After the salām (addition): after the salām, two prostrations, a tashahhud, then a salām.',
      'Omission and addition in the same prayer: before the salām.',
      'Forgetting the after-salām prostration: perform it as soon as one remembers, even long afterwards. The before-salām one: perform it if little time has passed; otherwise repeat the prayer, except for a minor omission (sūra, two takbīrs, the tashahhuds…).',
    ],
  },
  shafii: {
    title: 'How to do it (Shafi‘i)',
    steps: ['Always before the salām, whether for omission, addition or doubt (between the final tashahhud and the salām).', 'Two prostrations like those of the prayer, even after several lapses.', 'The prostration of forgetfulness is a sunna.'],
  },
  hanafi: {
    title: 'How to do it (Hanafi)',
    steps: [
      'It is wājib when a wājib is omitted by forgetfulness: two prostrations, then tashahhud and salām.',
      'It is sunna to perform it after the salām (a single salām to the right suffices according to the soundest view); before the salām it is makrūh tanzīhan.',
      'Deliberately omitting a wājib: a sin, and the prayer must be repeated.',
      'The ma’mūm prostrates for his imam’s lapse, not for his own.',
    ],
  },
  hanbali: {
    title: 'How to do it (Hanbali)',
    steps: [
      'Three kinds of lapse: addition, omission, doubt.',
      'Two prostrations before the salām, except in three cases where it is after the salām (then tashahhud and salām): giving the salām when the prayer was incomplete, the imam who relied on his predominant conviction, and one who forgot the before-salām prostration.',
      'The ma’mūm has no prostration of forgetfulness, unless his imam prostrates: he does it with him.',
    ],
  },
};

export const SAHW_CASES_EN: Record<string, { q: string; by: Partial<Record<M, { text: string; note?: string }>>; gap?: Partial<Record<M, string>> }> = {
  doubt: {
    q: 'I am unsure how many rak‘as I prayed',
    by: {
      maliki: { text: 'Build on what is certain (the smaller number), complete what is in doubt, then prostrate after the salām. One who doubts constantly (mustankiḥ) disregards it and only prostrates after the salām.' },
      shafii: { text: 'Build on what is certain (the smaller number), add the doubtful rak‘a, then prostrate before the salām — even if the doubt disappears before the salām.' },
      hanafi: { text: 'If it is the first doubt (or doubt is not habitual) before the end of the prayer, the prayer is invalidated: start again. If one doubts often: follow one’s predominant conviction; failing that, take the smaller number and sit after every rak‘a that could be the last. If one deliberated for the length of a pillar before becoming sure, prostration of forgetfulness (after the salām).' },
      hanbali: { text: 'Build on what is certain, except the imam who follows his predominant conviction. Prostration before the salām; for the imam who followed his predominant conviction, after the salām. Doubting whether a pillar was done counts as omitting it.' },
    },
  },
  extra: {
    q: 'I added a rak‘a (e.g. 5 instead of 4)',
    by: {
      maliki: { text: 'An addition by forgetfulness is repaired by two prostrations after the salām, followed by the tashahhud and salām.', note: 'The Shamela text of the Risāla has a gap just before this passage (the word “addition” does not appear): to check against the print edition. Ibn ‘Āshir’s verse « ومن يزد سهوا » (Mayyāra p. 339) deals with addition.' },
      shafii: { text: 'An act that would invalidate the prayer if deliberate (such as an extra rak‘a) requires, when done by forgetfulness, the prostration of forgetfulness — before the salām.' },
      hanafi: { text: 'If one stood up without doing the final sitting: return as long as one has not prostrated, and perform the prostration of forgetfulness; if one has prostrated, the obligatory prayer becomes supererogatory (one may add a rak‘a). If one had sat for the final sitting and then stood up: return and give the salām; if one has prostrated, the farḍ remains valid, add a rak‘a (the two become nāfila) and perform the prostration of forgetfulness.' },
      hanbali: { text: 'A deliberate addition (rak‘a or pillar) invalidates the prayer; by forgetfulness, one prostrates. If one realises it during the added rak‘a, sit down immediately. Prostration before the salām.' },
    },
  },
  'first-tashahhud': {
    q: 'I forgot the first tashahhud',
    by: {
      maliki: { text: 'Return as long as the hands and knees have not left the ground; if they have, carry on without returning and prostrate before the salām.' },
      shafii: { text: 'If one remembers after standing fully upright, do not return (returning knowingly invalidates the prayer; by forgetfulness, it does not). If before standing, return; prostrate if one was closer to standing. Prostration before the salām (the first tashahhud is one of the ab‘āḍ).' },
      hanafi: { text: 'Return to sitting as long as one is not fully standing. If one returns while closer to standing, prostration of forgetfulness; if closer to sitting, nothing. Returning after standing upright: differing views on validity.', note: '« العقود »: sic in Shamela, for « القعود ».' },
      hanbali: { text: 'If one remembers before standing fully, return and do it; if standing, do not return. Prostration before the salām.' },
    },
  },
  'early-salam': {
    q: 'I gave the salām too early (incomplete prayer)',
    by: {
      maliki: { text: 'If little time has passed, return with an opening takbīr and complete what is missing; if a long time has passed or one has left the mosque, repeat the prayer. Prostration after the salām (an added salām).', note: 'The Risāla does not state the timing of the prostration here; “after the salām” applies the rule for addition (p. 37). To be confirmed by the reviewer.' },
      shafii: { text: 'An omitted pillar is not replaced by the prostration: if one remembers shortly after, perform it, continue and prostrate (before the salām). If a long time has passed, start again.' },
      hanafi: { text: 'One who thought he had finished a prayer of 4 or 3 rak‘as, gave the salām, then learns he prayed only two: he completes it and performs the prostration of forgetfulness (after the salām).' },
      hanbali: { text: 'Complete what remains of the prayer, then prostrate — after the salām, then tashahhud and salām.' },
    },
  },
  qunut: {
    q: 'I forgot the qunūt of Ṣubḥ',
    by: {
      maliki: { text: 'No prostration of forgetfulness for the qunūt.' },
      shafii: { text: 'The qunūt of Ṣubḥ is one of the ab‘āḍ: forgetting it requires prostration before the salām. If one remembers once in prostration, do not return.' },
    },
    gap: { hanafi: 'Not shown: the qunūt of Ṣubḥ is not a Hanafi practice (the wājib qunūt is that of witr, Nūr al-Īḍāḥ pp. 54-55).', hanbali: 'Not shown: the qunūt of Ṣubḥ is not mentioned in ‘Umdat al-Fiqh.' },
  },
  pillar: {
    q: 'I forgot a pillar (e.g. a prostration, the rukū‘)',
    by: {
      maliki: { text: 'The prostration of forgetfulness does not replace a rak‘a or a prostration: the pillar must be made up; if one has already done the rukū‘ of the next rak‘a, cancel the rak‘a concerned and continue.' },
      shafii: { text: 'A pillar (rukn) must be made up; the prostration of forgetfulness does not replace it. Then prostration before the salām.' },
      hanbali: { text: 'If one remembers before starting the recitation of the next rak‘a, return to do the pillar and what follows it; otherwise the rak‘a in which it is missing is cancelled. Then prostration (before the salām).' },
    },
    gap: { hanafi: 'Not shown: a forgotten pillar is not explicitly dealt with in the bāb sujūd as-sahw of Nūr al-Īḍāḥ.' },
  },
  'loud-quiet': {
    q: 'I recited quietly instead of aloud (or the reverse)',
    by: {
      maliki: { text: 'Reciting aloud and quietly in their proper place are confirmed sunan: omitting them by forgetfulness is repaired before the salām; adding (aloud instead of quietly) counts as addition, after the salām.', note: 'Application of the general rule of the Murshid (confirmed sunna → before; addition → after); the case is not detailed word for word. To be confirmed by the reviewer.' },
      shafii: { text: 'Reciting aloud/quietly is a hay’a (simple sunna): no prostration of forgetfulness.' },
      hanafi: { text: 'For the imam, reciting aloud or quietly in its place is wājib: forgetting it requires the prostration of forgetfulness (after the salām). One praying alone may choose in the audible prayers; that case is not detailed further here.' },
      hanbali: { text: 'Reciting aloud/quietly is not among the seven wājibāt: it is a sunna, whose omission does not require prostration.', note: '‘Umda says “no obligatory prostration”; whether an optional prostration for a sunna is allowed is not detailed there.' },
    },
  },
  takbir: {
    q: 'I forgot transition takbīrs',
    by: {
      maliki: { text: 'A single forgotten takbīr (or a single “sami‘a Llāhu li-man ḥamidah”): nothing. The takbīrs are sunan; two forgotten takbīrs count among the minor omissions repaired before the salām.', note: 'The Risāla mentions “two takbīrs” among minor omissions (pp. 37-38); prostration before the salām for two takbīrs applies the rule for omission. To be confirmed.' },
      shafii: { text: 'Transition takbīrs are hay’āt: no prostration of forgetfulness.' },
      hanafi: { text: 'Transition takbīrs are not among the 18 wājibāt of Nūr al-Īḍāḥ (only the takbīrs of the two ‘Īds are); and the prostration is only due for an omitted wājib.', note: 'Deduced from the list of wājibāt; to be confirmed by the reviewer.' },
      hanbali: { text: 'The takbīrs other than the opening one are wājib: omitted by forgetfulness, prostration of forgetfulness (before the salām); omitted deliberately, the prayer is invalid.' },
    },
  },
};

/** Libellés arabes des cas (questions). */
export const SAHW_CASES_AR: Record<string, string> = {
  doubt: 'شككتُ في عدد الركعات',
  extra: 'زدتُ ركعة (خمسًا بدل أربع مثلًا)',
  'first-tashahhud': 'نسيتُ التشهد الأول',
  'early-salam': 'سلّمتُ قبل تمام الصلاة',
  qunut: 'نسيتُ القنوت في الصبح',
  pillar: 'نسيتُ ركنًا (سجدة أو ركوعًا مثلًا)',
  'loud-quiet': 'أسررتُ في موضع الجهر (أو العكس)',
  takbir: 'نسيتُ تكبيرات الانتقال',
};
export const SAHW_HOW_AR: Record<M, string> = {
  maliki: 'صفة سجود السهو (المالكية)',
  shafii: 'صفة سجود السهو (الشافعية)',
  hanafi: 'صفة سجود السهو (الحنفية)',
  hanbali: 'صفة سجود السهو (الحنابلة)',
};
