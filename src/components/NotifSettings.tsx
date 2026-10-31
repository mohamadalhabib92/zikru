import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BEFORE_OPTIONS, DEFAULT_QUIET, FARD_KEYS, type NotifPrefs } from '@/lib/notify-plan';
import { reminderPermission, remindersNative, remindersSupported, requestReminderPermission, scheduledCount, sendTestNotification } from '@/lib/reminders';
import { useSettings } from '@/lib/settings';
import { Button, Card, Chip, Divider, H2, Muted, Notice, Row, Segmented, Spacer, Toggle } from '@/ui/kit';
import { L } from '@/lib/l10n';

const QUIET_FROM = ['21:00', '22:00', '22:30', '23:00', '00:00'];
const QUIET_TO = ['05:00', '06:00', '06:30', '07:00', '08:00'];

/** Centre de notifications : interrupteur général, prière par prière, avant l’adhan, un interrupteur par type, heures calmes, bilan. */
export function NotifSettings() {
  const { s, set, t: tr } = useSettings();
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [count, setCount] = useState<number | null>(null);
  const n = s.notif;
  const patch = (p: Partial<NotifPrefs>) => set({ notif: { ...n, ...p } });
  useEffect(() => {
    let alive = true;
    reminderPermission().then((p) => alive && setPerm(p));
    // laisse le temps à la reprogrammation (déclenchée par le changement de réglage)
    const id = setTimeout(() => scheduledCount().then((c) => alive && setCount(c)), 1500);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [s.reminders, s.notif, s.place, s.method, s.madhab, s.prayer]);
  if (!remindersSupported()) return null;
  return (
    <>
      <H2>{tr.notif_title}</H2>
      <Card>
        <Toggle
          label={tr.reminders}
          hint={tr.reminders_hint}
          value={s.reminders && perm !== 'denied'}
          onChange={async (v) => {
            const ok = v ? await requestReminderPermission() : false;
            setPerm(await reminderPermission());
            set({ reminders: ok });
          }}
        />
        {perm === 'denied' ? <Notice tone="warning" title={tr.notif_denied} /> : null}
        {s.reminders && perm !== 'denied' ? (
          <>
            <Divider />
            <Muted style={{ marginBottom: 6 }}>{tr.notif_prayers}</Muted>
            <Row wrap>
              {FARD_KEYS.map((k) => (
                <Chip key={k} label={(n.prayers[k] ? '✓ ' : '') + tr[k]} active={n.prayers[k]} onPress={() => patch({ prayers: { ...n.prayers, [k]: !n.prayers[k] } })} />
              ))}
            </Row>
            <Spacer h={10} />
            <Segmented
              label={tr.notif_before}
              options={BEFORE_OPTIONS.map((m) => ({ label: m === 0 ? L('Désactivé') : L('{n} min', { n: m }), value: m }))}
              value={BEFORE_OPTIONS.includes(n.before) ? n.before : 0}
              onChange={(v) => patch({ before: v })}
            />
            <Muted style={{ marginTop: 6, marginBottom: 2 }}>{tr.notif_types}</Muted>
            <Toggle label={tr.notif_friday} value={n.friday} onChange={(v) => patch({ friday: v })} />
            <Toggle label={tr.notif_adhkar} value={n.adhkar} onChange={(v) => patch({ adhkar: v })} />
            <Toggle label={tr.notif_wird} value={n.wird} onChange={(v) => patch({ wird: v })} />
            <Segmented
              label={tr.notif_quran}
              options={[{ label: tr.notif_off, value: 'off' as const }, { label: tr.notif_quran_fajr, value: 'fajr' as const }, { label: tr.notif_quran_isha, value: 'isha' as const }]}
              value={n.quran ?? 'off'}
              onChange={(v) => patch({ quran: v })}
            />
            <Toggle label={tr.notif_recap} value={!!n.recap} onChange={(v) => patch({ recap: v })} />
            <Divider />
            <Toggle label={tr.notif_quiet} hint={tr.notif_quiet_hint} value={!!n.quiet?.on} onChange={(v) => patch({ quiet: { ...DEFAULT_QUIET, ...n.quiet, on: v } })} />
            {n.quiet?.on ? (
              <>
                <Segmented label={tr.notif_quiet_from} options={QUIET_FROM.map((x) => ({ label: x, value: x }))} value={QUIET_FROM.includes(n.quiet.from) ? n.quiet.from : DEFAULT_QUIET.from} onChange={(v) => patch({ quiet: { ...n.quiet!, from: v } })} />
                <Segmented label={tr.notif_quiet_to} options={QUIET_TO.map((x) => ({ label: x, value: x }))} value={QUIET_TO.includes(n.quiet.to) ? n.quiet.to : DEFAULT_QUIET.to} onChange={(v) => patch({ quiet: { ...n.quiet!, to: v } })} />
              </>
            ) : null}
            <Divider />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {remindersNative && count != null ? <Muted style={{ flex: 1 }}>{tr.notif_scheduled.replace('{n}', String(count))}</Muted> : <View style={{ flex: 1 }} />}
              <Button title={tr.notif_test} icon="notifications-outline" variant="secondary" onPress={() => sendTestNotification('Zikru', tr.notif_test_b)} />
            </View>
          </>
        ) : null}
      </Card>
      <Spacer h={20} />
    </>
  );
}
