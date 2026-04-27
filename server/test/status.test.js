'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { STATUS, recalcStatus, transitionedToLowOrOut } = require('../src/lib/status');

test('plenty of stock → In Stock', () => {
  assert.equal(
    recalcStatus({ currentIndex: STATUS.IN_STOCK, newCount: 100, reorderPoint: null, defaultThreshold: 25 }),
    STATUS.IN_STOCK
  );
});

test('below default threshold → Low Stock', () => {
  assert.equal(
    recalcStatus({ currentIndex: STATUS.IN_STOCK, newCount: 24, reorderPoint: null, defaultThreshold: 25 }),
    STATUS.LOW_STOCK
  );
});

test('per-product reorder point overrides default', () => {
  assert.equal(
    recalcStatus({ currentIndex: STATUS.IN_STOCK, newCount: 30, reorderPoint: 50, defaultThreshold: 25 }),
    STATUS.LOW_STOCK
  );
  assert.equal(
    recalcStatus({ currentIndex: STATUS.IN_STOCK, newCount: 30, reorderPoint: 10, defaultThreshold: 25 }),
    STATUS.IN_STOCK
  );
});

test('zero or negative → Out of Stock', () => {
  assert.equal(
    recalcStatus({ currentIndex: STATUS.IN_STOCK, newCount: 0, reorderPoint: 25, defaultThreshold: 25 }),
    STATUS.OUT_OF_STOCK
  );
  assert.equal(
    recalcStatus({ currentIndex: STATUS.IN_STOCK, newCount: -5, reorderPoint: null, defaultThreshold: 25 }),
    STATUS.OUT_OF_STOCK
  );
});

test('Discontinued lockout — never auto-changes', () => {
  for (const newCount of [-10, 0, 5, 50, 1000]) {
    assert.equal(
      recalcStatus({ currentIndex: STATUS.DISCONTINUED, newCount, reorderPoint: null, defaultThreshold: 25 }),
      STATUS.DISCONTINUED
    );
  }
});

test('On Order lockout — never auto-changes', () => {
  for (const newCount of [-10, 0, 5, 50, 1000]) {
    assert.equal(
      recalcStatus({ currentIndex: STATUS.ON_ORDER, newCount, reorderPoint: null, defaultThreshold: 25 }),
      STATUS.ON_ORDER
    );
  }
});

test('transitionedToLowOrOut detects entry into Low/Out from In Stock', () => {
  assert.equal(transitionedToLowOrOut(STATUS.IN_STOCK, STATUS.LOW_STOCK), true);
  assert.equal(transitionedToLowOrOut(STATUS.IN_STOCK, STATUS.OUT_OF_STOCK), true);
  assert.equal(transitionedToLowOrOut(STATUS.LOW_STOCK, STATUS.OUT_OF_STOCK), false, 'low→out is still low/out before');
  assert.equal(transitionedToLowOrOut(STATUS.LOW_STOCK, STATUS.LOW_STOCK), false);
  assert.equal(transitionedToLowOrOut(STATUS.OUT_OF_STOCK, STATUS.IN_STOCK), false);
});
