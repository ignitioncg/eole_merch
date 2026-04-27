'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalise, levenshtein, findMatch } = require('../src/matcher');

const inventory = [
  { id: '1', name: 'Cutlery Sets' },
  { id: '2', name: 'Pens - with stylus' },
  { id: '3', name: 'Charging cables' },
  { id: '4', name: 'Accreditation Certificates' },
  { id: '5', name: 'Branded Notepad' }
];

test('exact match wins', () => {
  const m = findMatch('Cutlery Sets', inventory);
  assert.equal(m.item.id, '1');
  assert.equal(m.distance, 0);
});

test('strips "July: " prefix', () => {
  const m = findMatch('July: Charging cables', inventory);
  assert.equal(m.item.id, '3');
  assert.equal(m.distance, 0);
});

test('strips "EOLE " prefix (case insensitive)', () => {
  const m = findMatch('EOLE Cutlery Sets', inventory);
  assert.equal(m.item.id, '1');
  assert.equal(m.distance, 0);
});

test('strips " - print as required" suffix', () => {
  const m = findMatch('Charging cables - PRINT AS REQUIRED', inventory);
  assert.equal(m.item.id, '3');
});

test('typo within Levenshtein distance ≤ 2 matches', () => {
  const m = findMatch('Accrediation Certificates', inventory);
  assert.ok(m, 'expected typo match');
  assert.equal(m.item.id, '4');
  assert.ok(m.distance > 0 && m.distance <= 2);
});

test('no match returns null when too far', () => {
  const m = findMatch('Helicopter parts', inventory);
  assert.equal(m, null);
});

test('normalise collapses dashes, colons, multiple spaces', () => {
  assert.equal(normalise('Pens  -  with stylus'), 'pens with stylus');
  assert.equal(normalise('July: Charging cables'), 'charging cables');
  assert.equal(normalise('EOLE Cutlery: Sets'), 'cutlery sets');
});

test('levenshtein returns 0 for identical strings', () => {
  assert.equal(levenshtein('abc', 'abc'), 0);
});

test('levenshtein returns expected edit distance', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('accrediation', 'accreditation'), 1);
});

test('null/empty input returns null', () => {
  assert.equal(findMatch('', inventory), null);
  assert.equal(findMatch(null, inventory), null);
});
