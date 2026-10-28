/**
 * Tests jest de la file hors-ligne (logique pure). Le « serveur » est simulé par un ensemble
 * de clés (device, seq, goal) — exactement la clé primaire de public.counter_events.
 * Lancer : voir docs/p1-groups/README.md (jest + ts-jest dans un dossier temporaire).
 */
import { describe, expect, test } from '@jest/globals';
import * as Q from '../counterQueue';

const DEV = '11111111-2222-4333-8444-555555555555';
const G1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const G2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const t0 = new Date('2026-10-29T18:00:00Z');

/** Serveur simulé : mêmes règles que ingest_counter_events (dédoublonnage + bornes). */
function fakeServer() {
  const seen = new Map<string, number>();
  const totals: Record<string, number> = {};
  return {
    totals,
    ingest(device: string, events: Q.CounterEvent[]): Q.IngestResult {
      const r: Q.IngestResult = { accepted: 0, duplicates: 0, acked: [], rejected: [], totals: {} };
      for (const e of events) {
        const k = `${device}|${e.seq}|${e.goal_id}`;
        if (e.count < 1 || e.count > 1000) { r.rejected.push({ seq: e.seq, goal_id: e.goal_id, reason: 'format' }); continue; }
        if (seen.has(k)) { r.duplicates++; r.acked.push({ seq: e.seq, goal_id: e.goal_id }); continue; }
        seen.set(k, e.count);
        totals[e.goal_id] = (totals[e.goal_id] ?? 0) + e.count;
        r.accepted++;
        r.acked.push({ seq: e.seq, goal_id: e.goal_id });
      }
      for (const g of new Set(r.acked.map((a) => a.goal_id))) r.totals[g] = totals[g] ?? 0;
      return r;
    },
  };
}

