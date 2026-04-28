'use strict';

const REASON_LABELS = Object.freeze({
  order_placed: 'Order Placed',
  new_shipment: 'New Shipment',
  stocktake_adjustment: 'Stocktake Adjustment',
  manual_correction: 'Manual Correction',
  initial_sync: 'Initial Sync'
});

function formatToday(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function buildMovementPayload(movement, cfg) {
  const reasonLabel = REASON_LABELS[movement.reason];
  if (!reasonLabel) throw new Error(`Unknown movement reason: ${movement.reason}`);

  const sign = movement.delta >= 0 ? '+' : '';
  const itemName = `${movement.productName} · ${sign}${movement.delta} · ${reasonLabel}`;

  const columnValues = {
    [cfg.MOVEMENTS_PRODUCT_COLUMN_ID]: {
      item_ids: [Number(movement.linkedInventoryItemId)]
    },
    [cfg.MOVEMENTS_REASON_COLUMN_ID]: { label: reasonLabel },
    [cfg.MOVEMENTS_DELTA_COLUMN_ID]: String(movement.delta),
    [cfg.MOVEMENTS_STOCK_BEFORE_COLUMN_ID]: String(movement.stockBefore),
    [cfg.MOVEMENTS_STOCK_AFTER_COLUMN_ID]: String(movement.stockAfter),
    [cfg.MOVEMENTS_MOVEMENT_AT_COLUMN_ID]: { date: formatToday(movement.timestamp) },
    [cfg.MOVEMENTS_ACTOR_COLUMN_ID]: {
      personsAndTeams: [{ id: Number(movement.actorMondayUserId), kind: 'person' }]
    }
  };

  if (movement.linkedOrderItemId) {
    columnValues[cfg.MOVEMENTS_RELATED_ORDER_COLUMN_ID] = {
      item_ids: [Number(movement.linkedOrderItemId)]
    };
  }

  if (movement.stockInUseAfter !== null && movement.stockInUseAfter !== undefined) {
    columnValues[cfg.MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID] = String(movement.stockInUseAfter);
  }

  if (movement.note) {
    columnValues[cfg.MOVEMENTS_NOTE_COLUMN_ID] = String(movement.note);
  }

  return { itemName, columnValues };
}

module.exports = { buildMovementPayload, REASON_LABELS };
