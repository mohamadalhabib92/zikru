/**
 * Tijani — adilla en anglais et en arabe (P5).
 * Versets : sens anglais M. Pickthall (1930, domaine public) ; texte arabe recopié à l’identique de Tanzil Uthmani (src/lib/quran-uthmani.ts, script gen-adilla).
 * Hadiths : traduction anglaise Zikru — à relire. Texte arabe uniquement quand il figure déjà, sourcé, dans src/lib/knowledge.ts ;
 * sinon l’arabe n’est PAS reconstitué (pas de matn inventé) : l’app affiche la référence et renvoie à la source.
 */
export const ADILLA_I18N: Record<string, { en: string; ar?: string }> = {
  "Coran 33:41-42": { en: "“O ye who believe! Remember Allah with much remembrance. And glorify Him early and late.” (meaning — M. Pickthall, public domain)", ar: "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱذْكُرُوا۟ ٱللَّهَ ذِكْرًا كَثِيرًا ﴿٤١﴾ وَسَبِّحُوهُ بُكْرَةً وَأَصِيلًا ﴿٤٢﴾" },
  "Coran 33:56": { en: "“Lo! Allah and His angels shower blessings on the Prophet. O ye who believe! Ask blessings on him and salute him with a worthy salutation.” (meaning — M. Pickthall, public domain)", ar: "إِنَّ ٱللَّهَ وَمَلَٰٓئِكَتَهُۥ يُصَلُّونَ عَلَى ٱلنَّبِىِّ ۚ يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ صَلُّوا۟ عَلَيْهِ وَسَلِّمُوا۟ تَسْلِيمًا ﴿٥٦﴾" },
  "Coran 2:152": { en: "“Therefore remember Me, I will remember you.” (meaning — M. Pickthall, public domain)", ar: "فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ ﴿١٥٢﴾" },
  "Coran 13:28": { en: "“Verily in the remembrance of Allah do hearts find rest!” (meaning — M. Pickthall, public domain)", ar: "ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ ﴿٢٨﴾" },
  "Coran 71:10-12": { en: "“Seek pardon of your Lord. Lo! He was ever Forgiving…” (meaning — M. Pickthall, public domain)", ar: "فَقُلْتُ ٱسْتَغْفِرُوا۟ رَبَّكُمْ إِنَّهُۥ كَانَ غَفَّارًا ﴿١٠﴾" },
  "Coran 47:19": { en: "“So know (O Muhammad) that there is no Allah save Allah, and ask forgiveness for thy sin…” (meaning — M. Pickthall, public domain)", ar: "فَٱعْلَمْ أَنَّهُۥ لَآ إِلَٰهَ إِلَّا ٱللَّهُ وَٱسْتَغْفِرْ لِذَنۢبِكَ وَلِلْمُؤْمِنِينَ وَٱلْمُؤْمِنَٰتِ ۗ وَٱللَّهُ يَعْلَمُ مُتَقَلَّبَكُمْ وَمَثْوَىٰكُمْ ﴿١٩﴾" },
  "Coran 62:10": { en: "“… and remember Allah much, that ye may be successful.” (meaning — M. Pickthall, public domain)", ar: "فَإِذَا قُضِيَتِ ٱلصَّلَوٰةُ فَٱنتَشِرُوا۟ فِى ٱلْأَرْضِ وَٱبْتَغُوا۟ مِن فَضْلِ ٱللَّهِ وَٱذْكُرُوا۟ ٱللَّهَ كَثِيرًا لَّعَلَّكُمْ تُفْلِحُونَ ﴿١٠﴾" },
  "Sahih Muslim 408": { en: "“Whoever sends blessings upon me once, Allah sends blessings upon him tenfold.” (meaning — Zikru translation, to review)", ar: "مَنْ صَلَّى عَلَيَّ وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ عَشْرًا" },
  "Jami‘ at-Tirmidhi 3383": { en: "“The best remembrance is Lā ilāha illā-llāh…” (meaning — Zikru translation, to review)" },
  "Sahih al-Bukhari 6307": { en: "“By Allah, I seek Allah’s forgiveness and turn to Him in repentance more than seventy times a day.” (meaning — Zikru translation, to review)" },
  "Sahih al-Bukhari 7405 ; Sahih Muslim 2675": { en: "“I am as My servant thinks of Me, and I am with him when he remembers Me…” (ḥadīth qudsī) (meaning — Zikru translation, to review)", ar: "أَنَا عِنْدَ ظَنِّ عَبْدِي بِي، وَأَنَا مَعَهُ إِذَا ذَكَرَنِي" },
  "Sahih Muslim 2700": { en: "“No people sit remembering Allah without the angels surrounding them, mercy covering them, tranquillity descending upon them, and Allah mentioning them among those who are with Him.” (meaning — Zikru translation, to review)" },
  "Sahih al-Bukhari 6407": { en: "“The likeness of one who remembers his Lord and one who does not is that of the living and the dead.” (meaning — Zikru translation, to review)", ar: "مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ وَالَّذِي لَا يَذْكُرُ رَبَّهُ مَثَلُ الحَيِّ وَالمَيِّتِ" },
  "Jami‘ at-Tirmidhi 484": { en: "“The people closest to me on the Day of Resurrection are those who sent the most blessings upon me.” (meaning — Zikru translation, to review)" },
  "Sunan Abi Dawud 1047": { en: "“Among the best of your days is Friday… Send abundant blessings upon me on it, for your blessings are presented to me.” (meaning — Zikru translation, to review)" },
  "Sahih al-Bukhari 3293 ; Sahih Muslim 2691": { en: "Whoever says a hundred times a day “Lā ilāha illā-llāhu waḥdahu lā sharīka lah…” receives the reward of freeing ten slaves, a hundred good deeds are written for him, a hundred bad deeds are erased, and he is protected from Satan that day until evening. (meaning — Zikru translation, to review)" },
};