describe('counterQueue', () => {
  test('createQueue exige un UUID v4 ; uuidV4 en produit un', () => {
    expect(() => Q.createQueue('pas-un-uuid')).toThrow();
    const id = Q.uuidV4(new Uint8Array(16).fill(0xff));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Q.createQueue(id).nextSeq).toBe(1);
  });

  test('les appuis s’accumulent puis seal attribue un seq partagé par les objectifs liés', () => {
    let s = Q.createQueue(DEV);
    s = Q.addTaps(s, [G1, G2], 1, 'ecran', t0);
    s = Q.addTaps(s, [G1, G2], 32, 'ecran', t0);
    expect(Q.localPending(s, G1)).toBe(33);
    s = Q.seal(s);
    expect(s.pending).toHaveLength(2);
    expect(new Set(s.pending.map((e) => e.seq))).toEqual(new Set([1]));
    expect(s.nextSeq).toBe(2);
    expect(Q.seal(s)).toBe(s); // rien d'ouvert : état inchangé, aucun seq consommé
  });

  test('un lot est scellé à 1000 et le surplus part dans le lot suivant', () => {
    let s = Q.addTaps(Q.createQueue(DEV), [G1], 2500, 'bague', t0);
    s = Q.seal(s);
    expect(s.pending.map((e) => e.count)).toEqual([1000, 1000, 500]);
    expect(s.pending.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  test('changer de source scelle le lot précédent', () => {
    let s = Q.addTaps(Q.createQueue(DEV), [G1], 5, 'bague', t0);
    s = Q.addTaps(s, [G1], 3, 'ecran', t0);
    s = Q.seal(s);
    expect(s.pending.map((e) => [e.source, e.count])).toEqual([['bague', 5], ['ecran', 3]]);
  });

  test('réponse perdue puis renvoi : le serveur ne compte qu’une fois', () => {
    const srv = fakeServer();
    let s = Q.seal(Q.addTaps(Q.createQueue(DEV), [G1], 33, 'ecran', t0));
    const batch = Q.nextBatch(s);
    s = Q.markSent(s, batch);
    srv.ingest(DEV, batch); // écrit côté serveur… mais la réponse se perd (réseau coupé)
    expect(s.pending).toHaveLength(1); // toujours en file côté client
    const r = srv.ingest(DEV, Q.nextBatch(s)); // renvoi
    expect(r.duplicates).toBe(1);
    s = Q.applyResult(s, r);
    expect(s.pending).toHaveLength(0);
    expect(srv.totals[G1]).toBe(33);
  });

  test('affichage sans double comptage : total serveur + local non acquitté', () => {
    const srv = fakeServer();
    let s = Q.seal(Q.addTaps(Q.createQueue(DEV), [G1], 10, 'ecran', t0));
    let known = Q.mergeServerTotal(undefined, { total: 100, at: 0 });
    expect(Q.displayTotal(known.total, s, G1)).toBe(110);
    const r = srv.ingest(DEV, Q.nextBatch(s));
    s = Q.applyResult(s, r);
    known = Q.mergeServerTotal(known, { total: 100 + r.totals[G1], at: 1 });
    expect(Q.displayTotal(known.total, s, G1)).toBe(110);
  });

  test('Realtime dans le désordre : le message le plus récent gagne', () => {
    let k = Q.mergeServerTotal(undefined, { total: 50, at: '2026-10-29T18:00:02Z' });
    k = Q.mergeServerTotal(k, { total: 40, at: '2026-10-29T18:00:01Z' });
    expect(k.total).toBe(50);
    k = Q.mergeServerTotal(k, { total: 60, at: '2026-10-29T18:00:03Z' });
    expect(k.total).toBe(60);
  });

  test('les rejets définitifs sortent de la file', () => {
    let s = Q.seal(Q.addTaps(Q.createQueue(DEV), [G1, G2], 1, 'ecran', t0));
    s = Q.applyResult(s, { accepted: 0, duplicates: 0, acked: [{ seq: 1, goal_id: G1 }], rejected: [{ seq: 1, goal_id: G2, reason: 'objectif' }], totals: {} });
    expect(s.pending).toHaveLength(0);
  });

  test('compaction : ne fusionne jamais un événement déjà envoyé', () => {
    let s = Q.createQueue(DEV);
    for (let i = 0; i < Q.MAX_PENDING + 5; i++) s = Q.seal(Q.addTaps(s, [G1], 1, 'ecran', t0));
    const firstSent = Q.nextBatch(s, 3);
    s = Q.markSent(s, firstSent);
    const total = Q.localPending(s, G1);
    const c = Q.compact(s);
    expect(c.pending.length).toBeLessThan(s.pending.length);
    expect(Q.localPending(c, G1)).toBe(total); // aucun appui perdu
    expect(c.pending.slice(0, 3)).toEqual(s.pending.slice(0, 3)); // envoyés intacts
    expect(c.pending.every((e) => e.count <= Q.MAX_EVENT_COUNT)).toBe(true);
    expect(c.nextSeq).toBe(s.nextSeq); // les seq ne reculent jamais
  });

  test('persistance : aller-retour, et état incohérent refusé (jamais de seq réutilisé)', () => {
    const s = Q.seal(Q.addTaps(Q.createQueue(DEV), [G1], 7, 'montre', t0));
    expect(Q.deserialize(Q.serialize(s))).toEqual(s);
    expect(Q.deserialize('{oops')).toBeNull();
    expect(Q.deserialize(null)).toBeNull();
    const bad = { ...s, nextSeq: 1 }; // seq 1 déjà attribué mais nextSeq = 1
    expect(Q.deserialize(JSON.stringify(bad))).toBeNull();
  });

  test('propriété : n’importe quel ordre d’envois, de pertes et de renvois donne le bon total', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 200; run++) {
      const srv = fakeServer();
      let s = Q.createQueue(DEV);
      let expected = 0;
      for (let step = 0; step < 60; step++) {
        const x = rnd();
        if (x < 0.5) {
          const n = 1 + Math.floor(rnd() * 120);
          expected += n;
          s = Q.addTaps(s, [G1], n, rnd() < 0.8 ? 'ecran' : 'bague', t0);
        } else if (x < 0.7) {
          s = Q.seal(s);
        } else {
          const batch = Q.nextBatch(s, 1 + Math.floor(rnd() * 5));
          if (!batch.length) continue;
          s = Q.markSent(s, batch);
          const r = srv.ingest(DEV, rnd() < 0.5 ? batch : [...batch].reverse());
          if (rnd() < 0.7) s = Q.applyResult(s, r); // 30 % de réponses perdues
        }
      }
      s = Q.seal(s);
      while (s.pending.length) s = Q.applyResult(s, srv.ingest(DEV, Q.nextBatch(s)));
      expect(srv.totals[G1] ?? 0).toBe(expected);
    }
  });
});
