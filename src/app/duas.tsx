import { KnowledgeList } from '@/components/zikru/KnowledgeList';
import { DUAS } from '@/lib/knowledge';

export default function Duas() {
  return (
    <KnowledgeList
      items={DUAS}
      title="Du‘as"
      ar="الأدعية المأثورة"
      sub="Invocations prophétiques du quotidien"
      color="#2F7FD0"
      icon="hand-left"
      note="Invocations tirées du Coran et des recueils de hadiths (références indiquées). Traductions indicatives."
    />
  );
}
