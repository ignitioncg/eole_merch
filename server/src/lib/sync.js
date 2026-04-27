'use strict';

const { setOriginMarker } = require('./syncGuard');
const { STATUS_LABEL } = require('./status');

function buildInventoryColumnUpdate(updates, cfg) {
  const out = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'stockOnHand')) {
    out[cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID] = String(updates.stockOnHand);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'stockInUse')) {
    out[cfg.INVENTORY_STOCK_IN_USE_COLUMN_ID] = String(updates.stockInUse);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'statusIndex')) {
    out[cfg.INVENTORY_STATUS_COLUMN_ID] = { index: updates.statusIndex };
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'reorderPoint') && cfg.INVENTORY_REORDER_POINT_COLUMN_ID) {
    out[cfg.INVENTORY_REORDER_POINT_COLUMN_ID] =
      updates.reorderPoint == null ? '' : String(updates.reorderPoint);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'lastMovementAt') && cfg.INVENTORY_LAST_MOVEMENT_COLUMN_ID) {
    const date = updates.lastMovementAt
      ? new Date(updates.lastMovementAt).toISOString().slice(0, 10)
      : null;
    out[cfg.INVENTORY_LAST_MOVEMENT_COLUMN_ID] = date ? { date } : '';
  }
  return out;
}

async function writeInventoryUpdate({ client, storage, cfg, itemId, updates }) {
  const columnValues = buildInventoryColumnUpdate(updates, cfg);
  if (Object.keys(columnValues).length === 0) return null;
  if (storage) {
    await setOriginMarker(storage, cfg.INVENTORY_BOARD_ID, itemId, cfg.SYNC_LOOP_GUARD_SECONDS);
  }
  await client.updateColumnValues(cfg.INVENTORY_BOARD_ID, itemId, columnValues);
  return columnValues;
}

function buildOrderColumnPayload({ order, cfg, productLines, productOrderColumnIdByProduct }) {
  const cols = {};
  if (cfg.ORDERS_RECIPIENT_COLUMN_ID && order.recipientName != null) {
    cols[cfg.ORDERS_RECIPIENT_COLUMN_ID] = String(order.recipientName);
  }
  if (cfg.ORDERS_SHIPPING_ADDRESS_COLUMN_ID && order.shippingAddress != null) {
    cols[cfg.ORDERS_SHIPPING_ADDRESS_COLUMN_ID] = String(order.shippingAddress);
  }
  if (cfg.ORDERS_SENT_VIA_COLUMN_ID && order.sentVia != null) {
    cols[cfg.ORDERS_SENT_VIA_COLUMN_ID] = String(order.sentVia);
  }
  if (cfg.ORDERS_DATE_SENT_COLUMN_ID && order.dateSent) {
    cols[cfg.ORDERS_DATE_SENT_COLUMN_ID] = { date: order.dateSent };
  }
  if (cfg.ORDERS_EVENT_COLUMN_ID && order.event) {
    cols[cfg.ORDERS_EVENT_COLUMN_ID] = String(order.event);
  }
  if (cfg.ORDERS_NOTES_COLUMN_ID && order.notes) {
    cols[cfg.ORDERS_NOTES_COLUMN_ID] = String(order.notes);
  }
  if (cfg.ORDERS_CONTACT_COLUMN_ID && order.recipientContactItemId) {
    cols[cfg.ORDERS_CONTACT_COLUMN_ID] = {
      item_ids: [Number(order.recipientContactItemId)]
    };
  }
  for (const line of productLines) {
    const colId = productOrderColumnIdByProduct[line.productId];
    if (colId) {
      cols[colId] = String(line.quantity);
    }
  }
  return cols;
}

async function writeLowStockAlert({ client, cfg, linkedInventoryItemId, name, statusIndex, count, reorderPoint }) {
  const label = STATUS_LABEL[statusIndex];
  const rp = reorderPoint != null ? reorderPoint : cfg.DEFAULT_LOW_STOCK_THRESHOLD;
  const body = `Stock alert: ${name} is now ${label} (${count} remaining, reorder point ${rp}). Reorder soon.`;
  await client.createUpdate(linkedInventoryItemId, body);
}

module.exports = {
  buildInventoryColumnUpdate,
  writeInventoryUpdate,
  buildOrderColumnPayload,
  writeLowStockAlert
};
