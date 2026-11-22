import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TvBack, TvButton, TvField, TvMuted, TvScroll, TvTitle } from '@/components/tv/ui';
import * as api from '@/lib/community/api';
import { useAuth } from '@/lib/community/auth';
import { EMAIL_OTP_LENGTH, INVITE_CODE_LENGTH, emailOtpDigits, inviteCode, looksLikeInviteCode } from '@/lib/join-codes';
import { L } from '@/lib/l10n';
import { Text } from '@/ui/Text';
import { theme as t } from '@/ui/theme';

/**
 * Deux étapes. Le code à 6 chiffres vient de l’e-mail (Supabase, type email).
 * Le code à 10 caractères vient d’un parent, sur iPhone. On ne les saisit jamais dans le même champ.
 */
export default function TvJoin() {
  const auth = useAuth();
  const [email, setEmail] = useState(auth.lastEmail || '');
  const [otp, setOtp] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(auth.displayName || '');
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState<string | null>(null);
  const send = async () => {
    setErr(null);
    try {
      await auth.sendCode(email.trim());
      setSent(true);
      setOtp('');
      setNote(L('Regardez votre e-mail, puis saisissez le code.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : L('Pas de connexion. Réessayez quand vous serez en ligne.'));
    }
  };
  const verify = async () => {
    setErr(null);
    if (looksLikeInviteCode(otp)) {
      setErr(L('Ce champ est le code à 6 chiffres de l’e-mail. Le code de la famille se saisit après la connexion.'));
      return;
    }
    const digits = emailOtpDigits(otp);
    if (digits.length < EMAIL_OTP_LENGTH) {
      setErr(L('Code à 6 chiffres'));
      return;
    }
    try {
      await auth.verifyCode(email.trim(), digits);
      setNote(L('Connecté.'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : L('Code invalide.'));
    }
  };
  const join = async () => {
    setErr(null);
    const family = inviteCode(code);
    if (family.length < INVITE_CODE_LENGTH) {
      setErr(L('Code invalide.'));
      return;
    }
    try {
      const preview = await api.previewInvitation(family);
      if (!preview.valid) {
        setErr(L('Code invalide.'));
        return;
      }
      if (preview.rules && !rules) {
        setRules(preview.rules);
        setNote(L('Lisez le règlement, puis acceptez pour entrer.'));
        return;
      }
      const row = await api.acceptInvitation(family, name.trim() || auth.displayName || 'Salon', true);
      setNote(preview.name || L('Vous faites déjà partie de cette famille'));
      if (row.scope_type === 'family') router.push('/tv/chat');
    } catch (e) {
      setErr(api.frError(e));
    }
  };
  return (
    <TvScroll>
      <TvTitle>{L('Rejoindre')}</TvTitle>
      {!auth.session ? (
        <View style={{ marginTop: 18, gap: 16 }}>
          <TvMuted>{L('D’abord le code à 6 chiffres envoyé par e-mail. Le code de la famille, dix caractères, vient ensuite d’un parent sur iPhone.')}</TvMuted>
          <TvField label={L('E-mail')} value={email} onChange={setEmail} preferred keyboardType="email-address" />
          <TvButton label={L('Recevoir un code')} onPress={() => void send()} />
          {sent ? (
            <>
              <TvField label={L('Code à 6 chiffres')} value={otp} onChange={(v) => setOtp(emailOtpDigits(v))} keyboardType="number-pad" maxLength={EMAIL_OTP_LENGTH} />
              <TvButton label={L('Se connecter')} onPress={() => void verify()} />
            </>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: 18, gap: 16 }}>
          <TvMuted>{L('Rejoindre une famille ne demande pas Premium. Le code vient d’un parent, sur iPhone.')}</TvMuted>
          <TvMuted>{auth.email || ''}</TvMuted>
          <TvField label={L('Code d’invitation')} value={code} onChange={(v) => setCode(inviteCode(v))} preferred autoCapitalize="characters" maxLength={INVITE_CODE_LENGTH} />
          <TvField label={L('Votre nom dans la famille')} value={name} onChange={setName} />
          <TvButton label={L('Rejoindre')} onPress={() => void join()} />
          <TvButton label={L('Se déconnecter')} onPress={() => void auth.signOut()} />
        </View>
      )}
      {rules ? (
        <View style={{ marginTop: 16 }}>
          <TvButton block label={rules} onPress={() => void join()} />
        </View>
      ) : null}
      {note ? <TvMuted>{note}</TvMuted> : null}
      {err ? <Text style={{ color: t.danger, fontSize: 28, lineHeight: 38, marginTop: 12 }}>{err}</Text> : null}
      <View style={{ marginTop: 18 }}>
        <TvBack />
      </View>
    </TvScroll>
  );
}
