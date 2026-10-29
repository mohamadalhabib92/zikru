import { useState } from 'react';
import { Share, View } from 'react-native';
import { Text } from '@/ui/Text';
import { uid, usePersistentState } from '@/lib/storage';
import { Badge, Button, Card, Field, H2, IconButton, Muted, Notice, Row, Spacer } from '@/ui/kit';
import { theme as t } from '@/ui/theme';
import { L } from '@/lib/l10n';

type Entry = { by: string; n: number; at: number };
type Group = { id: string; name: string; formula: string; goal: number; entries: Entry[]; createdAt: number };

const SEED: Group[] = [{ id: 'g-allahu-akbar', name: 'Zikr Allah Akbar', formula: 'Allāhu akbar', goal: 10000, entries: [], createdAt: 0 }];

/** Groupes locaux (hors-ligne, sans compte) : repli quand on n'est pas connecté. */
export function LocalGroups() {
  const [groups, setGroups] = usePersistentState<Group[]>('community-groups', SEED);
  const [open, setOpen] = useState<string | null>(groups[0]?.id ?? null);
  const [who, setWho] = usePersistentState('community-name', '');
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);
  const [gName, setGName] = useState('');
  const [gFormula, setGFormula] = useState('');
  const [gGoal, setGGoal] = useState('1000');

  const total = (g: Group) => g.entries.reduce((a, e) => a + e.n, 0);
  const contribute = (g: Group, n: number) => {
    if (!(n > 0)) return;
    setGroups(groups.map((x) => (x.id === g.id ? { ...x, entries: [{ by: who.trim() || 'Moi', n, at: Date.now() }, ...x.entries].slice(0, 500) } : x)));
  };
  const create = () => {
    const goal = parseInt(gGoal, 10);
    if (!gName.trim() || !(goal > 0)) return;
    const g: Group = { id: uid('g-'), name: gName.trim(), formula: gFormula.trim(), goal, entries: [], createdAt: Date.now() };
    setGroups([...groups, g]);
    setOpen(g.id);
    setAdding(false);
    setGName('');
    setGFormula('');
  };

  return (
    <View>
      <Notice
        tone="info"
        icon="phone-portrait-outline"
        title="Local uniquement"
        text="Les groupes et compteurs sont enregistrés sur cet appareil. Rien n’est envoyé en ligne : saisissez les contributions de votre cercle (ex. après une séance de dhikr) et partagez l’avancée par message."
      />
      <Field label="Votre nom (pour l’historique)" placeholder={L("Moi")} value={who} onChangeText={setWho} />
      {groups.map((g) => {
        const n = total(g);
        const pct = Math.min(1, n / g.goal);
        const isOpen = open === g.id;
        const people = Array.from(new Set(g.entries.map((e) => e.by)));
        return (
          <Card key={g.id} onPress={isOpen ? undefined : () => setOpen(g.id)} style={isOpen ? { borderColor: t.primary } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <H2>{g.name}</H2>
                {g.formula ? <Muted>{g.formula}</Muted> : null}
              </View>
              {pct >= 1 ? <Badge label="Objectif atteint" tone="success" /> : <Badge label={`${Math.round(pct * 100)} %`} tone="info" />}
            </Row>
            <View style={{ height: 10, backgroundColor: t.surfaceAlt, borderRadius: 5, marginTop: 10 }}>
              <View style={{ width: `${pct * 100}%`, height: 10, backgroundColor: pct >= 1 ? t.success : t.primary, borderRadius: 5 }} />
            </View>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 8 }}>
              {n.toLocaleString('fr-CH')} <Text style={{ color: t.muted, fontSize: 14, fontWeight: '400' }}>/ {g.goal.toLocaleString('fr-CH')}</Text>
            </Text>
            {isOpen ? (
              <View style={{ marginTop: 10 }}>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {[1, 33, 100, 1000].map((v) => (
                    <Button key={v} small title={`+${v}`} variant="secondary" onPress={() => contribute(g, v)} />
                  ))}
                </Row>
                <Spacer h={8} />
                <Row gap={8}>
                  <View style={{ flex: 1 }}>
                    <Field label="Autre nombre" keyboardType="number-pad" value={custom} onChangeText={setCustom} />
                  </View>
                  <Button
                    small
                    title="Ajouter"
                    onPress={() => {
                      contribute(g, parseInt(custom, 10));
                      setCustom('');
                    }}
                  />
                </Row>
                <Muted>{people.length ? L('Contributions saisies : {p}', { p: people.join(', ') }) : 'Aucune contribution pour l’instant.'}</Muted>
                {g.entries.slice(0, 5).map((e, i) => (
                  <Muted key={i} style={{ fontSize: 12 }}>
                    {new Date(e.at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })} · {e.by} +{e.n}
                  </Muted>
                ))}
                <Spacer h={8} />
                <Row gap={8}>
                  <Button small icon="share-outline" title="Partager l’avancée" variant="secondary" onPress={() => void Share.share({ message: `${g.name} : ${n.toLocaleString('fr-CH')} / ${g.goal.toLocaleString('fr-CH')}${g.formula ? ` (${g.formula})` : ''} — Zikru` }).catch(() => {})} />
                  {g.entries.length ? (
                    <IconButton icon="arrow-undo-outline" color={t.muted} label="Annuler la dernière contribution" onPress={() => setGroups(groups.map((x) => (x.id === g.id ? { ...x, entries: x.entries.slice(1) } : x)))} />
                  ) : null}
                  <IconButton icon="trash-outline" color={t.muted} label={L('Supprimer {x}', { x: g.name })} onPress={() => setGroups(groups.filter((x) => x.id !== g.id))} />
                </Row>
              </View>
            ) : null}
          </Card>
        );
      })}
      <Spacer />
      {adding ? (
        <Card>
          <H2>Nouveau groupe</H2>
          <Field label="Nom" placeholder={L("Cercle du jeudi")} value={gName} onChangeText={setGName} />
          <Field label="Formule (facultatif)" placeholder={L("Lā ilāha illā-llāh")} value={gFormula} onChangeText={setGFormula} />
          <Field label="Objectif" keyboardType="number-pad" value={gGoal} onChangeText={setGGoal} />
          <Button title="Créer" icon="add" onPress={create} />
        </Card>
      ) : (
        <Button title="Créer un groupe" icon="people-outline" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}
