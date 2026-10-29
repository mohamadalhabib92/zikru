/**
 * Du‘as — traductions anglaises et libellés arabes (P5).
 * - `en` : traduction Zikru du sens, faite sur le texte arabe (guidée par la traduction française relue) —
 *   « traduction à relire » dans la fiche de validation savante. Jamais de modification du texte arabe source.
 * - `title` / `when` / `note` : [anglais, arabe standard moderne] des libellés d’interface (le texte de l’invocation
 *   reste l’arabe d’origine, `Dua.ar`).
 */
export type DuaI18n = { title: [string, string]; when?: [string, string]; en: string; note?: [string, string] };

export const DUAS_I18N: Record<string, DuaI18n> = {
  sabah: {
    title: ['By You we reach the morning', 'اللهم بك أصبحنا'],
    when: ['Morning (evening wording given)', 'في الصباح (مع صيغة المساء)'],
    en: 'O Allah, by You we reach the morning and by You we reach the evening, by You we live and by You we die, and to You is the resurrection.',
    note: [
      'In the evening: “Allāhumma bika amsaynā, wa bika aṣbaḥnā, wa bika naḥyā, wa bika namūtu, wa ilayka-l-maṣīr” — and to You is the final return.',
      'وفي المساء: «اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ».',
    ],
  },
  amsayna: {
    title: ['We have reached the evening, and the dominion belongs to Allah', 'أمسينا وأمسى الملك لله'],
    when: ['Evening (morning: “aṣbaḥnā… hādha-l-yawm”)', 'في المساء (وفي الصباح: «أصبحنا… هذا اليوم»)'],
    en: 'We have reached the evening and the dominion belongs to Allah; praise be to Allah. There is no god but Allah alone, without partner; His is the dominion and His the praise, and He has power over all things. O Allah, I ask You for the good of this night and seek refuge in You from the evil of this night and of what follows it. O Allah, I seek refuge in You from laziness and the miseries of old age; I seek refuge in You from a punishment in the Fire and a punishment in the grave.',
  },
  'bismillah-ladhi': {
    title: ['In the name of Allah, with whose name nothing can harm', 'بسم الله الذي لا يضر مع اسمه شيء'],
    when: ['Morning and evening', 'صباحًا ومساءً'],
    en: 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm; He is the All-Hearing, the All-Knowing.',
  },
  afini: {
    title: ['Grant me well-being in my body', 'اللهم عافني في بدني'],
    when: ['Morning and evening', 'صباحًا ومساءً'],
    en: 'O Allah, grant me well-being in my body; O Allah, grant me well-being in my hearing; O Allah, grant me well-being in my sight. There is no god but You.',
  },
  'kufr-faqr': {
    title: ['Refuge from disbelief and poverty', 'الاستعاذة من الكفر والفقر'],
    when: ['Morning and evening', 'صباحًا ومساءً'],
    en: 'O Allah, I seek refuge in You from disbelief and poverty; O Allah, I seek refuge in You from the punishment of the grave. There is no god but You.',
  },
  afiya: {
    title: ['Asking for well-being (al-‘āfiya)', 'سؤال العافية'],
    when: ['Morning and evening', 'صباحًا ومساءً'],
    en: 'O Allah, I ask You for well-being in this world and the Hereafter. O Allah, I ask You for pardon and well-being in my religion, my worldly life, my family and my wealth. O Allah, cover my faults and calm my fears. O Allah, guard me from in front of me and behind me, from my right and my left, and from above me; and I seek refuge in Your greatness from being taken unawares from beneath me.',
  },
  fatir: {
    title: ['O Originator of the heavens and the earth', 'اللهم فاطر السماوات والأرض'],
    when: ['Morning, evening and at bedtime', 'صباحًا ومساءً وعند النوم'],
    en: 'O Allah, Originator of the heavens and the earth, Knower of the unseen and the seen, Lord and Sovereign of all things: I bear witness that there is no god but You. I seek refuge in You from the evil of my own soul, and from the evil of Satan and his call to associate partners with You.',
  },
  'subhan-bihamdih': {
    title: ['Glory and praise be to Allah', 'سبحان الله وبحمده'],
    when: ['Morning and evening', 'صباحًا ومساءً'],
    en: 'Glory be to Allah and praise be to Him.',
  },
  tahlil: {
    title: ['The full tahlīl', 'التهليل'],
    when: ['Every day', 'كل يوم'],
    en: 'There is no god but Allah alone, without partner; His is the dominion and His the praise, and He has power over all things.',
  },
  nawm: {
    title: ['In Your name I die and I live', 'باسمك أموت وأحيا'],
    when: ['At bedtime / on waking', 'عند النوم / عند الاستيقاظ'],
    en: 'In Your name, O Allah, I die and I live. — (On waking) Praise be to Allah who gave us life after causing us to die, and to Him is the resurrection.',
  },
  aslamtu: {
    title: ['I submit myself to You', 'اللهم أسلمت نفسي إليك'],
    when: ['Lying on the right side, as the last words', 'عند الاضطجاع على الشق الأيمن، آخرَ ما يقول'],
    en: 'O Allah, I have submitted my face to You, entrusted my affair to You and leaned my back upon You, out of longing for You and fear of You. There is no refuge and no escape from You except to You. O Allah, I believe in Your Book which You revealed and in Your Prophet whom You sent.',
  },
  'bismika-rabbi': {
    title: ['In Your name, my Lord, I lie down', 'باسمك ربي وضعت جنبي'],
    when: ['At bedtime', 'عند النوم'],
    en: 'In Your name, my Lord, I lay down my side and by You I raise it. If You take my soul, have mercy on it; and if You send it back, protect it as You protect Your righteous servants.',
  },
  qini: {
    title: ['Protect me from Your punishment', 'اللهم قني عذابك'],
    when: ['Right hand under the cheek, at bedtime', 'واليد اليمنى تحت الخد، عند النوم'],
    en: 'O Allah, protect me from Your punishment on the day You resurrect Your servants.',
  },
  atamana: {
    title: ['Praise be to Him who fed us and sheltered us', 'الحمد لله الذي أطعمنا وآوانا'],
    when: ['At bedtime', 'عند النوم'],
    en: 'Praise be to Allah who fed us and gave us drink, who sufficed us and sheltered us; how many there are who have no one to suffice them or give them shelter!',
  },
  'tasbih-fatima': {
    title: ['The tasbīḥ of Fāṭima', 'تسبيح فاطمة'],
    when: ['At bedtime', 'عند النوم'],
    en: 'Glory be to Allah (33 times), praise be to Allah (33 times), Allah is the Greatest (34 times). The Prophet ﷺ taught it to ‘Alī and Fāṭima as “better for you than a servant”.',
  },
  'muawwidhat-nawm': {
    title: ['The three Quls blown into the hands', 'النفث في الكفين بالمعوذات'],
    when: ['At bedtime', 'عند النوم'],
    en: 'Join the palms, blow into them while reciting Sūrat al-Ikhlāṣ, al-Falaq and an-Nās, then wipe them over the body, starting with the head and face. Do this three times.',
  },
  kursi: {
    title: ['Āyat al-Kursī', 'آية الكرسي'],
    when: ['At bedtime (also after the prayer)', 'عند النوم (وبعد الصلاة أيضًا)'],
    en: 'Allah — there is no god but He, the Ever-Living, the Self-Subsisting. Neither drowsiness nor sleep overtakes Him. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is before them and what is behind them, and they encompass nothing of His knowledge except what He wills. His Kursī extends over the heavens and the earth, and guarding them does not tire Him. And He is the Most High, the Most Great.',
  },
  taarra: {
    title: ['On waking during the night', 'من تعارّ من الليل'],
    when: ['Waking during the night', 'عند الاستيقاظ ليلًا'],
    en: 'There is no god but Allah alone, without partner… Praise be to Allah, glory be to Allah, there is no god but Allah, Allah is the Greatest, and there is no might nor power except by Allah. O Allah, forgive me. (Whoever says this and then supplicates is answered.)',
  },
  akl: {
    title: ['Before eating', 'قبل الطعام'],
    when: ['Before eating (if forgotten)', 'قبل الطعام (وعند النسيان)'],
    en: 'Say “Bismillāh” before eating; if you forgot: “In the name of Allah, at its beginning and its end.”',
  },
  ba3d: {
    title: ['After the meal', 'بعد الطعام'],
    when: ['After the meal', 'بعد الطعام'],
    en: 'Praise be to Allah who fed me this food and provided it for me without any might or power on my part.',
  },
  kathiran: {
    title: ['Abundant praise after the meal', 'الحمد الكثير بعد الطعام'],
    when: ['When the meal is cleared away', 'عند رفع المائدة'],
    en: 'Praise be to Allah, abundant, good and blessed praise; praise that is never enough, never abandoned and never dispensed with, O our Lord.',
  },
  hote: {
    title: ['For your host', 'الدعاء لمن أطعمك'],
    when: ['After being invited', 'بعد الضيافة'],
    en: 'O Allah, bless them in what You have provided for them, forgive them and have mercy on them.',
  },
  khuruj: {
    title: ['On leaving the house', 'عند الخروج من المنزل'],
    when: ['On leaving the house', 'عند الخروج من المنزل'],
    en: 'In the name of Allah, I put my trust in Allah; there is no might nor power except by Allah.',
  },
  dalal: {
    title: ['Refuge from going astray', 'الاستعاذة من الضلال'],
    when: ['On leaving the house', 'عند الخروج من المنزل'],
    en: 'O Allah, I seek refuge in You from going astray or being led astray, from slipping or being made to slip, from wronging others or being wronged, and from acting foolishly or being treated foolishly.',
  },
  dukhul: {
    title: ['On entering the house', 'عند دخول المنزل'],
    when: ['On entering the house and at meals', 'عند دخول المنزل وعند الطعام'],
    en: 'Mention the name of Allah when entering the house and at mealtime: Satan then says to his companions, “No lodging and no supper for you here.”',
  },
  khala: {
    title: ['On entering the toilet', 'عند دخول الخلاء'],
    when: ['Before entering the toilet', 'قبل دخول الخلاء'],
    en: 'O Allah, I seek refuge in You from the male and female devils (from evil and those who bear it).',
  },
  ghufranak: {
    title: ['On leaving the toilet', 'عند الخروج من الخلاء'],
    when: ['On leaving the toilet', 'عند الخروج من الخلاء'],
    en: '(I ask for) Your forgiveness.',
  },
  wudu: {
    title: ['After ablution', 'بعد الوضوء'],
    when: ['After ablution', 'بعد الوضوء'],
    en: 'I bear witness that there is no god but Allah alone, without partner, and I bear witness that Muhammad is His servant and His Messenger. (The eight gates of Paradise are opened for him.)',
  },
  libas: {
    title: ['On putting on a garment', 'عند لبس الثوب'],
    when: ['When getting dressed', 'عند اللبس'],
    en: 'Praise be to Allah who clothed me with this garment and provided it for me without any might or power on my part.',
  },
  atas: {
    title: ['Sneezing', 'العطاس'],
    when: ['After sneezing', 'بعد العطاس'],
    en: 'The one who sneezes says “Praise be to Allah”; the reply is “May Allah have mercy on you”; and he answers “May Allah guide you and set your affairs right.”',
  },
  majlis: {
    title: ['Expiation of a gathering', 'كفارة المجلس'],
    when: ['Before leaving a gathering', 'قبل القيام من المجلس'],
    en: 'Glory be to You, O Allah, and praise be to You. I bear witness that there is no god but You; I ask Your forgiveness and turn to You in repentance.',
  },
  ghadab: {
    title: ['Against anger', 'عند الغضب'],
    when: ['When angry', 'عند الغضب'],
    en: 'I seek refuge in Allah from Satan the accursed. (“I know a phrase which, if he said it, what he feels would leave him.”)',
  },
  safar: {
    title: ['The travel supplication', 'دعاء السفر'],
    when: ['Once seated on one’s mount, after 3 takbīrs', 'إذا استوى على راحلته، بعد التكبير ثلاثًا'],
    en: 'Allah is the Greatest (×3). Glory be to Him who has subjected this to us, for we could never have done it ourselves; and to our Lord we shall surely return. O Allah, we ask You on this journey for righteousness and piety, and for deeds that please You. O Allah, make this journey easy for us and shorten its distance. O Allah, You are the Companion on the journey and the Guardian of the family. O Allah, I seek refuge in You from the hardship of travel, from distressing sights, and from an ill return to wealth and family.',
  },
  ayibun: {
    title: ['On returning from a journey', 'عند الرجوع من السفر'],
    when: ['On returning (added to the travel supplication)', 'عند الرجوع (مع دعاء السفر)'],
    en: 'We return, repentant, worshipping, and praising our Lord.',
  },
  suud: {
    title: ['Going up and going down', 'التكبير والتسبيح في الصعود والهبوط'],
    when: ['Going uphill / downhill', 'عند الصعود / عند النزول'],
    en: 'The Companions would say “Allah is the Greatest” when going up and “Glory be to Allah” when going down.',
  },
  manzil: {
    title: ['On stopping at a place', 'عند نزول منزل'],
    when: ['At a stopping place; also in the evening', 'عند النزول في مكان، وفي المساء أيضًا'],
    en: 'I seek refuge in the perfect words of Allah from the evil of what He has created. (Nothing will harm him until he leaves that place.)',
  },
  wada: {
    title: ['Bidding farewell to a traveller', 'توديع المسافر'],
    when: ['For someone setting off', 'لمن أراد السفر'],
    en: 'I entrust to Allah your religion, your trust (what you are responsible for) and the final outcome of your deeds.',
  },
  masjid: {
    title: ['Entering and leaving the mosque', 'دخول المسجد والخروج منه'],
    when: ['On entering / leaving the mosque', 'عند دخول المسجد / الخروج منه'],
    en: 'O Allah, open for me the gates of Your mercy. — (On leaving) O Allah, I ask You of Your bounty.',
  },
  azim: {
    title: ['Seeking refuge on entering the mosque', 'الاستعاذة عند دخول المسجد'],
    when: ['On entering the mosque', 'عند دخول المسجد'],
    en: 'I seek refuge in Allah the Magnificent, by His noble Face and His eternal authority, from Satan the accursed.',
  },
  nur: {
    title: ['O Allah, place light in my heart', 'اللهم اجعل في قلبي نورًا'],
    when: ['On the way to prayer, at night', 'عند الخروج إلى الصلاة، وفي الليل'],
    en: 'O Allah, place light in my heart, light in my sight, light in my hearing, light on my right, light on my left, light above me, light below me, light in front of me, light behind me, and grant me light.',
  },
  adhan: {
    title: ['After the adhan', 'بعد الأذان'],
    when: ['After hearing the call to prayer', 'بعد سماع الأذان'],
    en: 'O Allah, Lord of this perfect call and of the prayer about to be established, grant Muhammad al-Wasīla and pre-eminence, and raise him to the praised station that You have promised him.',
  },
  raditu: {
    title: ['Content with Allah as Lord', 'رضيت بالله ربًّا'],
    when: ['On hearing the muezzin', 'عند سماع المؤذن'],
    en: 'I bear witness that there is no god but Allah alone, without partner, and that Muhammad is His servant and His Messenger. I am content with Allah as Lord, with Muhammad as Messenger and with Islam as religion.',
  },
  istiftah: {
    title: ['Opening of the prayer', 'دعاء الاستفتاح'],
    when: ['After the opening takbīr', 'بعد تكبيرة الإحرام'],
    en: 'Glory be to You, O Allah, and praise be to You; blessed is Your name, exalted is Your majesty, and there is no god but You.',
  },
  'ruku-sujud': {
    title: ['Bowing and prostration', 'الركوع والسجود'],
    when: ['Rukū‘ / sujūd', 'في الركوع / في السجود'],
    en: 'Glory be to my Lord, the Magnificent (in bowing). — Glory be to my Lord, the Most High (in prostration).',
  },
  jalsa: {
    title: ['Between the two prostrations', 'بين السجدتين'],
    when: ['Sitting between the two prostrations', 'في الجلوس بين السجدتين'],
    en: 'My Lord, forgive me; my Lord, forgive me.',
  },
  'salat-ibrahimiyya': {
    title: ['Blessings upon the Prophet ﷺ (aṣ-ṣalāt al-ibrāhīmiyya)', 'الصلاة الإبراهيمية'],
    when: ['In the final tashahhud', 'في التشهد الأخير'],
    en: 'O Allah, send prayers upon Muhammad and upon the family of Muhammad as You sent prayers upon Ibrāhīm and upon the family of Ibrāhīm; You are Praiseworthy, Glorious. O Allah, bless Muhammad and the family of Muhammad as You blessed Ibrāhīm and the family of Ibrāhīm; You are Praiseworthy, Glorious.',
  },
  arba: {
    title: ['Refuge from four things', 'الاستعاذة من أربع'],
    when: ['After the final tashahhud, before the salām', 'بعد التشهد الأخير وقبل السلام'],
    en: 'O Allah, I seek refuge in You from the punishment of Hell, the punishment of the grave, the trials of life and death, and the evil of the trial of the False Messiah.',
  },
  abubakr: {
    title: ['The supplication taught to Abū Bakr', 'الدعاء الذي علّمه النبي ﷺ أبا بكر'],
    when: ['In the prayer', 'في الصلاة'],
    en: 'O Allah, I have greatly wronged myself and no one forgives sins except You: grant me forgiveness from You and have mercy on me; You are the Forgiving, the Merciful.',
  },
  qunut: {
    title: ['Qunūt of witr', 'قنوت الوتر'],
    when: ['In the witr prayer', 'في صلاة الوتر'],
    en: 'O Allah, guide me among those You have guided, grant me well-being among those You have granted well-being, take me into Your care among those You have taken into Your care, bless me in what You have given me and protect me from the evil of what You have decreed. For You decree and none decrees against You; the one You befriend is never humiliated and the one You take as an enemy is never honoured. Blessed are You, our Lord, and Exalted.',
  },
  salam: {
    title: ['Right after the salām', 'بعد السلام من الصلاة'],
    when: ['After every obligatory prayer', 'بعد كل صلاة مفروضة'],
    en: 'I ask Allah for forgiveness (×3). O Allah, You are Peace and from You comes peace; blessed are You, O Possessor of majesty and honour.',
  },
  'la-mani': {
    title: ['None can withhold what You give', 'اللهم لا مانع لما أعطيت'],
    when: ['After every obligatory prayer', 'بعد كل صلاة مفروضة'],
    en: 'There is no god but Allah alone, without partner… O Allah, none can withhold what You give, nor give what You withhold, and the wealth of the wealthy avails him nothing before You.',
  },
  'tasbih-33': {
    title: ['Tasbīḥ, taḥmīd, takbīr', 'التسبيح والتحميد والتكبير'],
    when: ['After every prayer', 'بعد كل صلاة'],
    en: 'Glory be to Allah (33), praise be to Allah (33), Allah is the Greatest (33), and to complete the hundred: “There is no god but Allah alone, without partner…”. His sins are forgiven, even if they were like the foam of the sea.',
  },
  ainni: {
    title: ['Help me to remember You', 'اللهم أعني على ذكرك'],
    when: ['At the end of every prayer', 'في دبر كل صلاة'],
    en: 'O Allah, help me to remember You, to thank You and to worship You well.',
  },
  'muawwidhat-salat': {
    title: ['The protective surahs', 'المعوذات'],
    when: ['After every prayer', 'بعد كل صلاة'],
    en: '“The Messenger of Allah ﷺ commanded me to recite the mu‘awwidhāt at the end of every prayer.” (‘Uqba ibn ‘Āmir)',
  },
  jubn: {
    title: ['Refuge from cowardice', 'الاستعاذة من الجبن'],
    when: ['At the end of the prayer', 'في دبر الصلاة'],
    en: 'O Allah, I seek refuge in You from cowardice, from being returned to the most decrepit old age, from the trials of this world and from the punishment of the grave.',
  },
  'ilm-nafi': {
    title: ['Beneficial knowledge and lawful provision', 'العلم النافع والرزق الطيب'],
    when: ['After the salām of the Fajr prayer', 'بعد السلام من صلاة الفجر'],
    en: 'O Allah, I ask You for beneficial knowledge, good provision and accepted deeds.',
  },
  enfants: {
    title: ['Protecting one’s children', 'تعويذ الأولاد'],
    when: ['For children (the Prophet ﷺ sought protection for al-Ḥasan and al-Ḥusayn this way)', 'للأولاد (كان النبي ﷺ يعوّذ بها الحسن والحسين)'],
    en: 'I seek refuge in the perfect words of Allah from every devil, every harmful creature and every evil eye. (For a child one says “u‘īdhuka”: I place you under the protection…)',
  },
  nuhur: {
    title: ['When fearing a group of people', 'عند الخوف من قوم'],
    when: ['When fearing people', 'إذا خاف قومًا'],
    en: 'O Allah, we place You before them and seek refuge in You from their evils.',
  },
  zawal: {
    title: ['Refuge from the loss of blessings', 'الاستعاذة من زوال النعمة'],
    when: ['At any time', 'في كل وقت'],
    en: 'O Allah, I seek refuge in You from the loss of Your blessing, the withdrawal of Your protection, the suddenness of Your punishment and all that brings Your displeasure.',
  },
  hasbuna: {
    title: ['Allah is sufficient for us', 'حسبنا الله ونعم الوكيل'],
    when: ['In the face of threat or fear', 'عند التهديد أو الخوف'],
    en: 'Allah is sufficient for us, and how excellent a Guardian He is! (The words of Ibrāhīm when cast into the fire, and of Muhammad ﷺ when told that people had gathered against them.)',
  },
  karb: {
    title: ['The supplication of distress', 'دعاء الكرب'],
    when: ['In distress', 'عند الكرب'],
    en: 'There is no god but Allah, the Magnificent, the Forbearing; there is no god but Allah, Lord of the Magnificent Throne; there is no god but Allah, Lord of the heavens, Lord of the earth and Lord of the Noble Throne.',
  },
  yunus: {
    title: ['The supplication of Yūnus (Jonah)', 'دعوة ذي النون'],
    when: ['In hardship', 'عند الشدة'],
    en: 'There is no god but You, glory be to You! I have indeed been among the wrongdoers.',
  },
  hamm: {
    title: ['Against worry and sorrow', 'الاستعاذة من الهم والحزن'],
    when: ['Against worries', 'عند الهموم'],
    en: 'O Allah, I seek refuge in You from worry and sorrow, from incapacity and laziness, from cowardice and miserliness, from the burden of debt and from being overpowered by men.',
  },
  abduka: {
    title: ['O Allah, I am Your servant', 'اللهم إني عبدك'],
    when: ['Against grief and anxiety', 'عند الحزن والقلق'],
    en: 'O Allah, I am Your servant, son of Your servant and of Your maidservant; my forelock is in Your hand, Your judgement upon me is executed, Your decree concerning me is just. I ask You by every name that is Yours — with which You named Yourself, revealed in Your Book, taught to any of Your creation or kept in the knowledge of the unseen with You — to make the Qur’an the spring of my heart, the light of my chest, the removal of my sorrow and the departure of my worry.',
  },
  'hayy-qayyum': {
    title: ['O Ever-Living, O Self-Subsisting', 'يا حي يا قيوم'],
    when: ['When a matter weighs heavily', 'إذا كربه أمر'],
    en: 'O Ever-Living, O Self-Subsisting, by Your mercy I seek help.',
  },
  makrub: {
    title: ['The supplication of the distressed', 'دعوة المكروب'],
    when: ['In sorrow', 'عند الضيق'],
    en: 'O Allah, it is Your mercy that I hope for: do not leave me to myself even for the blink of an eye, and set right all my affairs. There is no god but You.',
  },
  dayn: {
    title: ['Against debts', 'لقضاء الدين'],
    when: ['To be freed from debt', 'للتخلص من الدين'],
    en: 'O Allah, suffice me with what You have made lawful so that I need not the unlawful, and enrich me by Your bounty so that I need none but You.',
  },
  'la-bas': {
    title: ['When visiting the sick', 'عند عيادة المريض'],
    when: ['With a sick person', 'عند المريض'],
    en: 'No harm: it is a purification, if Allah wills.',
  },
  yashfik: {
    title: ['Asking healing for the sick', 'الدعاء للمريض بالشفاء'],
    when: ['With a sick person', 'عند المريض'],
    en: 'I ask Allah the Magnificent, Lord of the Magnificent Throne, to cure you.',
  },
  ruqya: {
    title: ['O Allah, Lord of mankind', 'اللهم رب الناس'],
    when: ['Placing the hand on the sick person', 'مع وضع اليد على المريض'],
    en: 'O Allah, Lord of mankind, remove the harm and heal him; You are the Healer, there is no healing but Your healing, a healing that leaves no illness behind.',
  },
  waja: {
    title: ['Against pain', 'عند الألم'],
    when: ['Hand placed on the painful spot', 'مع وضع اليد على موضع الألم'],
    en: 'Place your hand on the painful spot, say “In the name of Allah” three times, then seven times: “I seek refuge in Allah and His power from the evil of what I feel and what I fear.”',
  },
  musiba: {
    title: ['When struck by calamity', 'عند المصيبة'],
    when: ['In a trial or bereavement', 'عند البلاء أو الفقد'],
    en: 'We belong to Allah and to Him we shall return. O Allah, reward me in my affliction and replace it for me with something better.',
  },
  sayyid: {
    title: ['Sayyid al-istighfār', 'سيد الاستغفار'],
    when: ['Morning and evening', 'صباحًا ومساءً'],
    en: 'O Allah, You are my Lord, there is no god but You. You created me and I am Your servant; I keep to my covenant and promise to You as far as I am able. I seek refuge in You from the evil of what I have done. I acknowledge Your blessings upon me and I acknowledge my sin: so forgive me, for none forgives sins but You.',
  },
  astaghfirullah: {
    title: ['I seek Allah’s forgiveness and repent to Him', 'أستغفر الله وأتوب إليه'],
    when: ['Every day', 'كل يوم'],
    en: 'I seek Allah’s forgiveness and I repent to Him. (The Prophet ﷺ said it more than 70 times a day; according to Muslim, 100 times.)',
  },
  'tub-alayya': {
    title: ['My Lord, forgive me and accept my repentance', 'رب اغفر لي وتب علي'],
    when: ['In a gathering', 'في المجلس'],
    en: 'My Lord, forgive me and accept my repentance; You are the Accepter of repentance, the Merciful. (It was counted a hundred times in a single gathering.)',
  },
  'hayy-istighfar': {
    title: ['Istighfār by the Ever-Living, the Self-Subsisting', 'الاستغفار بالحي القيوم'],
    when: ['At any time', 'في كل وقت'],
    en: 'I seek forgiveness from Allah, besides whom there is no god, the Ever-Living, the Self-Subsisting, and I repent to Him.',
  },
  iftar: {
    title: ['On breaking the fast', 'عند الإفطار'],
    when: ['At iftar', 'عند الإفطار'],
    en: 'The thirst has gone, the veins are moistened and the reward is assured, if Allah wills.',
  },
  aftara: {
    title: ['For the one who gives you iftar', 'الدعاء لمن فطّرك'],
    when: ['With those who fed you', 'عند من أطعمك'],
    en: 'May those who fast break their fast with you, may the righteous eat your food and may the angels send prayers upon you.',
  },
  saim: {
    title: ['When insulted while fasting', 'إذا سُبّ الصائم'],
    when: ['If someone insults you while fasting', 'إذا سابّه أحد وهو صائم'],
    en: 'I am fasting. (Said twice, instead of replying.)',
  },
  afw: {
    title: ['Laylat al-Qadr', 'ليلة القدر'],
    when: ['Nights of Ramadan (Laylat al-Qadr)', 'ليالي رمضان (ليلة القدر)'],
    en: 'O Allah, You are the One who pardons and You love to pardon, so pardon me.',
    note: ['Some editions of at-Tirmidhī add “karīm” (‘afuwwun karīm).', 'تزيد بعض طبعات الترمذي «كريم» (عفوٌّ كريم).'],
  },
  sayyiban: {
    title: ['When it rains', 'عند نزول المطر'],
    when: ['On seeing rain', 'عند رؤية المطر'],
    en: 'O Allah, (make it) a beneficial rain.',
  },
  mutirna: {
    title: ['After the rain', 'بعد المطر'],
    when: ['After the rain', 'بعد المطر'],
    en: 'We have been given rain by the bounty of Allah and His mercy.',
  },
  aghithna: {
    title: ['Asking for rain', 'الاستسقاء'],
    when: ['In times of drought', 'عند الجدب'],
    en: 'O Allah, send us rain (×3).',
  },
  hawalayna: {
    title: ['When rain is excessive', 'إذا كثر المطر'],
    when: ['Too much rain', 'عند كثرة المطر'],
    en: 'O Allah, around us and not upon us; O Allah, upon the hills and the heights, the valley bottoms and the places where trees grow.',
  },
  rih: {
    title: ['When the wind blows hard', 'عند هبوب الريح'],
    when: ['In strong wind', 'عند اشتداد الريح'],
    en: 'O Allah, I ask You for its good, the good of what it contains and the good of what it has been sent with; and I seek refuge in You from its evil, the evil of what it contains and the evil of what it has been sent with.',
  },
  walidayn: {
    title: ['For one’s parents', 'الدعاء للوالدين'],
    when: ['For one’s parents', 'للوالدين'],
    en: 'My Lord, have mercy on them as they raised me when I was small.',
  },
  zawaj: {
    title: ['Congratulating the newly-weds', 'التهنئة بالزواج'],
    when: ['For a newly married person', 'للمتزوج حديثًا'],
    en: 'May Allah bless you, shower His blessings upon you and unite you both in goodness.',
  },
  jazak: {
    title: ['Thanking a benefactor', 'شكر صاحب المعروف'],
    when: ['When someone does you a favour', 'إذا صُنع إليك معروف'],
    en: 'May Allah reward you with good. (“Whoever says this has thanked fully.”)',
  },
  janaza: {
    title: ['Prayer for the deceased', 'الدعاء للميت'],
    when: ['In the funeral prayer', 'في صلاة الجنازة'],
    en: 'O Allah, forgive him, have mercy on him, grant him well-being and pardon him; honour his reception and widen his resting place; wash him with water, snow and hail, and cleanse him of sins as a white garment is cleansed of dirt; give him in exchange a home better than his home, a family better than his family and a spouse better than his spouse; admit him to Paradise and protect him from the punishment of the grave and the punishment of the Fire.',
    note: ['In the hadith, the ending is reported as “from the punishment of the grave or the punishment of the Fire” (the narrator’s hesitation).', 'في الحديث رُويت الخاتمة: «من عذاب القبر أو من عذاب النار» (على الشك من الراوي).'],
  },
  qubur: {
    title: ['When visiting the graveyard', 'عند زيارة القبور'],
    when: ['On entering the graveyard', 'عند دخول المقبرة'],
    en: 'Peace be upon you, inhabitants of these dwellings, believers and Muslims; we shall join you, if Allah wills. I ask Allah for well-being for us and for you.',
  },
  hasana: {
    title: ['Good in this world and the Hereafter', 'ربنا آتنا في الدنيا حسنة'],
    when: ['At any time', 'في كل وقت'],
    en: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
  },
  huda: {
    title: ['Guidance, piety, chastity, self-sufficiency', 'الهدى والتقى والعفاف والغنى'],
    when: ['At any time', 'في كل وقت'],
    en: 'O Allah, I ask You for guidance, piety, chastity and self-sufficiency.',
  },
  taqwaha: {
    title: ['Grant my soul its piety', 'اللهم آت نفسي تقواها'],
    when: ['At any time', 'في كل وقت'],
    en: 'O Allah, grant my soul its piety and purify it, for You are the best to purify it; You are its Guardian and its Master. O Allah, I seek refuge in You from knowledge that does not benefit, a heart that is not humble, a soul that is never satisfied and a supplication that is not answered.',
  },
  thabbit: {
    title: ['Make my heart firm', 'يا مقلب القلوب ثبت قلبي'],
    when: ['For steadfastness in faith', 'للثبات على الدين'],
    en: 'O Turner of hearts, make my heart firm upon Your religion.',
  },
  ilm: {
    title: ['Increase me in knowledge', 'رب زدني علمًا'],
    when: ['Before studying', 'قبل طلب العلم'],
    en: 'My Lord, increase me in knowledge.',
  },
  istikhara: {
    title: ['The prayer of seeking guidance (istikhāra)', 'صلاة الاستخارة'],
    when: ['After two voluntary rak‘as, before a decision', 'بعد ركعتين من غير الفريضة، قبل الأمر'],
    en: 'O Allah, I seek Your guidance through Your knowledge, I seek ability through Your power, and I ask You of Your immense bounty: for You are able and I am not, You know and I do not, and You are the Knower of the unseen. O Allah, if You know that this matter (one names it) is good for me in my religion, my livelihood and the outcome of my affair, then decree it for me; and if You know that it is bad for me in my religion, my livelihood and the outcome of my affair, then turn it away from me and turn me away from it, and decree for me the good wherever it may be, then make me content with it.',
    note: [
      'The narrator also reports “‘ājili amrī wa ājilih” (my affair now and later) in place of “‘āqibati amrī”.',
      'وشكّ الراوي فقال أيضًا: «عاجل أمري وآجله» بدل «عاقبة أمري».',
    ],
  },
};
