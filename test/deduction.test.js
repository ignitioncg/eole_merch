'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planDeductions } = require('../src/deduction');
const { STATUS } = require('../src/status');
const { buildAuditBody, buildLowStockBody } = require('../src/processor');

function makeInventoryItem({ id, name, count, statusIndex = STATUS.IN_STOCK }) {
  return {
    id: String(id),
    name,
    column_values: [
      { id: 'numeric_mm121bdf', type: 'numbers', text: String(count), value: JSON.stringify(count) },
      { id: 'color_mm12nas5', type: 'status', text: '', value: JSON.stringify({ index: statusIndex }) }
    ]
  };
}

const inventory = [
  makeInventoryItem({ id: 1, name: 'Cutlery Sets', count: 481 }),
  makeInventoryItem({ id: 2, name: 'Pens - with stylus', count: 575 }),
  makeInventoryItem({ id: 3, name: 'Charging cables', count: 80 }),
  makeInventoryItem({ id: 4, name: 'Accreditation Certificates', count: 26 }),
  makeInventoryItem({ id: 5, name: 'On Order Item', count: 0, statusIndex: STATUS.ON_ORDER }),
  makeInventoryItem({ id: 6, name: 'Discontinued Thing', count: 5, statusIndex: STATUS.DISCONTINUED })
];

const columnTitleMap = {
  num_a: 'Cutlery Sets',
  num_b: 'Pens - with stylus',
  num_c: 'July: Charging cables',
  num_d: 'Accrediation Certificates',
  num_e: 'Flyers',
  num_f: 'On Order Item',
  num_g: 'Discontinued Thing'
};

function num(id, n) {
  return { id, type: 'numbers', text: String(n), value: JSON.stringify(n) };
}

test('planDeductions matches by name and computes new counts/status', () => {
  const orderColumnValues = [
    num('num_a', 5),
    num('num_b', 10),
    num('num_c', 3),
    num('num_d', 1),
    num('num_e', 2),
    num('zero', 0),
    { id: 'text_x', type: 'text', text: 'hello', value: '"hello"' }
  ];

  const results = planDeductions({
    orderColumnValues,
    columnTitleMap,
    inventoryItems: inventory,
    threshold: 25
  });

  assert.equal(results.length, 5, 'one entry per non-zero numeric column');

  const cutlery = results.find((r) => r.title === 'Cutlery Sets');
  assert.equal(cutlery.action, 'deduct');
  assert.equal(cutlery.oldCount, 481);
  assert.equal(cutlery.newCount, 476);
  assert.equal(cutlery.newStatus, STATUS.IN_STOCK);

  const pens = results.find((r) => r.title === 'Pens - with stylus');
  assert.equal(pens.newCount, 565);

  const cables = results.find((r) => r.title === 'July: Charging cables');
  assert.equal(cables.matchedName, 'Charging cables');
  assert.equal(cables.newCount, 77);

  const accred = results.find((r) => r.title === 'Accrediation Certificates');
  assert.equal(accred.matchedName, 'Accreditation Certificates');
  assert.equal(accred.newCount, 25);
  assert.equal(accred.newStatus, STATUS.IN_STOCK, '25 is at threshold, still in stock');

  const flyers = results.find((r) => r.title === 'Flyers');
  assert.equal(flyers.action, 'unmatched');
});

test('low-stock transition is flagged', () => {
  const inv = [makeInventoryItem({ id: 1, name: 'Widgets', count: 30 })];
  const results = planDeductions({
    orderColumnValues: [num('num_w', 10)],
    columnTitleMap: { num_w: 'Widgets' },
    inventoryItems: inv,
    threshold: 25
  });
  assert.equal(results[0].newCount, 20);
  assert.equal(results[0].newStatus, STATUS.LOW_STOCK);
  assert.equal(results[0].transitionedToLowOrOut, true);
});

test('out-of-stock transition is flagged', () => {
  const inv = [makeInventoryItem({ id: 1, name: 'Widgets', count: 5 })];
  const results = planDeductions({
    orderColumnValues: [num('num_w', 10)],
    columnTitleMap: { num_w: 'Widgets' },
    inventoryItems: inv,
    threshold: 25
  });
  assert.equal(results[0].newCount, -5);
  assert.equal(results[0].newStatus, STATUS.OUT_OF_STOCK);
  assert.equal(results[0].transitionedToLowOrOut, true);
});

test('On Order and Discontinued statuses are preserved', () => {
  const orderColumnValues = [num('num_f', 1), num('num_g', 1)];
  const results = planDeductions({
    orderColumnValues,
    columnTitleMap,
    inventoryItems: inventory,
    threshold: 25
  });
  const onOrder = results.find((r) => r.title === 'On Order Item');
  assert.equal(onOrder.newStatus, STATUS.ON_ORDER);
  const disc = results.find((r) => r.title === 'Discontinued Thing');
  assert.equal(disc.newStatus, STATUS.DISCONTINUED);
});

test('buildAuditBody matches the spec format', () => {
  const results = [
    { action: 'deduct', title: 'Cutlery Sets', qty: 5, matchedName: 'Cutlery Sets', oldCount: 481, newCount: 476 },
    { action: 'deduct', title: 'Pens - with stylus', qty: 10, matchedName: 'Pens - with stylus', oldCount: 575, newCount: 565 },
    { action: 'deduct', title: 'July: Charging cables', qty: 3, matchedName: 'Charging cables', oldCount: 80, newCount: 77 },
    { action: 'unmatched', title: 'Flyers', qty: 2 }
  ];
  const body = buildAuditBody(results, new Date('2026-04-27T05:30:00Z'));
  assert.match(body, /^Stock deducted \d{4}-\d{2}-\d{2} \d{2}:\d{2} AEST/);
  assert.match(body, /- Cutlery Sets: 5 \(Cutlery Sets: 481 → 476\)/);
  assert.match(body, /- Pens - with stylus: 10 \(Pens - with stylus: 575 → 565\)/);
  assert.match(body, /- July: Charging cables: 3 \(matched 'Charging cables': 80 → 77\)/);
  assert.match(body, /- Flyers: 2 \(no inventory match — please update manually\)/);
});

test('buildLowStockBody includes label and remaining count', () => {
  const body = buildLowStockBody({
    matchedName: 'Widgets',
    newStatus: STATUS.LOW_STOCK,
    newCount: 20
  });
  assert.equal(body, 'Stock alert: Widgets now Low Stock (20 remaining). Reorder soon.');
});
