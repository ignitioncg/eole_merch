'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { planInitialSync } = require('../src/lib/initialSync');

const cfg = {
  INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'numeric_mm121bdf',
  INVENTORY_STOCK_IN_USE_COLUMN_ID: 'numeric_mm2taffr',
  INVENTORY_STATUS_COLUMN_ID: 'color_mm12nas5',
  INVENTORY_REORDER_POINT_COLUMN_ID: '',
  INVENTORY_LAST_MOVEMENT_COLUMN_ID: '',
  MOVEMENTS_PRODUCT_COLUMN_ID: 'p',
  MOVEMENTS_RELATED_ORDER_COLUMN_ID: 'o',
  MOVEMENTS_REASON_COLUMN_ID: 'r',
  MOVEMENTS_DELTA_COLUMN_ID: 'd',
  MOVEMENTS_STOCK_BEFORE_COLUMN_ID: 'sb',
  MOVEMENTS_STOCK_AFTER_COLUMN_ID: 'sa',
  MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID: 'sia',
  MOVEMENTS_MOVEMENT_AT_COLUMN_ID: 'da',
  MOVEMENTS_ACTOR_COLUMN_ID: 'ac',
  MOVEMENTS_NOTE_COLUMN_ID: 'n'
};

function makeItem(id, name, stock) {
  return {
    id,
    name,
    column_values: [
      { id: 'numeric_mm121bdf', type: 'numbers', text: String(stock), value: JSON.stringify(stock) },
      { id: 'color_mm12nas5', type: 'status', text: 'In Stock', value: JSON.stringify({ index: 1 }) }
    ]
  };
}

test('initial sync creates one Product and one initial_sync movement per inventory item', () => {
  const items = [makeItem('1', 'Cutlery Sets', 481), makeItem('2', 'Tote bags', 462)];
  const plan = planInitialSync({
    inventoryItems: items,
    existingMovementProductIds: new Set(),
    cfg,
    actorMondayUserId: '100619102'
  });
  assert.equal(plan.products.length, 2);
  assert.equal(plan.newProducts.length, 2);
  assert.equal(plan.movementsToWrite.length, 2);
  assert.equal(plan.skipped.length, 0);
  assert.equal(plan.movementsToWrite[0].itemName, 'Cutlery Sets · +481 · Initial Sync');
});

test('initial sync is idempotent — items already mirrored are skipped', () => {
  const items = [makeItem('1', 'Cutlery Sets', 481), makeItem('2', 'Tote bags', 462), makeItem('3', 'Brand New', 100)];
  const plan = planInitialSync({
    inventoryItems: items,
    existingMovementProductIds: new Set(['1', '2']),
    cfg,
    actorMondayUserId: '100619102'
  });
  assert.equal(plan.newProducts.length, 1);
  assert.equal(plan.newProducts[0].productId, '3');
  assert.equal(plan.movementsToWrite.length, 1);
  assert.equal(plan.skipped.length, 2);
});
