'use strict';

const express = require('express');
const { inventoryItemToProduct } = require('../lib/productMapping');
const { STATUS_SORT_ORDER } = require('../lib/status');
const { planManualAdjustment } = require('../lib/deduction');
const { buildMovementPayload } = require('../lib/movements');
const { writeInventoryUpdate, writeLowStockAlert } = require('../lib/sync');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await req.monday.listBoardItems(req.cfg.INVENTORY_BOARD_ID);
    const products = items.map((i) => inventoryItemToProduct(i, req.cfg));
    products.sort((a, b) => {
      const sa = STATUS_SORT_ORDER[a.statusIndex] ?? 99;
      const sb = STATUS_SORT_ORDER[b.statusIndex] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

router.post('/:productId/adjust', async (req, res, next) => {
  try {
    const { newStockOnHand, reason, note, actor } = req.body || {};
    if (typeof newStockOnHand !== 'number') {
      return res.status(400).json({ error: 'newStockOnHand must be a number' });
    }
    const allowedReasons = ['stocktake_adjustment', 'new_shipment', 'manual_correction'];
    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({ error: `reason must be one of ${allowedReasons.join(', ')}` });
    }
    const item = await req.monday.getItem(req.params.productId);
    if (!item) return res.status(404).json({ error: 'product not found' });
    const product = inventoryItemToProduct(item, req.cfg);

    const adj = planManualAdjustment({
      product,
      newStockOnHand,
      reason,
      note,
      actor,
      cfg: req.cfg
    });

    const movement = buildMovementPayload(
      {
        productName: adj.productName,
        linkedInventoryItemId: adj.linkedInventoryItemId,
        linkedOrderItemId: null,
        reason,
        delta: adj.delta,
        stockBefore: adj.stockBefore,
        stockAfter: adj.stockAfter,
        stockInUseAfter: null,
        actorMondayUserId: actor?.id,
        timestamp: new Date(adj.timestamp),
        note
      },
      req.cfg
    );
    await req.monday.createItem({
      boardId: req.cfg.MOVEMENTS_BOARD_ID,
      itemName: movement.itemName,
      columnValues: movement.columnValues
    });

    await writeInventoryUpdate({
      client: req.monday,
      storage: req.storage,
      cfg: req.cfg,
      itemId: adj.linkedInventoryItemId,
      updates: {
        stockOnHand: adj.stockAfter,
        statusIndex: adj.newStatus,
        lastMovementAt: adj.timestamp
      }
    });

    if (adj.transitionedToLowOrOut) {
      await writeLowStockAlert({
        client: req.monday,
        cfg: req.cfg,
        linkedInventoryItemId: adj.linkedInventoryItemId,
        name: adj.productName,
        statusIndex: adj.newStatus,
        count: adj.stockAfter,
        reorderPoint: product.reorderPoint
      });
    }

    res.json({ ok: true, adjustment: adj });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
