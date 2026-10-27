import { KnowledgeList } from '@/components/zikru/KnowledgeList';
import { HADITHS } from '@/lib/knowledge';

export default function Hadiths() {
  return (
    <KnowledgeList
      items={HADITHS}
      title="Hadiths"
      ar="الأحاديث النبوية"
      sub="Collection choisie · références vérifiables"
      color="#7C4DDB"
      icon="library"
      note="Hadiths très connus et authentiques, référencés selon la numérotation usuelle (sunnah.com). Traductions françaises indicatives (sens), rédigées pour l’app."
    />
  );
}
