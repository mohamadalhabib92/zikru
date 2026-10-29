import { KnowledgeList } from '@/components/zikru/KnowledgeList';
import { HADITHS } from '@/lib/knowledge';

export default function Hadiths() {
  return (
    <KnowledgeList
      items={HADITHS}
      set="hadiths"
      title="Hadiths"
      ar="الأحاديث النبوية"
      sub="Collection choisie · références vérifiables"
      color="#7C4DDB"
      icon="library"
      note="Hadiths très connus, référencés selon la numérotation de sunnah.com. Le badge de chaque carte reprend le jugement publié (sunnah.com / dorar.net) avec le nom du savant ; si les jugements divergent, c’est signalé. Contenu à valider par une personne de savoir. Traductions françaises indicatives (sens), rédigées pour l’app."
    />
  );
}
