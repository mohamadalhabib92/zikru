/**
 * Tests jest des droits côté client (logique pure). Aucune limite codée en dur :
 * chaque valeur vient d'une réponse serveur simulée.
 */
import { describe, expect, test } from '@jest/globals';
import * as E from '../entitlements';

const server = (members: number | null, extra: Record<string, unknown> = {}) => ({
  plan: 'free', source: null, valid_until: null, payments_enabled: false, config_version: 1761730000,
  limits: { max_group_members_created: members, bilal_daily_quota: 30, themes: false, ...extra },
});

describe('droits', () => {
  test('lit la limite renvoyée par le serveur, quelle qu’elle soit', () => {
    for (const n of [4, 5, 12]) {
      const e = E.parseEntitlements(server(n), 0);
      expect(E.capOf(e, E.LIMIT_KEYS.groupMembers)).toEqual({ kind: 'limited', value: n });
    }
  });
  test('null = illimité ; clé absente ou aucun droit connu = inconnu (ne bloque pas)', () => {
    const e = E.parseEntitlements(server(null), 0);
    expect(E.capOf(e, E.LIMIT_KEYS.groupMembers)).toEqual({ kind: 'unlimited' });
    expect(E.capOf(e, 'cle_future')).toEqual({ kind: 'unknown' });
    expect(E.capOf(null, E.LIMIT_KEYS.groupMembers)).toEqual({ kind: 'unknown' });
    expect(E.roomLeft({ kind: 'unknown' }, 99)).toBe('unknown');
    expect(E.roomLeft({ kind: 'limited', value: 4 }, 3)).toBe(1);
    expect(E.roomLeft({ kind: 'limited', value: 3 }, 5)).toBe(0); // antériorité : groupe au-dessus de la limite
  });
  test('fonctions premium : inconnu ou faux → désactivé', () => {
    expect(E.featureOn(null, 'themes')).toBe(false);
    expect(E.featureOn(E.parseEntitlements(server(4), 0), 'themes')).toBe(false);
    expect(E.featureOn(E.parseEntitlements(server(50, { themes: true }), 0), 'themes')).toBe(true);
  });
  test('cache : aller-retour, réponse invalide rejetée, une clé par compte', () => {
    const e = E.parseEntitlements(server(4), 1234)!;
    expect(E.fromCache(E.toCache(e))).toEqual(e);
    expect(E.fromCache('pas du json')).toBeNull();
    expect(E.parseEntitlements({ plan: 'free' }, 0)).toBeNull();
    expect(E.parseEntitlements({ plan: 'free', limits: { x: 'texte', y: 2 } }, 0)!.limits).toEqual({ y: 2 });
    expect(E.cacheKey('a')).not.toBe(E.cacheKey('b'));
  });
  test('fraîcheur du cache', () => {
    const e = E.parseEntitlements(server(4), 1000)!;
    expect(E.isStale(null, 0)).toBe(true);
    expect(E.isStale(e, 1000 + E.DEFAULT_TTL_MS - 1)).toBe(false);
    expect(E.isStale(e, 1000 + E.DEFAULT_TTL_MS)).toBe(true);
    expect(E.isStale(e, 500)).toBe(true); // horloge reculée
  });
  test('erreurs serveur : code SQLSTATE, chiffre issu du serveur', () => {
    const full = E.limitErrorFrom({ code: 'ZKG01', details: JSON.stringify({ reason: 'group_full', limit: 7, members: 7 }) });
    expect(full).toEqual({ reason: 'group_full', limit: 7, members: 7 });
    expect(E.limitMessage(full!)).toContain('7 membres');
    expect(E.limitMessage({ reason: 'group_full', limit: null, members: null })).toBe('Ce groupe est complet.');
    expect(E.limitErrorFrom({ code: 'ZKG02', details: 'cassé' })).toEqual({ reason: 'groups_created_limit', limit: null });
    expect(E.limitErrorFrom({ status: 429, error: 'quota' })).toEqual({ reason: 'bilal_quota' });
    expect(E.limitErrorFrom({ code: '42501' })).toBeNull();
  });
});
