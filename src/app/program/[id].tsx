import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { confirmAsk, ErrorNote, ProgressBar, useLoad } from '@/components/community/parts';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { bleCounter } from '@/lib/ble/manager';
import { feedback } from '@/lib/feedback';
import { currentStep, mergeCounts, programDone, tapStep } from '@/lib/program-group';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Badge, Button, Card, Eyebrow, H1, H2, Muted, Row, Screen, Spacer } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

const SYNC_MS = 1500;
const POLL_MS = 30000;
const cacheKey = (id: string, v: number) => 'community/program-progress/' + id + '/v' + String(v);
type Cache = { counts: Record<string, number>; dirty: string[] };

const VERIF: Record<api.ProgramVerification, { label: string; tone: 'neutral' | 'warning' | 'info' }> = {
  quran: { label: 'Passage du Coran reconnu par l’app', tone: 'info' },
  catalogue: { label: 'Formule du catalogue Zikru', tone: 'info' },
  unverified: { label: 'Texte non vérifié (lu sur un document)', tone: 'warning' },
};

/**
 * Tasbih de groupe : les étapes du programme s’enchaînent (passage automatique à la suivante), l’avancée
 * personnelle est enregistrée sur le serveur (valeur bornée au nombre de l’étape) et celle des autres membres
 * s’affiche selon leurs préférences de partage. Hors ligne : les appuis sont gardés sur l’appareil et envoyés ensuite.
 */
