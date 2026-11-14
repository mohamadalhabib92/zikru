import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { TvBack, TvButton, TvMuted, TvScroll, TvTitle } from '@/components/tv/ui';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

export default function TvJoin() {
  const auth = useAuth();
  const [email, setEmail] = useState(auth.lastEmail || '');
  const [otp, setOtp] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(auth.displayName || '');
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState<string | null>(null);
  const send = async () => {
    setErr(null);
    try {
      await auth.sendCode(email.trim());
      setNote(L('Regardez votre e-mail, puis saisissez le code.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : L('Pas de connexion. Réessayez quand vous serez en ligne.'));
    }
  };
  const verify = async () => {
    setErr(null);
    try {
      await auth.verifyCode(email.trim(), otp.trim());
      setNote(L('Connecté.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : L('Code invalide.'));
    }
  };
  const join = async () => {
    setErr(null);
    try {
      const preview = await api.previewInvitation(code);
      if (!preview.valid) {
        setErr(L('Code invalide.'));
        return;
      }
      if (preview.rules && !rules) {
        setRules(preview.rules);
        setNote(L('Lisez le règlement, puis acceptez pour entrer.'));
        return;
      }
      const row = await api.acceptInvitation(code, name.trim() || auth.displayName || 'Salon', true);
      setNote(preview.name || L('Vous faites déjà partie de cette famille'));
      if (row.scope_type === 'family') router.push('/tv/chat');
    } catch (e) {
      setErr(api.frError(e));
    }
  };
  return (
    <TvScroll>
      <TvTitle>{L('Rejoindre')}</TvTitle>
      <TvMuted>{L('Rejoindre une famille ne demande pas Premium. Le code vient d’un parent, sur iPhone.')}</TvMuted>
      {!auth.session ? (
        <View style={{ marginTop: 18, gap: 12 }}>
          <Field label={L('E-mail')} value={email} onChange={setEmail} preferred />
          <TvButton label={L('Recevoir un code')} onPress={() => void send()} />
          <Field label={L('Code reçu')} value={otp} onChange={setOtp} />
          <TvButton label={L('Se connecter')} onPress={() => void verify()} />
        </View>
      ) : (
        <View style={{ marginTop: 18, gap: 12 }}>
          <TvMuted>{auth.email || ''}</TvMuted>
          <Field label={L('Code d’invitation')} value={code} onChange={(v) => setCode(v.toUpperCase())} preferred />
          <Field label={L('Votre nom dans la famille')} value={name} onChange={setName} />
          <TvButton label={L('Rejoindre')} onPress={() => void join()} />
          <TvButton label={L('Se déconnecter')} onPress={() => void auth.signOut()} />
        </View>
      )}
      {rules ? <TvMuted>{rules}</TvMuted> : null}
      {note ? <TvMuted>{note}</TvMuted> : null}
      {err ? <Text style={{ color: t.danger, fontSize: 22, marginTop: 12 }}>{err}</Text> : null}
      <View style={{ marginTop: 18 }}>
        <TvBack />
      </View>
    </TvScroll>
  );
}

function Field({ label, value, onChange, preferred }: { label: string; value: string; onChange: (v: string) => void; preferred?: boolean }) {
  return (
    <View>
      <Text style={{ color: t.muted, fontSize: 18, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        hasTVPreferredFocus={preferred}
        autoCapitalize="none"
        style={{ color: t.text, fontSize: 28, minHeight: 64, borderWidth: 3, borderColor: t.border, borderRadius: 16, paddingHorizontal: 16, backgroundColor: t.surface }}
      />
    </View>
  );
}
