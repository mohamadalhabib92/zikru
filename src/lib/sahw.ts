/**
 * Sujud as-sahw (prosternations de l’oubli) — résumé pédagogique pour les quatre écoles.
 * Chaque réponse cite sa source précise (livre, chapitre, page imprimée, édition) et un extrait arabe.
 * Règle : un cas non couvert par la source citée n’est pas affiché pour l’école concernée (voir `gap`).
 * Tout est « à valider » par une personne de savoir (statut par réponse : uid `sahw:<cas>:<école>`).
 */
import { SCHOOLS, src, type FiqhSource, type School } from './fiqh-rulings';

export type Madhab = School;
export type When = 'avant' | 'après' | 'aucun' | 'refaire' | 'selon';

const RIS = (page: string, idx: number) => src('risala', 'bāb jāmi‘ fī ṣ-ṣalāt (sujūd as-sahw)', page, idx);
const MAY = (page: string, idx: number) => src('mayyara', 'Kitāb aṣ-ṣalāt — faṣl sujūd as-sahw', page, idx);
const SHU = (page: string, idx: number) => src('shuja', 'Kitāb aṣ-ṣalāt — faṣl al-matrūk min aṣ-ṣalāt', page, idx);
const MIN = (page: string, idx: number) => src('minhaj', 'bāb sujūd as-sahw', page, idx);
const NUR = (page: string, idx: number) => src('nur', 'bāb sujūd as-sahw', page, idx);
const UMD = (page: string, idx: number) => src('umda', 'bāb sujūd as-sahw', page, idx);

export type SahwAnswer = { when: When; text: string; source: FiqhSource; also?: FiqhSource[]; textAr: string; note?: string };

export const HOW: Record<Madhab, { title: string; steps: string[]; source: FiqhSource; textAr: string }> = {
  maliki: {
    title: 'Comment faire (malikite)',
    steps: [
      'Avant le salam (manque d’une sunna confirmée) : après le tashahhud, deux prosternations, puis tashahhud et salam.',
      'Après le salam (ajout) : après le salam, deux prosternations, un tashahhud, puis un salam.',
      'Manque et ajout dans la même prière : avant le salam.',
      'Oubli de la prosternation d’après le salam : la faire dès qu’on s’en souvient, même longtemps après. Celle d’avant le salam : la faire si c’est proche ; sinon recommencer la prière, sauf pour un manque léger (sourate, deux takbirs, les tashahhuds…).',
    ],
    source: RIS('p. 37-38', 43),
    textAr:
      'فليسجد له سجدتين بعد السلام يتشهد لهما ويسلم منهما وكل سهوٍ ينقص فليسجد له قبل السلام إذا تم يتشهده ثم يتشهد ويسلم ... ومن نقص وزاد سجد قبل السلام ومن نسي ان يسجد بعد السلام فليسجد متى ما ذكره وإن طال ذلك وإن كان قبل السلام سجد إن كان قريباً وإن بعد ابتدأ صلاته إلا أن يكون ذلك من نقص شيء خفيف كالسورة مع ... أم القرآن أو تكبيرتين أو التشهدين وشبه ذلك فلا شيء عليه',
  },
  shafii: {
    title: 'Comment faire (chaféite)',
    steps: [
      'Toujours avant le salam, qu’il y ait manque, ajout ou doute (entre le tashahhud final et le salam).',
      'Deux prosternations comme celles de la prière, même s’il y a eu plusieurs oublis.',
      'La prosternation de l’oubli est une sunna.',
    ],
    source: MIN('p. 34', 36),
    textAr: 'وسجود السهو وإن كثر سجدتان كسجود الصلاة والجديد أن محله بين تشهده وسلامه',
  },
  hanafi: {
    title: 'Comment faire (hanafite)',
    steps: [
      'Elle est wajib quand on omet un wajib par oubli : deux prosternations, puis tashahhud et salam.',
      'Il est sunna de la faire après le salam (un seul salam à droite suffit selon l’avis le plus juste) ; avant le salam, c’est makruh tanzihan.',
      'Omission volontaire d’un wajib : péché, et la prière doit être refaite.',
      'Le ma’mum se prosterne pour l’oubli de son imam, pas pour le sien.',
    ],
    source: NUR('p. 95-96', 119),
    textAr: 'يجب سجدتان بتشهد وتسليم لترك واجب سهوا وإن تكرر ... ويسن الإتيان بسجود السهو بعد السلام. ويكتفي بتسليمه واحدة عن يمينه في الأصح. فإن سجد قبل السلام كره تنزيها ... ويلزم المأموم بسهو إمامه لا بسهوه.',
  },
  hanbali: {
    title: 'Comment faire (hanbalite)',
    steps: [
      'Trois sortes d’oubli : ajout, manque, doute.',
      'Deux prosternations avant le salam, sauf trois cas où c’est après le salam (puis tashahhud et salam) : le salam donné alors que la prière était incomplète, l’imam qui s’est fié à sa conviction dominante, et celui qui a oublié la prosternation d’avant le salam.',
      'Le ma’mum n’a pas de prosternation de l’oubli, sauf si son imam se prosterne : il le fait avec lui.',
    ],
    source: UMD('p. 27', 27),
    textAr:
      'ولكل سهو سجدتان قبل السلام إلا من سلم عن نقص في صلاته والإمام إذا بنى على غالب ظنه والناسي للسجود قبل السلام فإنه يسجد سجدتين بعد سلامه ثم يتشهد ويسلم. وليس على المأموم سجود سهو إلا أن يسهو إمامه فيسجد معه.',
  },
};

