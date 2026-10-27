import { Body, Card, H1, H2, Muted, Screen, Spacer } from '@/ui/kit';

/** Résumé de l'audit Phase 0 (détail complet : docs/AUDIT.md). */
const ITEMS: [string, string][] = [
  ['Source', 'Code Vibecode d’origine indisponible : reconstruction complète. L’audit porte sur la spec et sur cette base.'],
  ['Hijri', 'Risque initial : plusieurs conversions (Intl, librairies). Correctif : une seule source (src/lib/hijri.ts) + 11 auto-tests (npm test).'],
  ['Cibles tactiles', 'Tous les boutons, puces et icônes : ≥ 44×44 pt (kit UI), retour visuel, états disabled/loading.'],
  ['Appels payants (402)', 'Aucun appel réseau sur le chemin core. Prières/qibla calculés localement ; Supabase optionnel.'],
  ['Persistance', 'Tasbih écrit à chaque appui (AsyncStorage / localStorage). MMKV non utilisé (build natif requis, incompatible PWA).'],
  ['Audio Bilal', 'Fichier non fourni : lecteur désactivé proprement, aucune exception.'],
  ['BLE', 'RingService abstrait + mock badgé « Simulation ». Aucune fausse connexion.'],
  ['Langues', '7 langues branchées ; Pulaar et Wolof : repli FR avec mention « en attente de validation ».'],
  ['Notifications', 'Non implémentées dans cette passe (à ajouter avec expo-notifications).'],
  ['Dead code', 'Aucun écran orphelin ; aucun flag de démo hors contenu d’exemple étiqueté.'],
];

export default function Audit() {
  return (
    <Screen>
      <H1>Audit — Phase 0</H1>
      <Muted>Problèmes → correctifs appliqués</Muted>
      <Spacer />
      {ITEMS.map(([k, v]) => (
        <Card key={k} style={{ marginBottom: 10 }}>
          <H2>{k}</H2>
          <Body>{v}</Body>
        </Card>
      ))}
    </Screen>
  );
}
