// Istikhraj : 99 Noms dont l’abjad égale un nombre, et la note « 50 = واحد أحد حي ».
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { istikhraj: I, abjad: A } = await loadLib(['istikhraj', 'abjad'], 'istikhraj');

const fifty = I.wahidAhadHayy();
assert.deepEqual(fifty.parts.map((p) => p.value), [19, 13, 18]);
assert.equal(fifty.total, 50);
assert.equal(A.computeAbjad('واحد أحد حي', 'mashriqi').total, 50);

const at66 = I.namesByValue(66);
assert.ok(at66.some((n) => n.tr === 'Allāh'), 'الله vaut 66');
assert.ok(at66.every((n) => n.value === 66));

const at50 = I.namesByValue(50);
assert.equal(at50.length, 0, 'aucun des 99 Noms de la liste ne vaut 50 à lui seul');

const rahman = I.namesByValue(298);
assert.ok(rahman.some((n) => n.tr === 'Ar-Raḥmān'));
assert.equal(A.computeAbjad('رحمن', 'mashriqi').total, 298);

assert.equal(I.namesByValue(0).length, 0);
assert.equal(I.namesByValue(-3).length, 0);

console.log('istikhraj : 50, 66, 298 et la liste des Noms OK');
