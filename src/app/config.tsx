import { SUPABASE_ANON_KEY, SUPABASE_URL, backendConfigured } from '@/lib/backend';
import { useSettings } from '@/lib/settings';
import { Badge, Body, Card, H1, ListItem, Muted, Notice, Screen, Spacer } from '@/ui/kit';

/** Écran « Configuration manquante » : explicite, jamais de crash silencieux. */
export default function Config() {
  const { t: tr } = useSettings();
  return (
    <Screen>
      <H1>{backendConfigured ? 'Synchronisation' : tr.config_missing}</H1>
      <Notice
        tone={backendConfigured ? 'success' : 'warning'}
        title={backendConfigured ? 'Supabase configuré' : 'Supabase non configuré — mode local'}
        text="Prières, qibla, tasbih et contenu approuvé fonctionnent entièrement hors-ligne, sans compte ni API payante. La synchronisation est optionnelle."
      />
      <Spacer />
      <Card>
        {[SUPABASE_URL, SUPABASE_ANON_KEY].map((v) => (
          <ListItem key={v.name} title={v.name} subtitle={v.configured ? 'défini' : 'valeur YOUR_* à remplacer'} right={<Badge label={v.configured ? 'OK' : 'Manquant'} tone={v.configured ? 'success' : 'warning'} />} />
        ))}
      </Card>
      <Spacer />
      <Body>Pour activer :</Body>
      <Muted>1. Copier .env.example vers .env et renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.</Muted>
      <Muted>2. Exécuter supabase/schema.sql dans le projet Supabase (tables + RLS).</Muted>
      <Muted>3. Relancer l’app (npx expo start) ou reconstruire la PWA.</Muted>
    </Screen>
  );
}
