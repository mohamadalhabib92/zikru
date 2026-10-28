/**
 * Hadiths et invocations choisis — uniquement des textes très connus et authentiques,
 * avec leur référence (recueil + numéro, numérotation usuelle sunnah.com). Traductions françaises
 * indicatives rédigées pour l'app (sens). En cas de doute, le texte n'a pas été inclus.
 */
export type Text3 = { id: string; ar: string; fr: string; ref: string; topic: string; tr?: string; when?: string };

export const HADITHS: Text3[] = [
  { id: 'niyya', topic: 'Intention', ar: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى', fr: 'Les actes ne valent que par les intentions, et chacun n’obtient que ce qu’il a eu l’intention de faire.', ref: 'Sahih al-Bukhari 1 ; Sahih Muslim 1907' },
  { id: 'tark', topic: 'Bon comportement', ar: 'مِنْ حُسْنِ إِسْلَامِ المَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ', fr: 'Fait partie de la beauté de l’islam d’une personne qu’elle délaisse ce qui ne la concerne pas.', ref: 'Jami‘ at-Tirmidhi 2317' },
  { id: 'akh', topic: 'Fraternité', ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', fr: 'Aucun de vous n’est vraiment croyant tant qu’il n’aime pas pour son frère ce qu’il aime pour lui-même.', ref: 'Sahih al-Bukhari 13 ; Sahih Muslim 45' },
  { id: 'khayr', topic: 'Parole', ar: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَاليَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', fr: 'Que celui qui croit en Allah et au Jour dernier dise du bien ou se taise.', ref: 'Sahih al-Bukhari 6018 ; Sahih Muslim 47' },
  { id: 'ghadab', topic: 'Colère', ar: 'لَا تَغْضَبْ', fr: '« Conseille-moi », dit un homme. Le Prophète ﷺ répondit : « Ne te mets pas en colère », et le répéta plusieurs fois.', ref: 'Sahih al-Bukhari 6116' },
  { id: 'shadid', topic: 'Colère', ar: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الغَضَبِ', fr: 'Le fort n’est pas celui qui terrasse les autres ; le fort est celui qui se maîtrise au moment de la colère.', ref: 'Sahih al-Bukhari 6114 ; Sahih Muslim 2609' },
  { id: 'nasiha', topic: 'Sincérité', ar: 'الدِّينُ النَّصِيحَةُ', fr: 'La religion, c’est la sincérité (le bon conseil) — envers Allah, Son Livre, Son Messager, les dirigeants des musulmans et leur ensemble.', ref: 'Sahih Muslim 55' },
  { id: 'ittaqi', topic: 'Piété', ar: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ', fr: 'Crains Allah où que tu sois, fais suivre la mauvaise action d’une bonne qui l’effacera, et comporte-toi avec les gens d’un beau caractère.', ref: 'Jami‘ at-Tirmidhi 1987' },
  { id: 'kalimatan', topic: 'Dhikr', ar: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي المِيزَانِ، حَبِيبَتَانِ إِلَى الرَّحْمَنِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ العَظِيمِ', fr: 'Deux paroles légères sur la langue, lourdes dans la balance, aimées du Tout-Miséricordieux : « Subḥāna-llāhi wa bi-ḥamdih, subḥāna-llāhi-l-‘aẓīm ».', ref: 'Sahih al-Bukhari 6406 ; Sahih Muslim 2694' },
  { id: 'hayy', topic: 'Dhikr', ar: 'مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ وَالَّذِي لَا يَذْكُرُ رَبَّهُ مَثَلُ الحَيِّ وَالمَيِّتِ', fr: 'L’exemple de celui qui invoque son Seigneur et de celui qui ne L’invoque pas est celui du vivant et du mort.', ref: 'Sahih al-Bukhari 6407' },
  { id: 'adwam', topic: 'Régularité', ar: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ', fr: 'Les actes les plus aimés d’Allah sont les plus réguliers, même s’ils sont peu nombreux.', ref: 'Sahih al-Bukhari 6464 ; Sahih Muslim 783' },
  { id: 'tuhur', topic: 'Purification', ar: 'الطُّهُورُ شَطْرُ الإِيمَانِ', fr: 'La purification est la moitié de la foi.', ref: 'Sahih Muslim 223' },
  { id: 'salat', topic: 'Salawat', ar: 'مَنْ صَلَّى عَلَيَّ وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ عَشْرًا', fr: 'Quiconque prie sur moi une fois, Allah prie sur lui dix fois.', ref: 'Sahih Muslim 408' },
  { id: 'yassiru', topic: 'Facilité', ar: 'يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا', fr: 'Facilitez et ne rendez pas les choses difficiles ; annoncez la bonne nouvelle et ne faites pas fuir.', ref: 'Sahih al-Bukhari 69 ; Sahih Muslim 1734' },
  { id: 'kalima', topic: 'Parole', ar: 'الكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ', fr: 'La bonne parole est une aumône.', ref: 'Sahih al-Bukhari 2989 ; Sahih Muslim 1009' },
  { id: 'tabassum', topic: 'Bonté', ar: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ', fr: 'Ton sourire à ton frère est pour toi une aumône.', ref: 'Jami‘ at-Tirmidhi 1956' },
  { id: 'qulub', topic: 'Cœur', ar: 'إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ، وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ', fr: 'Allah ne regarde ni vos apparences ni vos biens, mais Il regarde vos cœurs et vos actes.', ref: 'Sahih Muslim 2564' },
  { id: 'zann', topic: 'Espérance', ar: 'أَنَا عِنْدَ ظَنِّ عَبْدِي بِي، وَأَنَا مَعَهُ إِذَا ذَكَرَنِي', fr: '(Hadith qudsi) Je suis tel que Mon serviteur pense de Moi, et Je suis avec lui lorsqu’il M’invoque.', ref: 'Sahih al-Bukhari 7405 ; Sahih Muslim 2675' },
  { id: 'ilm', topic: 'Science', ar: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الجَنَّةِ', fr: 'Quiconque emprunte un chemin à la recherche d’un savoir, Allah lui facilite par là un chemin vers le Paradis.', ref: 'Sahih Muslim 2699' },
  { id: 'quran', topic: 'Coran', ar: 'خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ', fr: 'Le meilleur d’entre vous est celui qui apprend le Coran et l’enseigne.', ref: 'Sahih al-Bukhari 5027' },
  { id: 'shukr', topic: 'Gratitude', ar: 'لَا يَشْكُرُ اللَّهَ مَنْ لَا يَشْكُرُ النَّاسَ', fr: 'N’est pas reconnaissant envers Allah celui qui n’est pas reconnaissant envers les gens.', ref: 'Sunan Abi Dawud 4811 ; Jami‘ at-Tirmidhi 1954' },
];

// Les du‘as sont désormais dans src/lib/duas.ts (catégories, répétitions, sources).
