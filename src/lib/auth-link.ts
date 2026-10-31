// Retour des liens magiques Supabase : lecture de l'adresse (code PKCE ou erreur) et message clair. Sans dépendance (testé par scripts/test-auth-link.mjs).

/** Message clair pour un lien refusé par Supabase (expiré, déjà utilisé, ouvert sur un autre appareil…). */
export function linkErrorMessage(code: string | undefined, desc: string | undefined): string {
  if (/code verifier|pkce|flow state/i.test(desc ?? ''))
    return 'Ce lien a été ouvert sur un autre appareil ou navigateur. Saisissez le code à 6 chiffres de l’e-mail ici, ou demandez un nouveau lien.';
  if (code === 'otp_expired' || /expired|invalid/i.test(desc ?? ''))
    return 'Lien expiré ou déjà utilisé. Saisissez le code à 6 chiffres de l’e-mail, ou demandez un nouveau lien.';
  return 'Le lien de connexion n’a pas fonctionné. Saisissez le code à 6 chiffres de l’e-mail, ou demandez un nouveau lien.';
}

/** Paramètres d'erreur ou code PKCE d'une URL de retour (requête et fragment #). */
export function parseAuthReturn(url: string): { code?: string; error?: string; errorCode?: string } {
  const out: { code?: string; error?: string; errorCode?: string } = {};
  const parts = url.split('#');
  const query = parts[0].includes('?') ? parts[0].slice(parts[0].indexOf('?') + 1) : '';
  for (const chunk of [query, parts.slice(1).join('#')]) {
    const p = new URLSearchParams(chunk);
    if (p.get('code') && !out.code) out.code = p.get('code')!;
    if (p.get('error_description') || p.get('error')) {
      out.error = out.error ?? p.get('error_description') ?? p.get('error') ?? undefined;
      out.errorCode = out.errorCode ?? p.get('error_code') ?? undefined;
    }
  }
  return out;
}
