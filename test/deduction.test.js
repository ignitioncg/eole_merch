'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planOrderSubmission, planManualAdjustment } = require('../src/lib/deduction');
const { STATUS } = require('../src/lib/status');

const cfg = { DEFAULT_LOW_STOCK_THRESHOLD: 25 };

const products = [
  { productId: '1', name: 'Cutlery Sets', stockOnHand: 481, stockInUse: 24, reorderPoint: null, statusIndex: STATUS.IN_STOCK, linkedInventoryItemId: '1' },
  { productId: '2', name: 'Pens - with stylus', stockOnHand: 575, stockInUse: 100, reorderPoint: null, statusIndex: STATUS.IN_STOCK, linkedInventoryItemId: '2' },
  { productId: '3', name: 'Charging cables', stockOnHand: 80, stockInUse: 5, reorderPoint: null, statusIndex: STATUS.IN_STOCK, linkedInventoryItemId: '3' },
  { productId: '4', name: 'Discontinued Item', stockOnHand: 5, stockInUse: 0, reorderPoint: null, statusIndex: STATUS.DISCONTINUED, linkedInventoryItemId: '4' },
  { productId: '5', name: 'On Order Item', stockOnHand: 0, stockInUse: 0, reorderPoint: null, statusIndex: STATUS.ON_ORDER, linkedInventoryItemId: '5' },
  { productId: '6', name: 'Almost Out', stockOnHand: 30, stockInUse: 5, reorderPoint: null, statusIndex: STATUS.IN_STOCK, linkedInventoryItemId: '6' }
];

test('order with three lines: cumulative stockInUse, recalc status', () => {
  const order = {
    lines: [
      { productId: '1', quantity: 5 },
      { productId: '2', quantity: 10 },
      { productId: '3', quantity: 3 }
    ]
  };
  const plan = planOrderSubmission({ order, products, cfg });
  assert.equal(plan.ok, true);
  assert.equal(plan.linePlans.length, 3);

  const cutlery = plan.linePlans.find((l) => l.productId === '1');
  assert.equal(cutlery.stockBefore, 481);
  assert.equal(cutlery.stockAfter, 476);
  assert.equal(cutlery.stockInUseBefore, 24);
  assert.equal(cutlery.stockInUseAfter, 29);
  assert.equal(cutlery.newStatus, STATUS.IN_STOCK);

  const cables = plan.linePlans.find((l) => l.productId === '3');
  assert.equal(cables.stockAfter, 77);
  assert.equal(cables.stockInUseAfter, 8);
});

test('On Order and Discontinued lockouts are preserved through deduction', () => {
  const order = { lines: [{ productId: '4', quantity: 1 }, { productId: '5', quantity: 1 }] };
  const plan = planOrderSubmission({ order, products, cfg });
  const disc = plan.linePlans.find((l) => l.productId === '4');
  const onOrd = plan.linePlans.find((l) => l.productId === '5');
  assert.equal(disc.newStatus, STATUS.DISCONTINUED);
  assert.equal(onOrd.newStatus, STATUS.ON_ORDER);
});

test('over-quantity triggers warning, does not block', () => {
  const order = { lines: [{ productId: '6', quantity: 1000 }] };
  const plan = planOrderSubmission({ order, products, cfg });
  assert.equal(plan.ok, true);
  assert.ok(plan.warnings.some((w) => /requests 1000.*30 on hand/.test(w)));
  assert.equal(plan.linePlans[0].stockAfter, -970);
  assert.equal(plan.linePlans[0].newStatus, STATUS.OUT_OF_STOCK);
});

test('zero or missing quantity blocks', () => {
  const plan = planOrderSubmission({
    order: { lines: [{ productId: '1', quantity: 0 }] },
    products,
    cfg
  });
  assert.equal(plan.ok, false);
});

test('empty lines blocks', () => {
  const plan = planOrderSubmission({ order: { lines: [] }, products, cfg });
  assert.equal(plan.ok, false);
});

test('unknown product blocks that line', () => {
  const plan = planOrderSubmission({
    order: { lines: [{ productId: 'ghost', quantity: 1 }] },
    products,
    cfg
  });
  assert.equal(plan.ok, false);
});

test('deduction triggers low-stock transition flag', () => {
  const plan = planOrderSubmission({
    order: { lines: [{ productId: '6', quantity: 10 }] }, // 30→20, threshold 25
    products,
    cfg
  });
  assert.equal(plan.linePlans[0].newStatus, STATUS.LOW_STOCK);
  assert.equal(plan.linePlans[0].transitionedToLowOrOut, true);
});

test('planManualAdjustment computes delta and recalcs status', () => {
  const product = products[0];
  const adj = planManualAdjustment({
    product,
    newStockOnHand: 460,
    reason: 'stocktake_adjustment',
    note: 'Stocktake',
    actor: { id: '100' },
    cfg
  });
  assert.equal(adj.delta, -21);
  assert.equal(adj.stockBefore, 481);
  assert.equal(adj.stockAfter, 460);
  assert.equal(adj.newStatus, STATUS.IN_STOCK);
  assert.equal(adj.reason, 'stocktake_adjustment');
});
