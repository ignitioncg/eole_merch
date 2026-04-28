'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { setOriginMarker, isEcho, markerKey } = require('../src/lib/syncGuard');
const { InMemoryStorage } = require('../src/lib/storage');

test('marker key format', () => {
  assert.equal(markerKey('123', '456'), 'sync-guard:123:456');
});

test('echo detected within ttl window', async () => {
  const s = new InMemoryStorage();
  await setOriginMarker(s, '123', '456', 3);
  assert.equal(await isEcho(s, '123', '456', 3), true);
});

test('echo NOT detected for different item', async () => {
  const s = new InMemoryStorage();
  await setOriginMarker(s, '123', '456', 3);
  assert.equal(await isEcho(s, '123', '999', 3), false);
});

test('echo NOT detected after expiry', async () => {
  const s = new InMemoryStorage();
  await setOriginMarker(s, '123', '456', 0); // expires immediately
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await isEcho(s, '123', '456', 0), false);
});

test('reverse-sync ignores echoed change within window', async () => {
  const { planReverseSync } = require('../src/lib/reverseSync');
  const s = new InMemoryStorage();
  const cfg = {
    INVENTORY_BOARD_ID: '5027265627',
    INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'numeric_mm121bdf',
    INVENTORY_STATUS_COLUMN_ID: 'color_mm12nas5',
    SYNC_LOOP_GUARD_SECONDS: 3,
    DEFAULT_LOW_STOCK_THRESHOLD: 25
  };
  await setOriginMarker(s, cfg.INVENTORY_BOARD_ID, '888', cfg.SYNC_LOOP_GUARD_SECONDS);

  const event = {
    boardId: cfg.INVENTORY_BOARD_ID,
    pulseId: '888',
    columnId: cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID,
    value: { value: '460' },
    userId: '100619102'
  };
  const productBefore = { stockOnHand: 481, statusIndex: 1, reorderPoint: null, name: 'X', linkedInventoryItemId: '888' };
  const plan = await planReverseSync({ event, productBefore, cfg, storage: s });
  assert.equal(plan.skip, true);
  assert.equal(plan.reason, 'echo');
});

test('reverse-sync produces manual_correction movement on real edit', async () => {
  const { planReverseSync } = require('../src/lib/reverseSync');
  const s = new InMemoryStorage();
  const cfg = {
    INVENTORY_BOARD_ID: '5027265627',
    INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'numeric_mm121bdf',
    INVENTORY_STATUS_COLUMN_ID: 'color_mm12nas5',
    SYNC_LOOP_GUARD_SECONDS: 3,
    DEFAULT_LOW_STOCK_THRESHOLD: 25
  };
  const event = {
    boardId: cfg.INVENTORY_BOARD_ID,
    pulseId: '888',
    columnId: cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID,
    value: { value: '450' },
    userId: '100619102'
  };
  const productBefore = { stockOnHand: 462, statusIndex: 1, reorderPoint: null, name: 'Tote bags', linkedInventoryItemId: '888' };
  const plan = await planReverseSync({ event, productBefore, cfg, storage: s });
  assert.equal(plan.skip, false);
  assert.equal(plan.movement.reason, 'manual_correction');
  assert.equal(plan.movement.delta, -12);
  assert.equal(plan.movement.stockBefore, 462);
  assert.equal(plan.movement.stockAfter, 450);
  assert.equal(plan.movement.actorMondayUserId, '100619102');
});