export type Case = { id: string; q: string; by: Partial<Record<Madhab, SahwAnswer>>; gap?: Partial<Record<Madhab, string>> };

export const CASES: Case[] = [
  {
    id: 'doubt',
    q: 'J’ai un doute sur le nombre de rak‘as',
    by: {
      maliki: { when: 'après', text: 'Se baser sur le certain (le plus petit nombre), accomplir ce dont on doute, puis se prosterner après le salam. Celui qui doute souvent (mustankiḥ) n’en tient pas compte et se prosterne seulement après le salam.', source: RIS('p. 38-39', 44), textAr: 'ومن لم يدر ما صلى أثلاث ركعات أم أربعا بنى على اليقين وصلى ما شك فيه وأتى برابعة وسجد بعد سلامه ... ومن استنكحه الشك في السهو فليله عنه ولا إصلاح عليه ولكن عليه أن يسجد بعد السلام' },
      shafii: { when: 'avant', text: 'Se baser sur le certain (le plus petit nombre), ajouter la rak‘a douteuse, puis se prosterner avant le salam — même si le doute disparaît avant le salam.', source: SHU('p. 11', 10), also: [MIN('p. 34', 36)], textAr: 'وإذا شك في عدد ما أتى به من الركعات بنى على اليقين وهو الأقل وسجد للسهو وسجود السهو سنة ومحله قبل السلام' },
      hanafi: { when: 'selon', text: 'Si c’est le premier doute (ou s’il n’est pas habituel) avant la fin de la prière, la prière est annulée : la recommencer. Si l’on doute souvent : suivre sa conviction dominante ; à défaut, prendre le plus petit nombre et s’asseoir après chaque rak‘a qui pourrait être la dernière. Si l’on a réfléchi le temps d’un pilier avant d’être sûr, prosternation de l’oubli (après le salam).', source: NUR('p. 97', 122), also: [NUR('p. 97', 121)], textAr: 'تبطل الصلاة بالشك في عدد ركعاتها إذا كان قبل إكمالها: هو أول ما عرض له من الشك. أو كان الشك غير عادة له ... وإن كثر الشك عمل بغالب ظنه. فإن لم يغلب له ظن أخذ بالأقل وقعد بعد كل ركعة ظنها آخر صلاته.' },
      hanbali: { when: 'avant', text: 'Se baser sur le certain, sauf l’imam qui suit sa conviction dominante. Prosternation avant le salam ; pour l’imam qui a suivi sa conviction dominante, après le salam. Douter d’avoir fait un pilier équivaut à l’avoir omis.', source: UMD('p. 27', 27), textAr: 'الضرب الثالث: الشك فمتى شك في ترك ركن فهو كتركه ومن شك في عدد الركعات بنى على اليقين إلا الإمام خاصة فإنه يبني على غالب ظنه. ولكل سهو سجدتان قبل السلام إلا من سلم عن نقص في صلاته والإمام إذا بنى على غالب ظنه' },
    },
  },
  {
    id: 'extra',
    q: 'J’ai ajouté une rak‘a (ex. 5 au lieu de 4)',
    by: {
      maliki: { when: 'après', text: 'Un ajout par oubli se répare par deux prosternations après le salam, suivies du tashahhud et du salam.', source: RIS('p. 37', 43), also: [MAY('p. 339', 333)], textAr: 'فليسجد له سجدتين بعد السلام يتشهد لهما ويسلم منهما', note: 'Le texte Shamela de la Risala est lacunaire juste avant ce passage (le mot « ajout » n’y figure pas) : à vérifier sur l’imprimé. Le vers d’Ibn ‘Āshir « ومن يزد سهوا » (Mayyāra p. 339) traite de l’ajout.' },
      shafii: { when: 'avant', text: 'Un acte qui annulerait la prière s’il était volontaire (comme une rak‘a en plus) entraîne, par oubli, la prosternation de l’oubli — avant le salam.', source: MIN('p. 33', 35), also: [MIN('p. 34', 36)], textAr: 'والثاني: إن لم يبطل عمده كالالتفات والخطوتين لم يسجد لسهوه وإلا سجد إن لم تبطل بسهوه' },
      hanafi: { when: 'selon', text: 'Si l’on s’est levé sans faire la dernière position assise : revenir tant qu’on ne s’est pas prosterné, et faire la prosternation de l’oubli ; si l’on s’est prosterné, la prière obligatoire devient surérogatoire (on peut ajouter une rak‘a). Si l’on s’était assis pour la dernière position puis levé : revenir et faire le salam ; si l’on s’est prosterné, le fard reste valide, ajouter une rak‘a (les deux deviennent nafila) et faire la prosternation de l’oubli.', source: NUR('p. 96', 120), textAr: 'وإن سها عن القعود الأخير عاد ما لم يسجد وسجد لتأخيره فرض القعود. فإن سجد صار فرضه نفلا وضم سادسة - إن شاء - ... وإن قعد الأخير ثم قام عاد وسلم من غير إعادة التشهد. فإن سجد لم يبطل فرضه وضم إليها أخرى لتصير الزائدتان له نافلة وسجد للسهو.' },
      hanbali: { when: 'avant', text: 'Un ajout volontaire (rak‘a ou pilier) annule la prière ; par oubli, on se prosterne. Si l’on s’en rend compte pendant la rak‘a ajoutée, s’asseoir aussitôt. Prosternation avant le salam.', source: UMD('p. 26', 26), also: [UMD('p. 27', 27)], textAr: 'أحدها: زيادة فعل من جنس الصلاة كركعة أو ركن فتبطل الصلاة بعمده ويسجد لسهوه وإن علم وهو في الركعة الزائدة جلس في الحال' },
    },
  },
  {
    id: 'first-tashahhud',
    q: 'J’ai oublié le premier tashahhud',
    by: {
      maliki: { when: 'avant', text: 'Revenir tant que les mains et les genoux n’ont pas quitté le sol ; s’ils l’ont quitté, continuer sans revenir et se prosterner avant le salam.', source: RIS('p. 39', 45), textAr: 'ومن قام من اثنتين رجع ما لم يفارق الأرض بيديه وركبتيه فإذا فارقها تمادى ولم يرجع وسجد قبل السلام' },
      shafii: { when: 'avant', text: 'Si l’on s’en souvient après s’être redressé debout, ne pas revenir (revenir sciemment annule la prière ; par oubli, non). Si c’est avant d’être debout, revenir ; prosternation si l’on était plus près de la station debout. Prosternation avant le salam (le premier tashahhud fait partie des ab‘ad).', source: MIN('p. 33-34', 35), also: [MIN('p. 34', 36)], textAr: 'ولو نسي التشهد الأول فذكره بعد ... انتصابه لم يعد له فإن عاد عالما بتحريمه بطلت أو ناسيا فلا ويسجد للسهو ... ولو تذكر قبل انتصابه عاد للتشهد ويسجد إن كان صار إلى القيام أقرب' },
      hanafi: { when: 'après', text: 'Revenir à la position assise tant qu’on n’est pas complètement debout. Si l’on revient en étant plus près de la station debout, prosternation de l’oubli ; plus près de l’assise, rien. Revenir après s’être redressé : avis divergents sur la validité.', source: NUR('p. 96', 120), textAr: 'ومن سها عن القعود الأول من الفرض عاد إليه ما لم يستو قائما في ظاهر الرواية وهو الأصح ... فإن عاد وهو إلى القيام أقرب سجد للسهو وإن كان إلى العقود أقرب لا سجود عليه في الأصح.', note: '« العقود » : sic dans Shamela, pour « القعود ».' },
      hanbali: { when: 'avant', text: 'Si l’on s’en souvient avant d’être complètement debout, revenir et le faire ; si l’on est debout, ne pas revenir. Prosternation avant le salam.', source: UMD('p. 26', 26), also: [UMD('p. 27', 27)], textAr: 'الضرب الثاني: النقص كنسيان واجب فإن قام عن التشهد الأول فذكر قبل أن يستتم قائما رجع فأتى به وإن استتم قائما لم يرجع' },
    },
  },
  {
    id: 'early-salam',
    q: 'J’ai fait le salam trop tôt (prière incomplète)',
    by: {
      maliki: { when: 'après', text: 'Si c’est proche, revenir avec un takbir d’entrée et accomplir ce qui manque ; si c’est loin ou qu’on est sorti de la mosquée, recommencer la prière. Prosternation après le salam (salam ajouté).', source: RIS('p. 38', 44), also: [MAY('p. 348', 342)], textAr: 'ومن انصرف من الصلاة ثم ذكر أنه بقي عليه شيء منها فليرجع إن كان بقرب ذلك فيكبر تكبيرة يحرم بها ثم يصلي ما بقي عليه وإن تباعد ذلك أو خرج من المسجد ابتدأ صلاته', note: 'La Risala ne précise pas ici le moment de la prosternation ; « après le salam » applique la règle de l’ajout (p. 37). À confirmer par le relecteur.' },
      shafii: { when: 'avant', text: 'Un pilier omis n’est pas remplacé par la prosternation : si l’on s’en souvient peu après, l’accomplir, poursuivre et se prosterner (avant le salam). Si le temps est long, recommencer.', source: SHU('p. 10-11', 9), also: [MIN('p. 34', 36)], textAr: 'والمتروك من الصلاة ثلاثة أشياء فرض وسنة وهيئة فالفرض لا ينوب عنه سجود السهو بل إن ذكره والزمان قريب ... أتى به وبنى عليه وسجد للسهو' },
      hanafi: { when: 'après', text: 'Celui qui croyait avoir terminé une prière de 4 ou 3 rak‘as, a fait le salam, puis apprend qu’il n’en a fait que deux : il la complète et fait la prosternation de l’oubli (après le salam).', source: NUR('p. 97', 121), textAr: 'توهم مصل رباعية أو ثلاثية أنه أتمها فسلم ثم علم أنه صلى ركعتين أتمها وسجد للسهو.' },
      hanbali: { when: 'après', text: 'Accomplir ce qui reste de la prière, puis se prosterner — après le salam, puis tashahhud et salam.', source: UMD('p. 26', 26), also: [UMD('p. 27', 27)], textAr: 'وإن سلم عن نقص في صلاته أتى بما بقي عليه منها ثم سجد ... إلا من سلم عن نقص في صلاته ... فإنه يسجد سجدتين بعد سلامه ثم يتشهد ويسلم' },
    },
  },
  {
    id: 'qunut',
    q: 'J’ai oublié le qunut du Subh',
    by: {
      maliki: { when: 'aucun', text: 'Pas de prosternation de l’oubli pour le qunut.', source: RIS('p. 38', 44), textAr: 'ومن سها عن تكبيرة أو عن سمع الله لمن حمده مرة أو القنوت فلا سجود عليه' },
      shafii: { when: 'avant', text: 'Le qunut du Subh fait partie des ab‘ad : son oubli entraîne la prosternation avant le salam. Si l’on s’en souvient une fois en prosternation, ne pas revenir.', source: MIN('p. 33', 35), also: [SHU('p. 9-11', 8), MIN('p. 34', 36)], textAr: 'أو بعضا وهو القنوت أو قيامه أو التشهد الأول أو قعوده ... سجد ... ولو نسي قنوتا فذكره في سجوده لم يعد له' },
    },
    gap: {
      hanafi: 'Non affiché : le qunut du Subh n’est pas une pratique hanafite (le qunut wajib est celui du witr, Nur al-Idah p. 54-55).',
      hanbali: 'Non affiché : le qunut du Subh n’est pas mentionné dans ‘Umdat al-Fiqh.',
    },
  },
  {
    id: 'pillar',
    q: 'J’ai oublié un pilier (ex. une prosternation, le ruku‘)',
    by: {
      maliki: { when: 'refaire', text: 'La prosternation de l’oubli ne remplace pas une rak‘a ni une prosternation : il faut rattraper le pilier ; si l’on a déjà fait le ruku‘ de la rak‘a suivante, annuler la rak‘a concernée et continuer.', source: RIS('p. 38', 44), also: [MAY('p. 348', 342)], textAr: 'ولا يجزىء سجود السهو لنقص ركعة ولا سجدة' },
      shafii: { when: 'refaire', text: 'Un pilier (rukn) doit être rattrapé ; la prosternation de l’oubli ne le remplace pas. Puis prosternation avant le salam.', source: MIN('p. 33', 35), also: [SHU('p. 10-11', 9)], textAr: 'فالأول: إن كان ركنا وجب تداركه وقد يشرع السجود لزيادة حصلت بتدارك ركن' },
      hanbali: { when: 'refaire', text: 'Si l’on s’en souvient avant de commencer la récitation de la rak‘a suivante, revenir faire le pilier et ce qui le suit ; sinon la rak‘a où il manque est annulée. Puis prosternation (avant le salam).', source: UMD('p. 26', 26), also: [UMD('p. 27', 27)], textAr: 'وإن نسي ركنا فذكره قبل شروعه في قراءة ركعة أخرى رجع فأتى به وبما بعده وإن ذكره بعد ذلك بطلت الركعة التي تركه منها' },
    },
    gap: { hanafi: 'Non affiché : le pilier oublié n’est pas traité explicitement dans le bāb sujūd as-sahw de Nūr al-Īḍāḥ.' },
  },
  {
    id: 'loud-quiet',
    q: 'J’ai récité à voix basse au lieu de haute (ou l’inverse)',
    by: {
      maliki: { when: 'avant', text: 'La voix haute et la voix basse à leur place sont des sunan confirmées : leur manque par oubli se répare avant le salam ; ajouter (voix haute au lieu de basse) relève de l’ajout, après le salam.', source: MAY('p. 339', 333), also: [MAY('p. 275', 269)], textAr: 'لِنقْضِ سُنَّةٍ سهوا يُسن قَبْلَ السَّلاَم سَجْدَتاَنِ أو سُنَنْ إنْ أكِّدَتْ ... جَهْرٌ وسِرٌ يِمَحَلٍّ لَهُما', note: 'Application de la règle générale du Murshid (sunna confirmée → avant ; ajout → après) ; le cas n’est pas détaillé mot à mot. À confirmer par le relecteur.' },
      shafii: { when: 'aucun', text: 'La voix haute/basse est une hay’a (sunna simple) : pas de prosternation de l’oubli.', source: SHU('p. 9-11', 8), textAr: 'وهيأتها خمسة عشر خصلة ... والجهر في موضعه والإسرار في موضعه ... والهيئة لا يعود إليها بعد تركها ولا يسجد للسهو عنها' },
      hanafi: { when: 'après', text: 'Pour l’imam, réciter à voix haute ou basse à sa place est wajib : son oubli entraîne la prosternation de l’oubli (après le salam). Celui qui prie seul a le choix dans les prières à voix haute ; son cas n’est pas détaillé davantage ici.', source: NUR('p. 54-55', 64), also: [NUR('p. 95', 119)], textAr: 'وجهر الإمام ... والإسرار ... والمنفرد مخير فيما يجهر ... يجب سجدتان بتشهد وتسليم لترك واجب سهوا' },
      hanbali: { when: 'aucun', text: 'La voix haute/basse n’est pas parmi les sept wajibat : c’est une sunna, dont l’oubli n’impose pas de prosternation.', source: src('umda', 'bāb arkān aṣ-ṣalāt wa wājibātihā', 'p. 26', 25), textAr: 'وما عدا هذا فسنن لا تبطل الصلاة بعمدها ولا يجب السجود لسهوها.', note: '‘Umda dit « pas de prosternation obligatoire » ; le caractère facultatif d’une prosternation pour une sunna n’y est pas détaillé.' },
    },
  },
  {
    id: 'takbir',
    q: 'J’ai oublié des takbirs de transition',
    by: {
      maliki: { when: 'avant', text: 'Un seul takbir (ou un seul « sami‘a Llahu li-man hamidah ») oublié : rien. Les takbirs sont des sunan ; deux takbirs oubliés comptent parmi les manques légers réparés avant le salam.', source: RIS('p. 38', 44), also: [RIS('p. 37-38', 43), MAY('p. 275', 269)], textAr: 'ومن سها عن تكبيرة أو عن سمع الله لمن حمده مرة أو القنوت فلا سجود عليه', note: 'La Risala mentionne « deux takbirs » parmi les manques légers (p. 37-38) ; la prosternation avant le salam pour deux takbirs applique la règle du manque. À confirmer.' },
      shafii: { when: 'aucun', text: 'Les takbirs de transition sont des hay’at : pas de prosternation de l’oubli.', source: SHU('p. 9-11', 8), textAr: 'والتكبيرات عند الرفع والخفض ... والهيئة لا يعود إليها بعد تركها ولا يسجد للسهو عنها' },
      hanafi: { when: 'aucun', text: 'Les takbirs de transition ne figurent pas parmi les 18 wajibat de Nūr al-Īḍāḥ (seuls les takbirs des deux ‘Id y sont) ; or la prosternation n’est due que pour un wajib omis.', source: NUR('p. 54-55', 64), also: [NUR('p. 95', 119)], textAr: 'وتكبيرات العيدين ... يجب سجدتان بتشهد وتسليم لترك واجب سهوا', note: 'Déduction à partir de la liste des wajibat ; à confirmer par le relecteur.' },
      hanbali: { when: 'avant', text: 'Les takbirs autres que celui d’ouverture sont wajib : omis par oubli, prosternation de l’oubli (avant le salam) ; omis volontairement, la prière est nulle.', source: src('umda', 'bāb arkān aṣ-ṣalāt wa wājibātihā', 'p. 26', 25), also: [UMD('p. 27', 27)], textAr: 'وواجباتها سبعة التكبير غير تكبيرة الإحرام ... فهذه إن تركها عمدا بطلت صلاته وإن تركها سهوا سجد لها' },
    },
  },
];

