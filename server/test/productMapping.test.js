'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveProductsToOrderColumns, inventoryItemToProduct } = require('../src/lib/productMapping');

const cfg = {
  INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'numeric_mm121bdf',
  INVENTORY_STOCK_IN_USE_COLUMN_ID: 'numeric_mm2taffr',
  INVENTORY_STATUS_COLUMN_ID: 'color_mm12nas5',
  INVENTORY_REORDER_POINT_COLUMN_ID: '',
  INVENTORY_LAST_MOVEMENT_COLUMN_ID: ''
};

test('inventoryItemToProduct extracts stock + status', () => {
  const item = {
    id: '101',
    name: 'Cutlery Sets',
    column_values: [
      { id: 'numeric_mm121bdf', type: 'numbers', text: '481', value: '481' },
      { id: 'numeric_mm2taffr', type: 'numbers', text: '24', value: '24' },
      { id: 'color_mm12nas5', type: 'status', text: 'In Stock', value: JSON.stringify({ index: 1 }) }
    ]
  };
  const product = inventoryItemToProduct(item, cfg);
  assert.equal(product.productId, '101');
  assert.equal(product.name, 'Cutlery Sets');
  assert.equal(product.stockOnHand, 481);
  assert.equal(product.stockInUse, 24);
  assert.equal(product.statusIndex, 1);
  assert.equal(product.statusKey, 'InStock');
});

test('resolveProductsToOrderColumns uses fuzzy matcher and ignores non-numeric columns', () => {
  const products = [
    { productId: '1', name: 'Cutlery Sets' },
    { productId: '2', name: 'Charging cables' },
    { productId: '3', name: 'Helicopters' }
  ];
  const orderColumns = [
    { id: 'numbers_a', title: 'Cutlery Sets', type: 'numbers' },
    { id: 'numbers_b', title: 'July: Charging cables', type: 'numbers' },
    { id: 'text_z', title: 'Notes', type: 'long_text' }
  ];
  const out = resolveProductsToOrderColumns(products, orderColumns);
  assert.equal(out.orderColumnByProductId['1'], 'numbers_a');
  assert.equal(out.orderColumnByProductId['2'], 'numbers_b');
  assert.deepEqual(out.unresolvedProductIds, ['3']);
});
