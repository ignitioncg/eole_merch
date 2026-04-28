'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInventoryColumnUpdate, buildOrderColumnPayload } = require('../src/lib/sync');

const cfg = {
  INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'numeric_stock',
  INVENTORY_STOCK_IN_USE_COLUMN_ID: 'numeric_used',
  INVENTORY_STATUS_COLUMN_ID: 'color_status',
  INVENTORY_REORDER_POINT_COLUMN_ID: 'numeric_rp',
  INVENTORY_LAST_MOVEMENT_COLUMN_ID: 'date_last',
  ORDERS_DATE_SENT_COLUMN_ID: 'date_sent',
  ORDERS_RECIPIENT_COLUMN_ID: 'text_rec',
  ORDERS_SHIPPING_ADDRESS_COLUMN_ID: 'text_addr',
  ORDERS_SENT_VIA_COLUMN_ID: 'text_via',
  ORDERS_CONTACT_COLUMN_ID: 'rel_contact',
  ORDERS_NOTES_COLUMN_ID: 'long_notes',
  ORDERS_EVENT_COLUMN_ID: 'text_event'
};

test('buildInventoryColumnUpdate strings numeric values and indexes status', () => {
  const out = buildInventoryColumnUpdate(
    { stockOnHand: 476, stockInUse: 29, statusIndex: 1, reorderPoint: 25, lastMovementAt: '2026-04-27T05:00:00Z' },
    cfg
  );
  assert.equal(out.numeric_stock, '476');
  assert.equal(out.numeric_used, '29');
  assert.deepEqual(out.color_status, { index: 1 });
  assert.equal(out.numeric_rp, '25');
  assert.deepEqual(out.date_last, { date: '2026-04-27' });
});

test('buildInventoryColumnUpdate omits keys not present', () => {
  const out = buildInventoryColumnUpdate({ stockOnHand: 100 }, cfg);
  assert.deepEqual(Object.keys(out), ['numeric_stock']);
});

test('buildOrderColumnPayload populates per-product quantity columns and recipient', () => {
  const order = {
    recipientName: 'Brittny',
    recipientContactItemId: '12345',
    shippingAddress: '1 Test St',
    sentVia: 'Auspost',
    dateSent: '2026-04-27',
    event: 'Conference',
    notes: 'urgent'
  };
  const productLines = [
    { productId: '1', quantity: 5 },
    { productId: '2', quantity: 10 }
  ];
  const productOrderColumnIdByProduct = { 1: 'numbers_p1', 2: 'numbers_p2' };
  const cols = buildOrderColumnPayload({ order, cfg, productLines, productOrderColumnIdByProduct });
  assert.equal(cols.text_rec, 'Brittny');
  assert.equal(cols.text_addr, '1 Test St');
  assert.equal(cols.text_via, 'Auspost');
  assert.deepEqual(cols.date_sent, { date: '2026-04-27' });
  assert.equal(cols.text_event, 'Conference');
  assert.equal(cols.long_notes, 'urgent');
  assert.deepEqual(cols.rel_contact, { item_ids: [12345] });
  assert.equal(cols.numbers_p1, '5');
  assert.equal(cols.numbers_p2, '10');
});
