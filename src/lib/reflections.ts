/**
 * Réflexions du jour « Un mot d'El Ghaly Bilal » — textes originaux rédigés pour Zikru
 * (aucune citation attribuée). Utilisés hors-ligne et quand l'IA n'est pas configurée.
 */
export type Period = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export const PERIODS: Record<Period, { title: string; icon: string }> = {
  dawn: { title: '🌅 Lumière de l’aube', icon: 'partly-sunny-outline' },
  morning: { title: '☀️ Élan du matin', icon: 'sunny-outline' },
  afternoon: { title: '🌤️ Pause de l’après-midi', icon: 'hourglass-outline' },
  evening: { title: '🌙 Quiétude du soir', icon: 'moon-outline' },
  night: { title: '✨ Silence de la nuit', icon: 'star-outline' },
};
export function periodFor(d = new Date()): Period {
  const h = d.getHours();
  if (h >= 4 && h < 7) return 'dawn';
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}
export const REFLECTIONS: Record<Period, string[]> = {
  dawn: [
    'As-salamu alaykum 🌅 Le jour n’a pas encore commencé que tu es déjà là, debout devant ton Seigneur. Ce petit effort, personne ne le voit — et c’est justement pour cela qu’il est précieux. Commence doucement : un istighfar, une prière sur le Prophète ﷺ, et confie-Lui ta journée.',
    'Chaque aube est une page blanche. Ne la remplis pas tout de suite d’inquiétudes : écris d’abord « Bismillah ». Le reste suivra, avec Sa permission.',
    'La fraîcheur du matin est une miséricorde. Respire, souris, et dis « al-ḥamdu li-llāh » pour ce nouveau souffle qui t’est offert. Tu n’as pas à tout réussir aujourd’hui : seulement à commencer avec sincérité.',
  ],
  morning: [
    'As-salamu alaykum ☀️ Ton travail aussi peut devenir adoration : une intention juste transforme les gestes ordinaires en lumière. Avant ta prochaine tâche, murmure « Bismillah » et fais-la pour Lui.',
    'Le matin passe vite. Glisse un dhikr entre deux messages, une salawat en marchant. Ce sont de petites graines ; Allah les fait grandir.',
    'Si quelque chose te pèse ce matin, n’attends pas d’avoir tout résolu pour te tourner vers Allah. Dis-Lui simplement : « Ô Allah, facilite. » C’est déjà une victoire.',
  ],
  afternoon: [
    'As-salamu alaykum 🌤️ Au milieu de la journée, la prière vient te rappeler que le temps ne t’appartient pas : il t’est confié. Pose ce que tu fais quelques minutes — ton cœur te remerciera.',
    'Quand l’ombre s’allonge, fais un petit bilan, sans te juger durement : qu’as-tu fait de bien ? Remercie. Qu’as-tu manqué ? Demande pardon, et continue.',
    'La fatigue de l’après-midi est normale. Un verre d’eau, quelques respirations, et un « lā ḥawla wa lā quwwata illā bi-llāh » : la force vient de Lui.',
  ],
  evening: [
    'As-salamu alaykum 🌟 Cette journée t’a peut-être semblé ordinaire, mais regarde de plus près : tu as respiré, avancé, peut-être souri ou aidé quelqu’un. Ce sont des trésors. Glisse un istighfar tranquille avant de t’endormir, sans culpabilité, juste pour purifier ton cœur. Fais confiance : ce qui vient est meilleur, inch’Allah. 🤲',
    'Le soleil se couche sans bruit. Remercie pour ce qui a été donné, pardonne ce qui t’a blessé, et confie demain à ton Seigneur. Ton cœur n’a pas besoin de porter seul tout ce poids.',
    'Ce soir, offre-toi un moment de wird en paix. Peu importe le nombre : c’est la présence du cœur qui compte. Allah aime les actes réguliers, même petits.',
  ],
  night: [
    'As-salamu alaykum ✨ Le monde dort, la porte reste ouverte. Quelques mots sincères dans le silence valent plus qu’un long discours distrait. Parle-Lui comme à Celui qui t’entend toujours.',
    'Avant de dormir, rends ton âme légère : un peu de salawat sur le Prophète ﷺ, et un cœur sans rancune. Demain est entre de bonnes mains.',
    'Si le sommeil tarde, ne lutte pas : fais du dhikr doucement, allongé. « Subḥāna-llāh, al-ḥamdu li-llāh, Allāhu akbar. » Laisse ces mots te bercer.',
  ],
};
