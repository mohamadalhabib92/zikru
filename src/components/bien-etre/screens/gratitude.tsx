import { useMemo, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { announce, BEScreen, Choice, Panel, softHaptic, useReduceMotion } from '@/components/bien-etre/common';
import { Badge, Button, Field, Ionicons, Toggle } from '@/ui/kit';
import { Arabic } from '@/ui/light';
import { arLang } from '@/ui/ar-lang';
import { FadeIn } from '@/ui/ds';
import { alpha, brand as b } from '@/ui/theme';
import { usePersistentState } from '@/lib/storage';
import { useSettings } from '@/lib/settings';
import { approvedOnly, SEED_CONTENT } from '@/lib/content';
import { DEFAULT_NOTIF } from '@/lib/notify-plan';
import { L, useUiLang } from '@/lib/l10n';
import {
  addBlessing,
  blessingsOf,
  CHIPS,
  closeDay,
  dayKey,
  deleteDay,
  EMPTY_JOURNAL,
  GRATITUDE_KEY,
  GRATITUDE_TIMES,
  hasChip,
  isClosed,
  MAX_PER_DAY,
  MAX_TEXT,
  normalizeJournal,
  notedDays,
  removeBlessing,
  reopenDay,
  summary,
  toggleChip,
  type Blessing,
  type Journal,
} from '@/lib/gratitude';

const chipLabel = (k?: string) => CHIPS.find((c) => c.id === k)?.label;

/** Ligne d’un bienfait : pastille traduite + texte libre de l’utilisateur (jamais traduit). */
function BlessingLine({ x, n, onRemove }: { x: Blessing; n: number; onRemove?: () => void }) {
  const lbl = chipLabel(x.k);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(b.goldDeep, 0.16) }}>
        <RNText style={{ color: b.ink, fontWeight: '900', fontSize: 13 }}>{n}</RNText>
      </View>
      <View style={{ flex: 1 }}>
        {lbl ? <Text style={{ color: b.ink, fontWeight: '800' }}>{lbl}</Text> : null}
        {x.t ? <RNText style={{ color: lbl ? b.inkMuted : b.ink, fontWeight: lbl ? '400' : '700', lineHeight: 20 }}>{x.t}</RNText> : null}
      </View>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L('Retirer le bienfait {n}', { n })}
          hitSlop={6}
          onPress={onRemove}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="close" size={20} color={b.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Formule de clôture, prise telle quelle dans le catalogue sourcé (content.ts) ; sinon « Source à compléter ». */
function Hamd() {
  const d = approvedOnly(SEED_CONTENT).find((x) => x.id === 'alhamdulillah');
  if (!d || !d.source) return <Badge tone="warning" label="Source à compléter" />;
  return (
    <View style={{ gap: 6, alignItems: 'center' }}>
      <Arabic size={34} style={{ lineHeight: 64, textAlign: 'center' }}>
        <Text {...arLang}>{d.arabic}</Text>
      </Arabic>
      {d.transliteration ? <RNText style={{ color: b.inkMuted, fontStyle: 'italic' }}>{d.transliteration}</RNText> : null}
      <Text style={{ color: b.inkMuted, fontSize: 12, textAlign: 'center' }}>{L('Source : {r}', { r: d.source })}</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {d.seedExample ? <Badge tone="info" label="Exemple · à valider" /> : null}
        <Badge tone="warning" label="Référence pour ce contexte à compléter" />
      </View>
    </View>
  );
}

function Closing({ reduce, onReopen }: { reduce: boolean; onReopen: () => void }) {
  const body = (
    <>
      <Hamd />
      <Button title="Rouvrir ce soir" icon="create-outline" small variant="ghost" onPress={onReopen} />
    </>
  );
  const st = { gap: 10, paddingVertical: 6 };
  return reduce ? <View style={st}>{body}</View> : <FadeIn style={st}>{body}</FadeIn>;
}

/** Journal de gratitude (shukr) : jusqu’à 3 bienfaits par soir, privé, sans série ni score. */
export default function Gratitude() {
  const router = useRouter();
  const lang = useUiLang();
  const reduce = useReduceMotion();
  const loc = lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-CH' : 'fr-CH';
  const fmt = (k: string) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), 12).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const [raw, setRaw] = usePersistentState<Journal>(GRATITUDE_KEY, EMPTY_JOURNAL);
  const j = useMemo(() => normalizeJournal(raw), [raw]);
  const set = (f: (x: Journal) => Journal) => setRaw((p) => f(normalizeJournal(p)));
  const { s, set: setS } = useSettings();
  const g = s.notif.gratitude ?? DEFAULT_NOTIF.gratitude!;
  const setG = (n: Partial<typeof g>) => setS({ notif: { ...s.notif, gratitude: { ...g, ...n } } });

  const today = dayKey(new Date());
  const list = blessingsOf(j, today);
  const full = list.length >= MAX_PER_DAY;
  const closed = isClosed(j, today);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const sum = summary(j, today);
  const past = notedDays(j).filter((d) => d !== today).slice(0, 14);

  const after = (next: Journal) => {
    const n = blessingsOf(next, today).length;
    if (n > list.length) {
      softHaptic(n >= MAX_PER_DAY ? 'success' : 'light');
      announce(L('{n} bienfait(s) sur 3', { n }));
    } else softHaptic('select');
  };
  const onChip = (k: (typeof CHIPS)[number]['id']) => {
    const next = toggleChip(j, today, k);
    if (next === j) return;
    after(next);
    set((x) => toggleChip(x, today, k));
  };
  const onAdd = () => {
    const t = text.trim();
    if (!t || full) return;
    const next = addBlessing(j, today, { t });
    if (next === j) return;
    after(next);
    set((x) => addBlessing(x, today, { t }));
    setText('');
  };
  const onClose = () => {
    softHaptic('success');
    set((x) => closeDay(x, today));
    announce(L('Séance close. Al-ḥamdu li-llāh.'));
  };

  return (
    <BEScreen title="Gratitude" sub="Le soir, notez jusqu’à trois bienfaits de la journée. Privé, sur cet appareil : pas de partage, pas de série à tenir.">
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 17 }}>
            Ce soir
          </Text>
          <View accessibilityLabel={L('{n} bienfait(s) sur 3', { n: list.length })} style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: b.goldDeep, backgroundColor: i < list.length ? b.goldDeep : 'transparent' }} />
            ))}
          </View>
        </View>
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>{fmt(today)}</Text>

        {list.map((x, i) => (
          <BlessingLine key={i} x={x} n={i + 1} onRemove={closed ? undefined : () => { softHaptic('select'); set((y) => removeBlessing(y, today, i)); }} />
        ))}

        {!closed ? (
          <>
            <Text style={{ color: b.ink, fontWeight: '800', marginTop: 4 }}>{full ? 'Trois bienfaits notés.' : 'Un geste suffit : touchez une pastille ou écrivez quelques mots.'}</Text>
            <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CHIPS.map((c) => {
                const on = hasChip(j, today, c.id);
                const off = !on && full;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: off }} aria-checked={on}
                    accessibilityLabel={L(c.label)}
                    disabled={off}
                    onPress={() => onChip(c.id)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: on ? 2 : 1, borderColor: on ? b.goldDeep : b.line, backgroundColor: on ? alpha(b.goldDeep, 0.16) : b.paper, opacity: off ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed && !reduce ? 0.97 : 1 }] })}
                  >
                    <Ionicons name={on ? 'checkmark' : c.icon} size={16} color={on ? b.goldDeep : b.inkMuted} />
                    <Text maxFontSizeMultiplier={1.35} style={{ color: b.ink, fontWeight: '700', fontSize: 14 }}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!full ? (
              <View style={{ gap: 8 }}>
                <Field label="En quelques mots (facultatif)" value={text} onChangeText={(v) => setText(v.slice(0, MAX_TEXT))} placeholder={L('ex. un appel de ma mère')} maxLength={MAX_TEXT} returnKeyType="done" onSubmitEditing={onAdd} />
                <Button title="Ajouter" icon="add" small variant="secondary" disabled={!text.trim()} onPress={onAdd} />
              </View>
            ) : null}
            {list.length ? <Button title="Clore avec al-ḥamdu li-llāh" icon="checkmark-done" onPress={onClose} /> : null}
          </>
        ) : (
          <Closing reduce={reduce} onReopen={() => set((x) => reopenDay(x, today))} />
        )}
      </Panel>

      <Panel>
        <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>
          Rappel du soir
        </Text>
        <Toggle label="Un rappel doux le soir" value={g.on} onChange={(v) => setG({ on: v })} hint="Désactivé par défaut. Respecte vos heures calmes ; aucun rappel n’est envoyé pendant ce créneau." />
        {g.on ? <Choice label="Heure du rappel" options={GRATITUDE_TIMES.map((t) => ({ label: t, value: t }))} value={(GRATITUDE_TIMES as readonly string[]).includes(g.at) ? g.at : '21:00'} onChange={(v) => setG({ at: v })} /> : null}
        {g.on && !s.reminders ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: b.rust, fontSize: 13 }}>Les rappels sont désactivés dans Réglages : activez-les pour recevoir celui-ci.</Text>
            <Button title="Ouvrir les réglages" icon="settings-outline" variant="secondary" small onPress={() => router.push('/settings')} />
          </View>
        ) : null}
      </Panel>

      <Panel>
        <Text accessibilityRole="header" style={{ color: b.ink, fontWeight: '900', fontSize: 16 }}>
          Mon journal
        </Text>
        <Text style={{ color: b.inkMuted, fontSize: 13 }}>{L('Cette semaine : {e} soir(s), {n} bienfait(s). Aucun objectif, aucune série.', { e: sum.weekEvenings, n: sum.weekBlessings })}</Text>
        {past.length ? (
          past.map((d) => (
            <View key={d} style={{ gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: b.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: b.ink, fontWeight: '800', flex: 1 }}>{fmt(d)}</Text>
                <Button
                  title={confirm === d ? 'Confirmer' : 'Effacer'}
                  icon="trash-outline"
                  small
                  variant={confirm === d ? 'danger' : 'ghost'}
                  accessibilityLabel={L(confirm === d ? 'Confirmer l’effacement de {d}' : 'Effacer {d}', { d: fmt(d) })}
                  onPress={() => {
                    if (confirm !== d) return setConfirm(d);
                    softHaptic('medium');
                    set((x) => deleteDay(x, d));
                    setConfirm(null);
                  }}
                />
              </View>
              {blessingsOf(j, d).map((x, i) => (
                <BlessingLine key={i} x={x} n={i + 1} />
              ))}
            </View>
          ))
        ) : (
          <Text style={{ color: b.inkMuted, fontSize: 13 }}>Les soirs précédents apparaîtront ici.</Text>
        )}
        {sum.evenings ? (
          <Button
            title={confirm === '*' ? 'Confirmer : tout effacer' : 'Effacer tout le journal'}
            icon="trash-outline"
            small
            variant={confirm === '*' ? 'danger' : 'secondary'}
            onPress={() => {
              if (confirm !== '*') return setConfirm('*');
              softHaptic('medium');
              setRaw(EMPTY_JOURNAL);
              setConfirm(null);
              announce(L('Journal effacé.'));
            }}
          />
        ) : null}
        <Text style={{ color: b.inkMuted, fontSize: 12, lineHeight: 18 }}>Stocké uniquement sur cet appareil ; inclus dans l’export local de vos données et effacé avec elles.</Text>
      </Panel>
    </BEScreen>
  );
}