/**
 * Élément du tableau de référence. `sourceStatus: 'source_a_completer'` = affiché à la demande de l’utilisateur
 * mais sans source précise : badge visible, listé dans « Validation savante », jamais présenté comme sourcé.
 */
export type RefItem = { act: string; cat: string; id?: string; sourceStatus?: 'source_a_completer'; todo?: string };
export const REFERENCE: Record<Madhab, { cats: { name: string; rule: string }[]; items: RefItem[]; source: FiqhSource[] }> = {
  maliki: {
    cats: [
      { name: 'Fara’id (piliers)', rule: 'Obligatoires : la prosternation ne remplace ni une rak‘a ni une prosternation ; il faut les accomplir.' },
      { name: 'Sunan mu’akkada', rule: 'Sunnas confirmées : leur oubli entraîne une prosternation avant le salam.' },
      { name: 'Sans prosternation', rule: 'Pas de prosternation de l’oubli.' },
      { name: 'Fada’il (source à compléter)', rule: 'Classement et effet sur la prosternation non encore sourcés précisément : à confirmer par un relecteur.' },
    ],
    items: [
      { act: 'Takbir d’ouverture', cat: 'Fara’id (piliers)' },
      { act: 'Al-Fatiha', cat: 'Fara’id (piliers)' },
      { act: 'Ruku‘ et sujud', cat: 'Fara’id (piliers)' },
      { act: 'Position assise finale (le temps du salam)', cat: 'Fara’id (piliers)' },
      { act: 'Salam', cat: 'Fara’id (piliers)' },
      { act: 'Sourate après la Fatiha', cat: 'Sunan mu’akkada' },
      { act: 'Récitation à voix haute / basse à sa place', cat: 'Sunan mu’akkada' },
      { act: 'Les tashahhuds et la première position assise', cat: 'Sunan mu’akkada' },
      { act: 'Takbirs de transition (deux ou plus)', cat: 'Sunan mu’akkada' },
      { act: 'Qunut du Subh', cat: 'Sans prosternation' },
      { act: 'Un seul takbir ou un seul « sami‘a Llahu li-man hamidah »', cat: 'Sans prosternation' },
      {
        act: 'Lever les mains au takbir d’ouverture',
        cat: 'Fada’il (source à compléter)',
        id: 'lever-mains',
        sourceStatus: 'source_a_completer',
        todo: 'Citer le passage précis (ar-Risāla ou Mayyāra, chapitre et page) qui classe cet acte parmi les fada’il et précise qu’il n’entraîne pas de sujud as-sahw.',
      },
      {
        act: '« Rabbana wa laka-l-hamd »',
        cat: 'Fada’il (source à compléter)',
        id: 'rabbana-laka',
        sourceStatus: 'source_a_completer',
        todo: 'Citer le passage précis (ar-Risāla ou Mayyāra, chapitre et page) qui classe cette formule parmi les fada’il et précise qu’elle n’entraîne pas de sujud as-sahw.',
      },
    ],
    source: [MAY('p. 275 (sunan) et p. 339 (sahw)', 269), RIS('p. 38', 44), src('mayyara', 'Kitāb aṣ-ṣalāt — farā’iḍ aṣ-ṣalāt', 'p. 235-237', 229)],
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
      { act: 'Invocation d’ouverture (tawajjuh), isti‘adha', cat: 'Hay’at' },
      { act: 'Sourate après la Fatiha', cat: 'Hay’at' },
      { act: 'Takbirs de transition, tasbih du ruku‘ et du sujud', cat: 'Hay’at' },
      { act: 'Voix haute / basse', cat: 'Hay’at' },
    ],
    source: [MIN('p. 33', 35), SHU('p. 9-11', 8), src('minhaj', 'Kitāb aṣ-ṣalāt — bāb ṣifat aṣ-ṣalāt', 'p. 25', 25)],
  },
  hanafi: {
    cats: [
      { name: 'Fara’id / arkan', rule: 'Obligatoires : à accomplir (le cas du pilier oublié n’est pas détaillé dans la source citée).' },
      { name: 'Wajibat', rule: 'Leur oubli rend la prosternation de l’oubli wajib (après le salam) ; omis volontairement, la prière est à refaire.' },
      { name: 'Sunan', rule: 'La prosternation n’est due que pour un wajib : pas de prosternation pour une sunna.' },
    ],
    items: [
      { act: 'Station debout, récitation, ruku‘, sujud (et, selon un avis, la dernière assise le temps du tashahhud)', cat: 'Fara’id / arkan' },
      { act: 'Al-Fatiha, et une sourate (ou 3 versets) dans les deux premières rak‘as', cat: 'Wajibat' },
      { act: 'Première position assise et son tashahhud ; tashahhud final', cat: 'Wajibat' },
      { act: 'Sérénité (tuma’nina) dans les piliers', cat: 'Wajibat' },
      { act: 'Voix haute / basse de l’imam à sa place', cat: 'Wajibat' },
      { act: 'Qunut du witr ; takbirs des deux ‘Id ; le mot « as-salam »', cat: 'Wajibat' },
      { act: 'Ce qui n’est pas dans les 18 wajibat (ex. takbirs de transition)', cat: 'Sunan' },
    ],
    source: [NUR('p. 95', 119), src('nur', 'faṣl fī wājib aṣ-ṣalāt', 'p. 54-55', 64), src('nur', 'Kitāb aṣ-ṣalāt — bāb shurūṭ aṣ-ṣalāt wa arkānihā', 'p. 52', 60)],
  },
  hanbali: {
    cats: [
      { name: 'Arkan (piliers)', rule: 'À rattraper ; sinon la rak‘a concernée est annulée.' },
      { name: 'Wajibat', rule: 'Omis par oubli : prosternation ; omis volontairement : prière nulle.' },
      { name: 'Sunan', rule: 'Pas de prosternation obligatoire.' },
    ],
    items: [
      { act: 'Station debout, takbir d’ouverture, Fatiha, ruku‘, i‘tidal, sujud, assise entre les sujud, sérénité, dernier tashahhud et son assise, premier salam, ordre', cat: 'Arkan (piliers)' },
      { act: 'Takbirs autres que celui d’ouverture', cat: 'Wajibat' },
      { act: 'Tasbih du ruku‘ et du sujud (une fois)', cat: 'Wajibat' },
      { act: '« Sami‘a Llahu li-man hamidah » et « Rabbana wa laka-l-hamd »', cat: 'Wajibat' },
      { act: '« Rabbi ghfir li » entre les deux prosternations', cat: 'Wajibat' },
      { act: 'Premier tashahhud et son assise', cat: 'Wajibat' },
      { act: 'Prière sur le Prophète ﷺ dans le dernier tashahhud', cat: 'Wajibat' },
      { act: 'Tout le reste (ex. voix haute / basse)', cat: 'Sunan' },
    ],
    source: [src('umda', 'bāb arkān aṣ-ṣalāt wa wājibātihā', 'p. 26', 25), UMD('p. 26-27', 26)],
  },
};

