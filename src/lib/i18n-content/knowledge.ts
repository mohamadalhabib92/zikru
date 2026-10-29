/**
 * Hadiths (knowledge.ts) et ṣalawāt (salawat.ts) — traductions anglaises du sens, rédigées pour Zikru (P5),
 * à partir de l’arabe source (non modifié). « Traduction Zikru — à relire ». Pas de traduction tierce sous copyright.
 */
export const HADITHS_EN: Record<string, { topic: [string, string]; en: string }> = {
  niyya: { topic: ['Intention', 'النية'], en: 'Actions are only by intentions, and each person will have only what he intended.' },
  tark: { topic: ['Good conduct', 'حسن الخلق'], en: 'Part of the excellence of a person’s Islam is his leaving what does not concern him.' },
  akh: { topic: ['Brotherhood', 'الأخوّة'], en: 'None of you truly believes until he loves for his brother what he loves for himself.' },
  khayr: { topic: ['Speech', 'الكلام'], en: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.' },
  ghadab: { topic: ['Anger', 'الغضب'], en: 'A man said, “Advise me.” The Prophet ﷺ said, “Do not become angry,” and repeated it several times.' },
  shadid: { topic: ['Anger', 'الغضب'], en: 'The strong one is not the one who overpowers others; the strong one is he who controls himself when angry.' },
  nasiha: { topic: ['Sincerity', 'النصيحة'], en: 'The religion is sincerity (sincere counsel) — to Allah, His Book, His Messenger, the leaders of the Muslims and their common folk.' },
  ittaqi: { topic: ['Piety', 'التقوى'], en: 'Fear Allah wherever you are, follow a bad deed with a good one and it will erase it, and treat people with good character.' },
  kalimatan: { topic: ['Dhikr', 'الذكر'], en: 'Two words light on the tongue, heavy in the Balance, beloved to the Most Merciful: “Subḥāna-llāhi wa bi-ḥamdih, subḥāna-llāhi-l-‘aẓīm.”' },
  hayy: { topic: ['Dhikr', 'الذكر'], en: 'The likeness of one who remembers his Lord and one who does not is that of the living and the dead.' },
  adwam: { topic: ['Consistency', 'المداومة'], en: 'The deeds most beloved to Allah are the most constant, even if they are few.' },
  tuhur: { topic: ['Purification', 'الطهارة'], en: 'Purification is half of faith.' },
  salat: { topic: ['Salawat', 'الصلاة على النبي'], en: 'Whoever invokes blessings upon me once, Allah blesses him ten times.' },
  yassiru: { topic: ['Ease', 'التيسير'], en: 'Make things easy and do not make them difficult; give glad tidings and do not drive people away.' },
  kalima: { topic: ['Speech', 'الكلام'], en: 'A good word is charity.' },
  tabassum: { topic: ['Kindness', 'الإحسان'], en: 'Your smile to your brother is charity for you.' },
  qulub: { topic: ['Heart', 'القلب'], en: 'Allah does not look at your appearance or your wealth, but He looks at your hearts and your deeds.' },
  zann: { topic: ['Hope', 'الرجاء'], en: '(Ḥadīth qudsī) I am as My servant thinks of Me, and I am with him when he remembers Me.' },
  ilm: { topic: ['Knowledge', 'العلم'], en: 'Whoever takes a path seeking knowledge, Allah makes easy for him thereby a path to Paradise.' },
  quran: { topic: ['Qur’an', 'القرآن'], en: 'The best of you is the one who learns the Qur’an and teaches it.' },
  shukr: { topic: ['Gratitude', 'الشكر'], en: 'He has not thanked Allah who has not thanked people.' },
};

export const SALAWAT_EN: Record<string, { title: [string, string]; en: string }> = {
  ibrahimiyya: { title: ['Ṣalāt Ibrāhīmiyya', 'الصلاة الإبراهيمية'], en: 'O Allah, send blessings upon Muhammad and upon the family of Muhammad, as You sent blessings upon Ibrāhīm and upon the family of Ibrāhīm; You are indeed Praiseworthy, Glorious. O Allah, bless Muhammad and the family of Muhammad, as You blessed Ibrāhīm and the family of Ibrāhīm; You are indeed Praiseworthy, Glorious.' },
  'ibrahimiyya-muslim': { title: ['Ṣalāt Ibrāhīmiyya (“fī-l-‘ālamīn”)', 'الصلاة الإبراهيمية (في العالمين)'], en: 'O Allah, send blessings upon Muhammad and upon the family of Muhammad as You sent blessings upon the family of Ibrāhīm, and bless Muhammad and the family of Muhammad as You blessed the family of Ibrāhīm, among all the worlds; You are indeed Praiseworthy, Glorious.' },
  azwaj: { title: ['Upon his wives and descendants', 'على أزواجه وذريته'], en: 'O Allah, send blessings upon Muhammad, his wives and his descendants, as You sent blessings upon the family of Ibrāhīm, and bless Muhammad, his wives and his descendants, as You blessed the family of Ibrāhīm; You are indeed Praiseworthy, Glorious.' },
  abdika: { title: ['Upon Muhammad, Your servant and Messenger', 'على محمد عبدك ورسولك'], en: 'O Allah, send blessings upon Muhammad, Your servant and Your Messenger, as You sent blessings upon Ibrāhīm, and bless Muhammad and the family of Muhammad as You blessed Ibrāhīm and the family of Ibrāhīm.' },
  sallallah: { title: ['Short formula', 'الصيغة المختصرة'], en: 'May Allah send blessings upon him and grant him peace.' },
  'salli-sallim': { title: ['Blessings and peace upon our Prophet', 'الصلاة والسلام على نبينا'], en: 'O Allah, send blessings and peace upon our Prophet Muhammad.' },
  'salli-ala-muhammad': { title: ['O Allah, bless Muhammad', 'اللهم صلّ على محمد'], en: 'O Allah, send blessings upon Muhammad and upon the family of Muhammad.' },
  'tijani-fatih': { title: ['Ṣalāt al-Fātiḥ', 'صلاة الفاتح'], en: 'O Allah, send blessings upon our master Muhammad, the opener of what was closed, the seal of what came before, the one who makes the truth victorious by the truth, the guide to Your straight path, and upon his family, according to the true measure of his immense rank.' },
  'tijani-jawhara': { title: ['Jawharat al-Kamāl', 'جوهرة الكمال'], en: 'O Allah, send blessings and peace upon the source of divine mercy, the realised ruby encompassing the centre of understandings and meanings, the light of created beings, the Adamic one, possessor of the divine truth, the most radiant lightning in the rain-clouds of benefits that fill every sea and every vessel exposed to them, and Your shining light with which You filled Your universe… (indicative, abridged translation).' },
};
