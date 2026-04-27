'use strict';

const express = require('express');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await req.monday.listBoardItems(req.cfg.MOVEMENTS_BOARD_ID);
    const cfg = req.cfg;
    const productFilter = req.query.productId;
    const reasonFilter = req.query.reason;

    const movements = items.map((item) => {
      const cv = (item.column_values || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
      const productLink = parseLinkedItem(cv[cfg.MOVEMENTS_PRODUCT_COLUMN_ID]);
      const orderLink = parseLinkedItem(cv[cfg.MOVEMENTS_RELATED_ORDER_COLUMN_ID]);
      return {
        movementId: item.id,
        itemName: item.name,
        productItemId: productLink,
        relatedOrderItemId: orderLink,
        reason: cv[cfg.MOVEMENTS_REASON_COLUMN_ID]?.text || null,
        delta: parseNum(cv[cfg.MOVEMENTS_DELTA_COLUMN_ID]),
        stockBefore: parseNum(cv[cfg.MOVEMENTS_STOCK_BEFORE_COLUMN_ID]),
        stockAfter: parseNum(cv[cfg.MOVEMENTS_STOCK_AFTER_COLUMN_ID]),
        stockInUseAfter: parseNum(cv[cfg.MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID]),
        movementAt: parseDate(cv[cfg.MOVEMENTS_MOVEMENT_AT_COLUMN_ID]),
        actor: cv[cfg.MOVEMENTS_ACTOR_COLUMN_ID]?.text || null,
        note: cv[cfg.MOVEMENTS_NOTE_COLUMN_ID]?.text || null
      };
    });

    let filtered = movements;
    if (productFilter) {
      filtered = filtered.filter((m) => String(m.productItemId) === String(productFilter));
    }
    if (reasonFilter) {
      filtered = filtered.filter((m) => m.reason === reasonFilter);
    }
    filtered.sort((a, b) => (b.movementAt || '').localeCompare(a.movementAt || ''));

    res.json({ movements: filtered });
  } catch (err) {
    next(err);
  }
});

function parseLinkedItem(cv) {
  if (!cv || !cv.value) return null;
  try {
    const parsed = JSON.parse(cv.value);
    const ids = parsed && (parsed.linkedPulseIds || parsed.item_ids || []);
    if (Array.isArray(ids) && ids.length) {
      const first = ids[0];
      return String(first.linkedPulseId || first.id || first);
    }
  } catch (_) {}
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