export const SAHW_SOURCES =
  'Sources : al-Risāla d’Ibn Abī Zayd et le Murshid d’Ibn ‘Āshir (commentaire de Mayyāra) pour l’école malikite ; Matn Abī Shujā‘ et Minhāj aṭ-Ṭālibīn d’an-Nawawī pour l’école chaféite ; Nūr al-Īḍāḥ d’ash-Shurunbulālī pour l’école hanafite ; ‘Umdat al-Fiqh d’Ibn Qudāma pour l’école hanbalite. Chaque réponse cite sa page. Tout est « à valider » par une personne de savoir ; pour un cas particulier, demandez-lui.';

export const sahwUid = (caseId: string, m: Madhab) => `sahw:${caseId}:${m}`;
export function allSahwAnswers() {
  const out: { uid: string; caseId: string; q: string; school: Madhab; a: SahwAnswer }[] = [];
  for (const c of CASES) for (const m of SCHOOLS) if (c.by[m]) out.push({ uid: sahwUid(c.id, m), caseId: c.id, q: c.q, school: m, a: c.by[m]! });
  return out;
}

/** Éléments du tableau de référence encore sans source précise (affichés avec un badge, listés pour relecture). */
export function refItemsToComplete(): { uid: string; school: Madhab; item: RefItem }[] {
  const out: { uid: string; school: Madhab; item: RefItem }[] = [];
  for (const school of Object.keys(REFERENCE) as Madhab[])
    for (const item of REFERENCE[school].items)
      if (item.sourceStatus === 'source_a_completer') out.push({ uid: `sahw:ref:${school}:${item.id ?? item.act}`, school, item });
  return out;
}
