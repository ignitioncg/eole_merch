'use strict';

const express = require('express');
const { submitOrder } = require('../lib/orderSubmission');
const { inventoryItemToProduct } = require('../lib/productMapping');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { order, actor, dryRun } = req.body || {};
    if (!order) return res.status(400).json({ error: 'order is required' });
    if (!actor || !actor.id) return res.status(400).json({ error: 'actor.id is required' });

    const items = await req.monday.listBoardItems(req.cfg.INVENTORY_BOARD_ID);
    const products = items.map((i) => inventoryItemToProduct(i, req.cfg));

    const result = await submitOrder({
      client: req.monday,
      storage: req.storage,
      cfg: req.cfg,
      order,
      actor,
      products,
      dryRun: !!dryRun
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
