'use strict';

const express = require('express');
const { loadConfig, saveConfig } = require('../lib/config');
const { ensureInventoryColumns } = require('../lib/installer');
const { planInitialSync, listExistingMovementProductIds } = require('../lib/initialSync');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const dryRun = req.body && req.body.dryRun === true;
    const actorMondayUserId = (req.body && req.body.actor && req.body.actor.id) || (await req.monday.getMe()).id;

    let cfg = await loadConfig(req.storage);

    cfg = await ensureInventoryColumns(req.monday, cfg, {
      saveConfig: (patch) => saveConfig(req.storage, patch)
    });

    const inventoryItems = await req.monday.listBoardItems(cfg.INVENTORY_BOARD_ID);
    const existingMovementProductIds = await listExistingMovementProductIds(req.monday, cfg);
    const plan = planInitialSync({
      inventoryItems,
      existingMovementProductIds,
      cfg,
      actorMondayUserId
    });

    if (dryRun) {
      return res.json({ dryRun: true, plan, cfg });
    }

    for (const m of plan.movementsToWrite) {
      await req.monday.createItem({
        boardId: cfg.MOVEMENTS_BOARD_ID,
        itemName: m.itemName,
        columnValues: m.columnValues
      });
    }

    res.json({
      ok: true,
      productsScanned: plan.products.length,
      productsNewlySynced: plan.newProducts.length,
      productsSkipped: plan.skipped.length
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