export default function GroupProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = String(id);
  const { userId } = useAuth();
  const view = useLoad(() => api.groupProgramView(pid), [pid]);
  const reload = view.reload;
  const v = view.data;
  const steps = useMemo(() => v?.steps ?? [], [v]);
  const chain = useMemo(() => steps.map((s) => ({ id: s.id, target: s.target })), [steps]);
  const server = useMemo(() => Object.fromEntries(steps.map((s) => [s.id, s.mine ?? 0])), [steps]);

  const [local, setLocal] = useState<Cache>({ counts: {}, dirty: [] });
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = v ? cacheKey(v.id, v.version) : null;

  // Appuis non envoyés gardés sur l’appareil (par version : une nouvelle version repart de zéro, comme le serveur).
  useEffect(() => {
    if (!key) return;
    let live = true;
    void loadJSON<Cache>(key, { counts: {}, dirty: [] }).then((c) => {
      if (!live) return;
      setLocal({ counts: c.counts ?? {}, dirty: (c.dirty ?? []).filter((d) => chain.some((s) => s.id === d)) });
      setLoadedKey(key);
    });
    return () => {
      live = false;
    };
  }, [key, chain]);

  const counts = useMemo(() => mergeCounts(server, local.counts, local.dirty), [server, local]);
  const cur = sel ?? currentStep(chain, counts);
  const step = steps[cur];
  const done = programDone(chain, counts);
  const active = v?.status === 'active';

  const flush = useCallback(async () => {
    const c = localRef.current;
    if (!c.dirty.length) return;
    const sent: string[] = [];
    try {
      for (const sid of c.dirty) {
        await api.setProgramProgress(sid, c.counts[sid] ?? 0);
        sent.push(sid);
      }
      setSyncErr(null);
    } catch (e) {
      setSyncErr(api.frError(e));
    }
    if (sent.length) {
      setLocal((p) => {
        // Un appui arrivé pendant l’envoi garde l’étape « à envoyer ».
        const dirty = p.dirty.filter((d) => !sent.includes(d) || p.counts[d] !== c.counts[d]);
        return { ...p, dirty };
      });
      if (sent.length === c.dirty.length) void reload();
    }
  }, [reload]);

  // Sauvegarde locale + envoi groupé (anti-rebond) après les appuis.
  useEffect(() => {
    if (!key || loadedKey !== key) return;
    void saveJSON(key, local);
    if (!local.dirty.length) return;
    const h = setTimeout(() => void flush(), SYNC_MS);
    return () => clearTimeout(h);
  }, [local, key, loadedKey, flush]);

  // Avancée des autres membres : actualisée régulièrement (pas de temps réel).
  useEffect(() => {
    const h = setInterval(() => {
      if (!localRef.current.dirty.length) void reload();
    }, POLL_MS);
    return () => clearInterval(h);
  }, [reload]);
  useEffect(() => () => void flush(), [flush]);

  const tap = (delta: 1 | -1) => {
    if (!active || !step || loadedKey !== key) return;
    const r = tapStep(chain, counts, cur, delta);
    if (r.counts[step.id] === counts[step.id]) return;
    const p = bleCounter.state.prefs;
    feedback(r.completed ? 'cycle' : 'tap', { sound: p.sound, haptics: p.haptics });
    setLocal((x) => ({ counts: { ...x.counts, [step.id]: r.counts[step.id] }, dirty: x.dirty.includes(step.id) ? x.dirty : [...x.dirty, step.id] }));
    if (r.completed) setSel(null);
  };

  const archive = () =>
    v &&
    confirmAsk('Archiver ce programme ?', 'Il ne sera plus proposé aux membres. Les avancées ne pourront plus être modifiées.', 'Archiver', () => {
      setBusy(true);
      void api
        .setGroupProgramStatus(v.id, 'archived')
        .then(() => router.back())
        .catch((e) => setSyncErr(api.frError(e)))
        .finally(() => setBusy(false));
    });

  if (!v) {
    return (
      <Screen>
        <Stack.Screen options={{ title: L('Programme de groupe') }} />
        <ErrorNote error={view.error} onRetry={view.reload} />
        {view.loading ? <Muted>Chargement…</Muted> : null}
      </Screen>
    );
  }

  const mine = step ? (counts[step.id] ?? 0) : 0;
  return (
    <Screen>
      <Stack.Screen options={{ title: v.title }} />
      <Eyebrow>{L(v.scope_type === 'family' ? 'Programme de la famille' : 'Programme du cercle')}</Eyebrow>
      <H1>{v.title}</H1>
      {v.description ? <Muted>{v.description}</Muted> : null}
      <Muted>{L('{n} étape(s) · version {v}', { n: steps.length, v: v.version })}</Muted>
      {!active ? <Badge label="Programme archivé" tone="warning" /> : null}
      <ErrorNote error={view.error} onRetry={view.reload} />
      <Spacer />

      {step ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>{L('Étape {i} / {n}', { i: cur + 1, n: steps.length })}</Text>
            <Badge label={VERIF[step.verification]?.label ?? VERIF.unverified.label} tone={VERIF[step.verification]?.tone ?? 'warning'} />
          </Row>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{step.label}</Text>
          {step.arabic ? <Arabic size={24}>{step.arabic}</Arabic> : null}
          {step.translit ? <Muted style={{ fontStyle: 'italic' }}>{step.translit}</Muted> : null}
          {step.translation ? <Muted>{step.translation}</Muted> : null}
          {step.source_ref ? <Muted style={{ fontSize: 12 }}>{L('Source : {s}', { s: step.source_ref })}</Muted> : null}
          <Spacer h={8} />
          <Pressable
            onPress={() => tap(1)}
            disabled={!active}
            accessibilityRole="button"
            accessibilityLabel={L('Compter (+1)')}
            accessibilityHint={L('{n} sur {max}', { n: mine, max: step.target })}
            style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 36, borderRadius: 20, backgroundColor: active ? t.primary : t.surfaceAlt }}
          >
            <Text style={{ color: active ? t.onPrimary : t.text, fontSize: 44, fontWeight: '800' }}>{`${mine} / ${step.target}`}</Text>
            <Text style={{ color: active ? t.onPrimary : t.text }}>{mine >= step.target ? L('Étape terminée') : L('Touchez pour compter')}</Text>
          </Pressable>
          <ProgressBar value={mine} target={step.target} />
          <Row wrap gap={8} style={{ marginTop: 6 }}>
            <Button small variant="ghost" icon="arrow-undo-outline" title="Annuler 1" disabled={!active || mine <= 0} onPress={() => tap(-1)} />
            <Button small variant="ghost" icon="chevron-back" title="Étape précédente" disabled={cur <= 0} onPress={() => setSel(cur - 1)} />
            <Button small variant="ghost" icon="chevron-forward" title="Étape suivante" disabled={cur >= steps.length - 1} onPress={() => setSel(cur + 1)} />
          </Row>
          {done ? <Text style={{ color: t.success, fontWeight: '700' }}>Programme terminé.</Text> : null}
          {local.dirty.length ? <Muted style={{ fontSize: 12 }}>{syncErr ? L('Pas encore envoyé : {e}', { e: syncErr }) : L('Envoi…')}</Muted> : syncErr ? <Muted style={{ fontSize: 12, color: t.danger }}>{syncErr}</Muted> : null}
        </Card>
      ) : (
        <Muted>Ce programme n’a pas d’étape.</Muted>
      )}
      <Spacer />

      <H2>Étapes</H2>
      {steps.map((s, i) => (
        <Card key={s.id} onPress={() => setSel(i)} accessibilityLabel={L('Aller à l’étape {i}', { i: i + 1 })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontWeight: i === cur ? '800' : '600', flex: 1 }}>{`${i + 1}. ${s.label}`}</Text>
            <Text style={{ color: t.text }}>{`${counts[s.id] ?? 0} / ${s.target}`}</Text>
          </Row>
          <Muted style={{ fontSize: 12 }}>{L('Groupe : {total} au total · {n} membre(s) ont terminé', { total: s.total, n: s.done_by })}</Muted>
        </Card>
      ))}
      <Spacer />

      <H2>Avancée des membres</H2>
      <Muted style={{ fontSize: 12 }}>Chacun choisit ce qu’il partage (rien, participation ou compteur) dans les préférences de partage du groupe.</Muted>
      {v.members.map((m) => (
        <Card key={m.user_id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>
              {m.name}
              {m.me ? ' (moi)' : ''}
            </Text>
            {m.steps_done != null ? (
              <Text style={{ color: t.text }}>{L('{d} / {n} étape(s)', { d: m.steps_done, n: steps.length })}</Text>
            ) : (
              <Badge label={m.participated ? 'A participé' : 'Pas encore commencé'} tone={m.participated ? 'success' : 'neutral'} />
            )}
          </Row>
        </Card>
      ))}
      <Spacer />
      {v.can_admin && active ? <Button variant="ghost" icon="archive-outline" title="Archiver ce programme" loading={busy} onPress={archive} /> : null}
      {userId ? null : <Muted>Connectez-vous pour compter avec le groupe.</Muted>}
    </Screen>
  );
}
