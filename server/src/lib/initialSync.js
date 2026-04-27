'use strict';

const { inventoryItemToProduct } = require('./productMapping');
const { buildMovementPayload } = require('./movements');

function planInitialSync({ inventoryItems, existingMovementProductIds = new Set(), cfg, actorMondayUserId, now = new Date() }) {
  const products = inventoryItems.map((item) => inventoryItemToProduct(item, cfg));
  const newProducts = [];
  const movementsToWrite = [];
  const skipped = [];

  for (const product of products) {
    if (existingMovementProductIds.has(product.linkedInventoryItemId)) {
      skipped.push({ productId: product.productId, reason: 'already-synced' });
      continue;
    }
    newProducts.push(product);
    movementsToWrite.push(
      buildMovementPayload(
        {
          productName: product.name,
          linkedInventoryItemId: product.linkedInventoryItemId,
          linkedOrderItemId: null,
          reason: 'initial_sync',
          delta: product.stockOnHand,
          stockBefore: 0,
          stockAfter: product.stockOnHand,
          stockInUseAfter: null,
          actorMondayUserId,
          timestamp: now
        },
        cfg
      )
    );
  }

  return {
    products,
    newProducts,
    movementsToWrite,
    skipped
  };
}

async function listExistingMovementProductIds(client, cfg) {
  const movements = await client.listBoardItems(cfg.MOVEMENTS_BOARD_ID);
  const set = new Set();
  for (const item of movements) {
    const cv = (item.column_values || []).find((c) => c.id === cfg.MOVEMENTS_PRODUCT_COLUMN_ID);
    if (!cv || !cv.value) continue;
    try {
      const parsed = JSON.parse(cv.value);
      const ids = (parsed && (parsed.linkedPulseIds || parsed.item_ids || [])) || [];
      for (const entry of ids) {
        const id = entry && (entry.linkedPulseId || entry.id || entry);
        if (id != null) set.add(String(id));
      }
    } catch (_) {}
    const reasonCv = (item.column_values || []).find((c) => c.id === cfg.MOVEMENTS_REASON_COLUMN_ID);
    if (reasonCv && reasonCv.text === 'Initial Sync') {
      // already counted via product link above
    }
  }
  return set;
}

module.exports = { planInitialSync, listExistingMovementProductIds };
