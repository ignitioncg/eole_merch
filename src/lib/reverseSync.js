'use strict';

const { recalcStatus, transitionedToLowOrOut, STATUS_LABEL } = require('./status');
const { buildMovementPayload } = require('./movements');
const { isEcho } = require('./syncGuard');

const TRACKED_FIELDS = [
  'INVENTORY_STOCK_ON_HAND_COLUMN_ID',
  'INVENTORY_STOCK_IN_USE_COLUMN_ID',
  'INVENTORY_STATUS_COLUMN_ID',
  'INVENTORY_REORDER_POINT_COLUMN_ID'
];

function eventColumnToField(columnId, cfg) {
  for (const field of TRACKED_FIELDS) {
    if (cfg[field] && cfg[field] === columnId) return field;
  }
  return null;
}

async function planReverseSync({ event, productBefore, cfg, storage }) {
  if (!event || !event.boardId || !event.pulseId) {
    return { skip: true, reason: 'malformed-event' };
  }
  if (String(event.boardId) !== String(cfg.INVENTORY_BOARD_ID)) {
    return { skip: true, reason: 'not-inventory-board' };
  }
  const field = eventColumnToField(event.columnId, cfg);
  if (!field) {
    return { skip: true, reason: 'untracked-column' };
  }
  if (storage && (await isEcho(storage, event.boardId, event.pulseId, cfg.SYNC_LOOP_GUARD_SECONDS))) {
    return { skip: true, reason: 'echo' };
  }
  if (!productBefore) {
    return { skip: true, reason: 'no-matching-product' };
  }

  const updates = {};
  let movement = null;

  if (field === 'INVENTORY_STOCK_ON_HAND_COLUMN_ID') {
    const newValue = readNumberFromEvent(event);
    if (newValue == null) return { skip: true, reason: 'no-numeric-value' };
    updates.stockOnHand = newValue;
    const stockBefore = productBefore.stockOnHand;
    const stockAfter = newValue;
    const delta = stockAfter - stockBefore;
    const newStatus = recalcStatus({
      currentIndex: productBefore.statusIndex,
      newCount: stockAfter,
      reorderPoint: productBefore.reorderPoint,
      defaultThreshold: cfg.DEFAULT_LOW_STOCK_THRESHOLD
    });
    updates.statusIndex = newStatus;
    if (delta !== 0) {
      movement = {
        productName: productBefore.name,
        linkedInventoryItemId: productBefore.linkedInventoryItemId,
        linkedOrderItemId: null,
        reason: 'manual_correction',
        delta,
        stockBefore,
        stockAfter,
        stockInUseAfter: null,
        actorMondayUserId: event.userId,
        timestamp: new Date(),
        note: 'Edited directly on the Inventory board'
      };
    }
    updates.transitionedToLowOrOut = transitionedToLowOrOut(productBefore.statusIndex, newStatus);
    updates.newStatusLabel = STATUS_LABEL[newStatus];
    updates.oldStatusLabel = STATUS_LABEL[productBefore.statusIndex];
  } else if (field === 'INVENTORY_STOCK_IN_USE_COLUMN_ID') {
    const newValue = readNumberFromEvent(event);
    if (newValue == null) return { skip: true, reason: 'no-numeric-value' };
    updates.stockInUse = newValue;
  } else if (field === 'INVENTORY_REORDER_POINT_COLUMN_ID') {
    const newValue = readNumberFromEvent(event);
    updates.reorderPoint = newValue;
    const newStatus = recalcStatus({
      currentIndex: productBefore.statusIndex,
      newCount: productBefore.stockOnHand,
      reorderPoint: newValue,
      defaultThreshold: cfg.DEFAULT_LOW_STOCK_THRESHOLD
    });
    updates.statusIndex = newStatus;
  } else if (field === 'INVENTORY_STATUS_COLUMN_ID') {
    const idx = readStatusFromEvent(event);
    if (idx != null) updates.statusIndex = idx;
  }

  return {
    skip: false,
    field,
    updates,
    movement,
    actor: event.userId
  };
}

function readNumberFromEvent(event) {
  const v = event.value;
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.value === 'string') {
    const n = Number(v.value);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof v.value === 'number') return v.value;
  return null;
}

function readStatusFromEvent(event) {
  const v = event.value;
  if (!v) return null;
  if (typeof v.index === 'number') return v.index;
  if (v.value != null && typeof v.value === 'object' && typeof v.value.index === 'number') return v.value.index;
  return null;
}

module.exports = {
  planReverseSync,
  TRACKED_FIELDS,
  eventColumnToField
};
