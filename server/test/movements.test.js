'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMovementPayload, REASON_LABELS } = require('../src/lib/movements');

const cfg = {
  MOVEMENTS_PRODUCT_COLUMN_ID: 'board_relation_xxx',
  MOVEMENTS_RELATED_ORDER_COLUMN_ID: 'board_relation_yyy',
  MOVEMENTS_REASON_COLUMN_ID: 'color_zzz',
  MOVEMENTS_DELTA_COLUMN_ID: 'numeric_aaa',
  MOVEMENTS_STOCK_BEFORE_COLUMN_ID: 'numeric_bbb',
  MOVEMENTS_STOCK_AFTER_COLUMN_ID: 'numeric_ccc',
  MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID: 'numeric_ddd',
  MOVEMENTS_MOVEMENT_AT_COLUMN_ID: 'date_eee',
  MOVEMENTS_ACTOR_COLUMN_ID: 'people_fff',
  MOVEMENTS_NOTE_COLUMN_ID: 'long_text_ggg'
};

test('formats an order_placed deduction correctly', () => {
  const result = buildMovementPayload(
    {
      productName: 'Cutlery Sets',
      linkedInventoryItemId: '2636427082',
      linkedOrderItemId: '9999999999',
      reason: 'order_placed',
      delta: -5,
      stockBefore: 481,
      stockAfter: 476,
      stockInUseAfter: 24,
      actorMondayUserId: '100619102',
      timestamp: new Date('2026-04-27T05:00:00Z')
    },
    cfg
  );

  assert.equal(result.itemName, 'Cutlery Sets · -5 · Order Placed');
  assert.deepEqual(result.columnValues.color_zzz, { label: 'Order Placed' });
  assert.equal(result.columnValues.numeric_aaa, '-5');
  assert.deepEqual(result.columnValues.board_relation_xxx, { item_ids: [2636427082] });
  assert.deepEqual(result.columnValues.board_relation_yyy, { item_ids: [9999999999] });
  assert.equal(result.columnValues.numeric_ddd, '24');
  assert.deepEqual(result.columnValues.date_eee, { date: '2026-04-27' });
  assert.deepEqual(result.columnValues.people_fff, {
    personsAndTeams: [{ id: 100619102, kind: 'person' }]
  });
});

test('omits stockInUseAfter and related-order for non-order reasons', () => {
  const result = buildMovementPayload(
    {
      productName: 'Tote bags',
      linkedInventoryItemId: '2636409883',
      linkedOrderItemId: null,
      reason: 'manual_correction',
      delta: -12,
      stockBefore: 462,
      stockAfter: 450,
      stockInUseAfter: null,
      actorMondayUserId: '100619102',
      note: 'Stocktake on 27 Apr — found 12 short'
    },
    cfg
  );

  assert.equal(result.columnValues.numeric_ddd, undefined);
  assert.equal(result.columnValues.long_text_ggg, 'Stocktake on 27 Apr — found 12 short');
  assert.equal(result.columnValues.board_relation_yyy, undefined);
  assert.deepEqual(result.columnValues.color_zzz, { label: 'Manual Correction' });
});

test('positive delta gets + sign in name', () => {
  const result = buildMovementPayload(
    {
      productName: 'Stickers',
      linkedInventoryItemId: '1',
      reason: 'new_shipment',
      delta: 200,
      stockBefore: 50,
      stockAfter: 250,
      actorMondayUserId: '1'
    },
    cfg
  );
  assert.equal(result.itemName, 'Stickers · +200 · New Shipment');
});

test('all REASON_LABELS map to expected human strings', () => {
  assert.equal(REASON_LABELS.order_placed, 'Order Placed');
  assert.equal(REASON_LABELS.new_shipment, 'New Shipment');
  assert.equal(REASON_LABELS.stocktake_adjustment, 'Stocktake Adjustment');
  assert.equal(REASON_LABELS.manual_correction, 'Manual Correction');
  assert.equal(REASON_LABELS.initial_sync, 'Initial Sync');
});

test('throws on unknown reason', () => {
  assert.throws(() =>
    buildMovementPayload({ productName: 'X', linkedInventoryItemId: '1', reason: 'mystery', delta: 0, stockBefore: 0, stockAfter: 0, actorMondayUserId: '1' }, cfg)
  );
});
