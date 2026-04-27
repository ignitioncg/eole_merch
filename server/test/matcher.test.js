'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalise, levenshtein, findMatch } = require('../src/lib/matcher');

const inventory = [
  { id: '1', name: 'Cutlery Sets' },
  { id: '2', name: 'Pens - with stylus' },
  { id: '3', name: 'Charging cables' },
  { id: '4', name: 'Accreditation Certificates' },
  { id: '5', name: 'Branded Notepad' }
];

const getName = (e) => e.name;

test('exact match wins', () => {
  const m = findMatch('Cutlery Sets', inventory, getName);
  assert.equal(m.entry.id, '1');
  assert.equal(m.distance, 0);
});

test('strips "July: " prefix', () => {
  const m = findMatch('July: Charging cables', inventory, getName);
  assert.equal(m.entry.id, '3');
});

test('strips "EOLE " prefix (case insensitive)', () => {
  const m = findMatch('EOLE Cutlery Sets', inventory, getName);
  assert.equal(m.entry.id, '1');
});

test('strips " - print as required" suffix', () => {
  const m = findMatch('Charging cables - PRINT AS REQUIRED', inventory, getName);
  assert.equal(m.entry.id, '3');
});

test('typo within Levenshtein distance ≤ 2 matches', () => {
  const m = findMatch('Accrediation Certificates', inventory, getName);
  assert.ok(m);
  assert.equal(m.entry.id, '4');
  assert.ok(m.distance > 0 && m.distance <= 2);
});

test('no match when too far', () => {
  const m = findMatch('Helicopter parts', inventory, getName);
  assert.equal(m, null);
});

test('normalise edge cases', () => {
  assert.equal(normalise('Pens  -  with stylus'), 'pens with stylus');
  assert.equal(normalise('July: Charging cables'), 'charging cables');
  assert.equal(normalise('EOLE Cutlery: Sets'), 'cutlery sets');
  assert.equal(normalise(null), '');
});

test('levenshtein basics', () => {
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('accrediation', 'accreditation'), 1);
});
