import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/ui/Text';
import { BleStatusChip } from '@/components/BleStatusChip';
import { LBtn, fmt } from '@/components/zikr/parts';
import { useData } from '@/lib/data';
import { uid } from '@/lib/storage';
import { closeSession, type Tasbih } from '@/lib/tasbih-core';
import { advance, dayKey, itemAbjad, markDone, progress, type PracticeState, type Zikr } from '@/lib/zikr';
import { useZikrs } from '@/lib/zikrs';
import { FATIHA_EN, isFatiha, withFatiha } from '@/lib/fatiha';
import { useSettings } from '@/lib/settings';
import { Ionicons, Screen } from '@/ui/kit';
import { Arabic, LCard, LMuted, LText } from '@/ui/light';
import { brand as b } from '@/ui/theme';
import { L, useUiLang } from '@/lib/l10n';

function Bar({ ratio, color, h = 8 }: { ratio: number; color: string; h?: number }) {
  return (
    <View
      style={{
        height: h,
        borderRadius: h / 2,
        backgroundColor: b.line,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`,
          height: '100%',
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export default function Practice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const lang = useUiLang();
  const { zikrs, update, systems, opts, ready: zr } = useZikrs();
  const { tasbih, setTasbih, increment, content, ready: dr } = useData();
  const { s: settings } = useSettings();
  const fatihaOn = settings.fatihaFirst !== false;
  const stored = zikrs.find((x) => x.id === id);
  // Al-Fatiha 1× en première étape (réglage, actif par défaut) ; la composition enregistrée n’est pas modifiée.
  const z = useMemo(() => (stored ? { ...stored, items: withFatiha(stored.items, fatihaOn) } : undefined), [stored, fatihaOn]);
  const [st, setSt] = useState<PracticeState>({ step: 0, count: 0 });
  const [finished, setFinished] = useState(false);
  const zRef = useRef<Zikr | undefined>(z);
  useEffect(() => {
    if (z) zRef.current = z;
  }, [z]);
  const stRef = useRef(st);
  const started = useRef(false);
  const finishedRef = useRef(false);
  const lastTotal = useRef(0);
  const prev = useRef<{ dhikrId: string; target: number }>({
    dhikrId: 'subhanallah',
    target: 33,
  });
  const label = (k: number) => {
    const zz = zRef.current!;
    return `${zz.name} · ${zz.items[k]?.label ?? ''}`;
  };
  const now = () => new Date().toISOString();

  /** Positionne le compteur global (tasbih, Bluetooth) sur l’étape k. */
  const aim = (t: Tasbih, k: number, count = 0): Tasbih => {
    const it = zRef.current?.items[k];
    if (!it)
      return {
        ...t,
        count: 0,
        deviceCount: 0,
        dhikrId: prev.current.dhikrId,
        target: prev.current.target,
      };
    return {
      ...t,
      count,
      deviceCount: Math.min(t.deviceCount ?? 0, count),
      // reste d'une rafale Bluetooth reporté sur l'étape suivante : sa séance commence maintenant
      firstAt: count > 0 ? Date.now() : undefined,
      lastAt: count > 0 ? Date.now() : undefined,
      dhikrId: label(k),
      target: it.reps,
    };
  };

  // Démarrage : clôt la session tasbih en cours, mémorise le dhikr courant et cible la 1re étape.
  useEffect(() => {
    if (started.current || !z || !dr || !z.items.length) return;
    started.current = true;
    // Après un arrêt brutal de l'app pendant une pratique, le tasbih peut encore porter un libellé
    // « composition · étape » : on ne le restaure pas comme dhikr précédent.
    const known = content.some((c) => c.id === tasbih.dhikrId);
    prev.current = known ? { dhikrId: tasbih.dhikrId, target: tasbih.target } : { dhikrId: 'subhanallah', target: 33 };
    lastTotal.current = tasbih.total;
    setTasbih((t) => aim(closeSession(t, uid('s'), now()), 0));
  }, [z?.id, dr]);

  // Sortie : enregistre l’étape entamée et rétablit le dhikr précédent.
  useEffect(
    () => () => {
      if (!started.current || finishedRef.current) return;
      setTasbih((t) => ({
        ...closeSession(t, uid('s'), now()),
        dhikrId: prev.current.dhikrId,
        target: prev.current.target,
      }));
    },
    [],
  );

  // Tous les appuis (écran, compteur Bluetooth, clavier) passent par tasbih.total.
  useEffect(() => {
    if (!started.current) return;
    const d = tasbih.total - lastTotal.current;
    lastTotal.current = tasbih.total;
    const zz = zRef.current;
    if (d <= 0 || finishedRef.current || !zz) return;
    const r = advance(zz.items, stRef.current, d);
    stRef.current = r.state;
    setSt(r.state);
    if (r.completed.length) {
      setTasbih((t) => {
        let x = t;
        let dev = t.deviceCount ?? 0;
        const at = now();
        for (const k of r.completed) {
          const reps = zz.items[k].reps;
          const dk = Math.min(dev, reps);
          dev -= dk;
          x = closeSession(
            {
              ...x,
              count: reps,
              deviceCount: dk,
              dhikrId: label(k),
              target: reps,
            },
            uid('s'),
            at,
          );
        }
        return aim({ ...x, deviceCount: dev }, r.state.step, r.state.count);
      });
    }
    if (r.finished) {
      finishedRef.current = true;
      setFinished(true);
      update(zz.id, (y) => markDone(y));
    }
  }, [tasbih.total]);

  const skip = () => {
    const zz = zRef.current;
    if (!zz) return;
    const next = Math.min(zz.items.length - 1, stRef.current.step + 1);
    stRef.current = { step: next, count: 0 };
    setSt(stRef.current);
    setTasbih((t) => aim(closeSession(t, uid('s'), now()), next));
  };
  const back = () => {
    const p = Math.max(0, stRef.current.step - 1);
    stRef.current = { step: p, count: 0 };
    setSt(stRef.current);
    setTasbih((t) => aim(closeSession(t, uid('s'), now()), p));
  };
  const restart = () => {
    finishedRef.current = false;
    setFinished(false);
    stRef.current = { step: 0, count: 0 };
    setSt(stRef.current);
    lastTotal.current = tasbih.total;
    setTasbih((t) => aim(closeSession(t, uid('s'), now()), 0));
  };

  if (!z || !z.items.length) {
    return (
      <Screen bg={b.cream}>
        <LText>{!zr ? 'Chargement…' : !z ? 'Composition introuvable.' : 'Cette composition est vide.'}</LText>
        <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <LBtn icon="arrow-back" label="Mes zikrs" onPress={() => router.replace('/zikrs')} />
        </View>
      </Screen>
    );
  }

  const items = z.items;
  const cur = items[Math.min(st.step, items.length - 1)];
  // Al-Fātiḥa : sens anglais Pickthall (domaine public) ; en arabe, le texte coranique suffit.
  const meaning = cur && isFatiha(cur) ? (lang === 'en' ? FATIHA_EN : lang === 'ar' ? undefined : cur.fr) : cur?.fr;
  const g = progress(items, st.step, st.count);
  const today = z.done?.[dayKey()] ?? 0;

  return (
    <Screen bg={b.cream}>
      <Stack.Screen options={{ title: z.name }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Text style={{ color: b.green, fontWeight: '900' }}>{finished ? 'Terminé' : L('Étape {a} / {b}', { a: st.step + 1, b: items.length })}</Text>
        <BleStatusChip showIdle />
      </View>
      {z.niyya ? <LMuted style={{ fontStyle: 'italic', marginTop: 4 }}>{L('Intention : {x}', { x: z.niyya })}</LMuted> : null}
      <View style={{ marginTop: 10, gap: 4 }}>
        <Bar ratio={g.ratio} color={b.green} />
        <LMuted style={{ fontSize: 11 }}>{L('{a} / {b} au total', { a: fmt(g.done), b: fmt(g.total) })}</LMuted>
      </View>

      {finished ? (
        <LCard style={{ marginTop: 14, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={56} color={b.green} />
          <Text
            style={{
              color: b.ink,
              fontWeight: '900',
              fontSize: 20,
              marginTop: 6,
            }}
          >
            Composition terminée
          </Text>
          <Text style={{ color: b.green, fontSize: 22, marginTop: 6 }}>تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ</Text>
          <LMuted style={{ marginTop: 6, textAlign: 'center' }}>{L('{n}× aujourd’hui', { n: today }) + (z.goal ? ' · ' + L('objectif {g}', { g: z.goal.perDay }) : '') + ' · ' + L('sessions ajoutées à l’historique du tasbih')}</LMuted>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <LBtn icon="refresh" label="Recommencer" solid onPress={restart} />
            <LBtn icon="arrow-back" label="Mes zikrs" onPress={() => router.replace('/zikrs')} />
          </View>
        </LCard>
      ) : (
        <>
          <LCard style={{ marginTop: 14 }}>
            <Text style={{ color: b.ink, fontWeight: '800', fontSize: 16 }}>{cur.label}</Text>
            {cur.ref ? <LMuted style={{ fontSize: 11 }}>{cur.ref}</LMuted> : null}
            <Arabic
              size={cur.ar.length > 200 ? 22 : 28}
              style={{
                marginTop: 8,
                lineHeight: cur.ar.length > 200 ? 40 : 50,
              }}
            >
              {cur.ar}
            </Arabic>
            {cur.tr ? (
              <Text
                style={{
                  color: b.brownSoft,
                  fontStyle: 'italic',
                  marginTop: 4,
                }}
              >
                {cur.tr}
              </Text>
            ) : null}
            {meaning ? <LMuted style={{ marginTop: 4 }}>{meaning}</LMuted> : null}
            <LMuted style={{ fontSize: 11, marginTop: 6 }}>{systems.map((s) => `abjad ${s} ${fmt(itemAbjad(cur, s, opts))}`).join(' · ')}</LMuted>
          </LCard>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={L('Compter. {a} sur {b}', { a: st.count, b: cur.reps })}
            onPress={increment}
            style={({ pressed }) => ({
              alignSelf: 'center',
              marginTop: 18,
              width: 210,
              height: 210,
              borderRadius: 105,
              backgroundColor: b.green,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.96 : 1 }],
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            })}
          >
            <Text style={{ color: b.onGreen, fontSize: 58, fontWeight: '900' }}>{st.count}</Text>
            <Text style={{ color: b.onGreen, fontWeight: '800' }}>{`/ ${fmt(cur.reps)}`}</Text>
          </Pressable>
          <View style={{ marginTop: 14 }}>
            <Bar ratio={cur.reps ? st.count / cur.reps : 0} color={b.green} h={6} />
          </View>
          <LMuted style={{ textAlign: 'center', marginTop: 6, fontSize: 12 }}>Touchez le cercle ou utilisez votre compteur Bluetooth ; l’étape suivante démarre automatiquement.</LMuted>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              justifyContent: 'center',
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <LBtn icon="play-back" label="Précédente" disabled={st.step === 0} onPress={back} />
            <LBtn icon="play-forward" label="Passer" disabled={st.step >= items.length - 1} onPress={skip} />
            <LBtn icon="refresh" label="Recommencer" onPress={restart} />
          </View>
        </>
      )}

      <View style={{ marginTop: 18, gap: 6 }}>
        {items.map((it, k) => {
          const done = finished || k < st.step;
          const isCur = !finished && k === st.step;
          return (
            <View
              key={it.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 12,
                backgroundColor: isCur ? b.green + '14' : b.paper,
                borderWidth: 1,
                borderColor: isCur ? b.green : b.line,
              }}
            >
              <Ionicons name={done ? 'checkmark-circle' : isCur ? 'radio-button-on' : 'ellipse-outline'} size={18} color={done ? b.green : isCur ? b.green : b.inkMuted} />
              <Text
                style={{
                  flex: 1,
                  color: b.ink,
                  fontWeight: isCur ? '800' : '600',
                }}
                numberOfLines={1}
              >
                {it.label}
              </Text>
              <Text style={{ color: b.inkMuted, fontWeight: '700' }}>{isCur ? `${st.count}/${it.reps}` : `× ${fmt(it.reps)}`}</Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
