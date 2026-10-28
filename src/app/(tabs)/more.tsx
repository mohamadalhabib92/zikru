import { Hub, type HubSection } from '@/components/Hub';
import { useSettings } from '@/lib/settings';
import { brand as b } from '@/ui/theme';

/** Onglet « Plus » : outils, parcours, communauté, réglages. */
export default function More() {
  const { t: tr } = useSettings();
  const sections: HubSection[] = [
    {
      title: tr.tools,
      items: [
        { icon: 'compass', title: tr.qibla_title, sub: 'Boussole et distance à la Ka‘ba', href: '/qibla', color: b.teal },
        { icon: 'bluetooth', title: tr.ring, sub: 'Bague / compteur connecté', href: '/ring', color: b.blue },
        { icon: 'calculator', title: 'Abjad', sub: 'Mashriqi & Maghribi', href: '/abjad', color: b.goldDeep },
      ],
    },
    {
      title: tr.spiritual_path,
      items: [
        { icon: 'leaf', title: 'Tariqa Tijaniyya', sub: 'Wird, wazifa, haylala', href: '/tijani', color: b.green },
        { icon: 'trending-up', title: 'Mon parcours', sub: 'Niveaux, séries, statistiques', href: '/journey', color: b.wirdGreen },
        { icon: 'checkmark-done', title: 'Habitudes', sub: 'Suivi quotidien', href: '/habits', color: b.teal },
        { icon: 'calendar', title: 'Planificateur', sub: 'Tâches du jour', href: '/planner', color: b.indigo },
        { icon: 'chatbubbles', title: 'Bilal', sub: 'Compagnon de réflexion', href: '/bilal', color: b.purple },
      ],
    },
    {
      title: tr.community,
      items: [{ icon: 'people', title: tr.community, sub: 'Cercles, familles, dhikr en direct', href: '/community', color: b.violet }],
    },
    {
      title: tr.about,
      items: [
        { icon: 'settings', title: tr.settings_title, sub: `${tr.appearance} · ${tr.language} · méthode`, href: '/settings', color: b.inkMuted },
        { icon: 'library', title: tr.sources_title, sub: 'Références et méthodologie', href: '/sources', color: b.inkMuted },
      ],
    },
  ];
  return <Hub title={tr.tab_more} eyebrow="Zikru" sections={sections} />;
}
