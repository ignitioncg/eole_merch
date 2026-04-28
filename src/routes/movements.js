'use strict';

const express = require('express');
const { planRevert } = require('../lib/deduction');
const { inventoryItemToProduct } = require('../lib/productMapping');
const { buildMovementPayload } = require('../lib/movements');
const { writeInventoryUpdate } = require('../lib/sync');
const { findMatch } = require('../lib/matcher');

const router = express.Router();

function parseMovement(item, cfg) {
  const cv = (item.column_values || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
  return {
    movementId: item.id,
    itemName: item.name,
    productItemId: parseLinkedItem(cv[cfg.MOVEMENTS_PRODUCT_COLUMN_ID]),
    relatedOrderItemId: parseLinkedItem(cv[cfg.MOVEMENTS_RELATED_ORDER_COLUMN_ID]),
    reason: cv[cfg.MOVEMENTS_REASON_COLUMN_ID]?.text || null,
    delta: parseNum(cv[cfg.MOVEMENTS_DELTA_COLUMN_ID]),
    stockBefore: parseNum(cv[cfg.MOVEMENTS_STOCK_BEFORE_COLUMN_ID]),
    stockAfter: parseNum(cv[cfg.MOVEMENTS_STOCK_AFTER_COLUMN_ID]),
    stockInUseAfter: parseNum(cv[cfg.MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID]),
    movementAt: parseDate(cv[cfg.MOVEMENTS_MOVEMENT_AT_COLUMN_ID]),
    actor: cv[cfg.MOVEMENTS_ACTOR_COLUMN_ID]?.text || null,
    note: cv[cfg.MOVEMENTS_NOTE_COLUMN_ID]?.text || null
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await req.monday.listBoardItems(req.cfg.MOVEMENTS_BOARD_ID);
    const productFilter = req.query.productId;
    const reasonFilter = req.query.reason;

    let movements = items.map((item) => parseMovement(item, req.cfg));
    if (productFilter) {
      movements = movements.filter((m) => String(m.productItemId) === String(productFilter));
    }
    if (reasonFilter) {
      movements = movements.filter((m) => m.reason === reasonFilter);
    }
    movements.sort((a, b) => (b.movementAt || '').localeCompare(a.movementAt || ''));

    res.json({ movements });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revert', async (req, res, next) => {
  try {
    const movementId = req.params.id;
    const cfg = req.cfg;

    const movementItem = await req.monday.getItem(movementId);
    if (!movementItem) return res.status(404).json({ error: 'Movement not found' });
    const movement = parseMovement(movementItem, cfg);

    let productItemId = movement.productItemId;
    let productLookupMethod = 'linked';

    // Fallback: if the board_relation link is empty (some legacy
    // movements were created without it), parse the product name out
    // of the movement's title ("<Product> · <delta> · <Reason>") and
    // fuzzy-match it against the inventory board.
    if (!productItemId && movementItem.name) {
      const namePart = movementItem.name.split('·')[0]?.trim();
      if (namePart) {
        const inventory = await req.monday.listBoardItems(cfg.INVENTORY_BOARD_ID);
        const match = findMatch(namePart, inventory, (i) => i.name);
        if (match) {
          productItemId = String(match.entry.id);
          productLookupMethod = `name match ("${namePart}" → "${match.entry.name}")`;
        }
      }
    }

    if (!productItemId) {
      const cv = (movementItem.column_values || []).find((c) => c.id === cfg.MOVEMENTS_PRODUCT_COLUMN_ID);
      console.error(`[revert] no linked product on ${movementId}. Product col id=${cfg.MOVEMENTS_PRODUCT_COLUMN_ID}, raw value=${cv?.value}, text=${cv?.text}, item name=${movementItem.name}`);
      return res.status(400).json({
        error: 'Movement has no linked product — cannot revert. Open the movement on the Stock Movements board and re-link the Product, then try again.',
        debug: {
          movementId,
          itemName: movementItem.name,
          productColumnId: cfg.MOVEMENTS_PRODUCT_COLUMN_ID,
          rawValue: cv?.value || null,
          rawText: cv?.text || null
        }
      });
    }

    const productItem = await req.monday.getItem(productItemId);
    if (!productItem) {
      return res.status(404).json({ error: 'The product this movement was for no longer exists on the inventory board.' });
    }
    const product = inventoryItemToProduct(productItem, cfg);

    const plan = planRevert({ movement, product, cfg });
    if (!plan.ok) return res.status(400).json({ error: plan.error });

    if (productLookupMethod !== 'linked') {
      plan.note += ` [resolved via ${productLookupMethod}]`;
    }

    const actorId = (req.body && req.body.actor && req.body.actor.id) || (await req.monday.getMe()).id;

    const newMovement = buildMovementPayload(
      {
        productName: plan.productName,
        linkedInventoryItemId: plan.linkedInventoryItemId,
        linkedOrderItemId: null,
        reason: 'manual_correction',
        delta: plan.delta,
        stockBefore: plan.stockBefore,
        stockAfter: plan.stockAfter,
        stockInUseAfter: plan.wasOrder ? plan.stockInUseAfter : null,
        actorMondayUserId: actorId,
        timestamp: new Date(),
        note: plan.note
      },
      cfg
    );
    const created = await req.monday.createItem({
      boardId: cfg.MOVEMENTS_BOARD_ID,
      itemName: newMovement.itemName,
      columnValues: newMovement.columnValues
    });

    const updates = {
      stockOnHand: plan.stockAfter,
      statusIndex: plan.newStatus,
      lastMovementAt: new Date().toISOString()
    };
    if (plan.wasOrder) updates.stockInUse = plan.stockInUseAfter;

    await writeInventoryUpdate({
      client: req.monday,
      storage: req.storage,
      cfg,
      itemId: plan.linkedInventoryItemId,
      updates
    });

    res.json({
      ok: true,
      revertedMovementId: movementId,
      compensatingMovementId: created?.id,
      productName: plan.productName,
      delta: plan.delta,
      stockBefore: plan.stockBefore,
      stockAfter: plan.stockAfter,
      newStatus: plan.newStatus
    });
  } catch (err) {
    next(err);
  }
});

function parseLinkedItem(cv) {
  if (!cv) return null;
  // Monday's board_relation column can return any of these shapes
  // depending on API version, write path, and whether it was set via
  // `item_ids` or `linkedPulseIds`.
  const shapes = [];
  if (cv.value) {
    try { shapes.push(JSON.parse(cv.value)); } catch (_) {}
  }
  if (cv.linked_item_ids) shapes.push({ linked_item_ids: cv.linked_item_ids });
  if (cv.linked_items) shapes.push({ linked_items: cv.linked_items });

  for (const parsed of shapes) {
    if (!parsed) continue;
    const candidates = [
      parsed.linkedPulseIds,
      parsed.linked_pulse_ids,
      parsed.item_ids,
      parsed.linkedItemIds,
      parsed.linked_item_ids,
      parsed.linked_items
    ].filter(Array.isArray);
    for (const arr of candidates) {
      if (!arr.length) continue;
      const first = arr[0];
      if (first == null) continue;
      if (typeof first === 'number' || typeof first === 'string') return String(first);
      if (typeof first === 'object') {
        const id = first.linkedPulseId
          || first.linked_pulse_id
          || first.id
          || first.item_id
          || first.itemId;
        if (id != null) return String(id);
      }
    }
  }
  return null;
}

function parseNum(cv) {
  if (!cv) return null;
  if (cv.text == null || cv.text === '') return null;
  const n = Number(cv.text);
  return Number.isNaN(n) ? null : n;
}

function parseDate(cv) {
  if (!cv) return null;
  if (cv.text) return cv.text;
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed && parsed.date) return parsed.date;
    } catch (_) {}
  }
  return null;
}

module.exports = router;
