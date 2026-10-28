import { runHijriSelfTests } from '@/lib/hijri';
import { useData } from '@/lib/data';
import { approvedOnly } from '@/lib/content';
import { METHODS } from '@/lib/prayer';
import { useSettings } from '@/lib/settings';
import { Body, Card, H1, H2, Muted, Notice, Screen, Spacer } from '@/ui/kit';

export default function Sources() {
  const { s } = useSettings();
  const { content } = useData();
  const tests = runHijriSelfTests();
  const ok = tests.filter((x) => x.ok).length;
  return (
    <Screen>
      <H1>Sources & Méthodologie</H1>
      <H2>Horaires de prière</H2>
      <Card>
        <Body>Calcul astronomique local, sans réseau, avec la bibliothèque open-source « adhan » (Batoul Apps, licence MIT), algorithmes issus de « Astronomical Algorithms » (Jean Meeus).</Body>
        <Muted>Méthode active : {METHODS[s.method]}. Asr : {s.madhab === 'hanafi' ? 'ombre ×2 (Hanafi)' : 'ombre ×1 (majorité)'}. Règle hautes latitudes : recommandée par adhan selon la latitude.</Muted>
        <Muted>Les heures sont affichées dans le fuseau horaire de l’appareil.</Muted>
      </Card>
      <Spacer />
      <H2>Qibla</H2>
      <Card>
        <Body>Azimut du grand cercle vers la Kaaba (21,4225° N, 39,8262° E), depuis le nord géographique.</Body>
        <Muted>La boussole du téléphone peut être perturbée par des objets métalliques : calibrez-la et vérifiez l’angle.</Muted>
      </Card>
      <Spacer />
      <H2>Calendrier hégirien</H2>
      <Card>
        <Body>Calendrier tabulaire arithmétique (cycle de 30 ans, 11 années abondantes, époque civile du 16 juillet 622 julien). Source unique : src/lib/hijri.ts.</Body>
        <Muted>Peut différer de ±1–2 jours de l’observation du croissant ou du calendrier Umm al-Qura : ajustez dans Réglages (actuel : {s.hijriOffset >= 0 ? '+' : ''}{s.hijriOffset} j).</Muted>
        <Muted>Auto-tests (dates limites 29/30, années abondantes, passage d’année) : {ok}/{tests.length} réussis.</Muted>
      </Card>
      <Spacer />
      <H2>Coran</H2>
      <Card>
        <Body>Texte arabe embarqué pour la lecture et la recherche hors-ligne : Tanzil Quran Text (Simple, version 1.1), © 2007-2026 Tanzil Project, licence Creative Commons Attribution 3.0, reproduit sans modification. Source et mises à jour : tanzil.net.</Body>
        <Muted>Lecture en ligne et traductions (Muhammad Hamidullah, Bubenheim & Elyas, Saheeh International) : api.alquran.cloud. La traduction n’est pas incluse dans l’app : elle est téléchargée à votre demande puis conservée sur l’appareil.</Muted>
        <Muted>La recherche ignore les voyelles et signes (tashkīl), le tatwīl et les variantes de alif, hamza, yā’ et tā’ marbūṭa.</Muted>
      </Card>
      <Spacer />
      <H2>Textes et traductions</H2>
      <Card>
        <Body>Seuls les contenus au statut « approuvé » sont affichés ; chacun cite sa source. Les textes arabes conservent leurs diacritiques. Aucune traduction religieuse n’est générée par l’app.</Body>
        {approvedOnly(content).map((c) => (
          <Muted key={c.id}>
            • {c.transliteration ?? c.arabic} — {c.source}
          </Muted>
        ))}
        <Muted>Traductions approuvées : aucune pour le moment (liste à fournir).</Muted>
      </Card>
      <Spacer />
      <Notice tone="warning" title="Limites et responsabilité" text="Zikru est un outil d’aide. Les horaires et la date hégirienne sont des calculs ; en cas de doute, référez-vous à votre mosquée ou à une autorité religieuse locale. Les contenus marqués « Exemple » doivent être validés par un référent avant publication." />
    </Screen>
  );
}
