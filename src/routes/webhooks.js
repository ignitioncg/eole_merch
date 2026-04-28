'use strict';

const express = require('express');
const { planReverseSync } = require('../lib/reverseSync');
const { inventoryItemToProduct } = require('../lib/productMapping');
const { buildMovementPayload } = require('../lib/movements');
const { writeInventoryUpdate } = require('../lib/sync');

const router = express.Router();

router.post('/inventory', async (req, res, next) => {
  try {
    const payload = req.body || {};
    if (payload.challenge) {
      return res.json({ challenge: payload.challenge });
    }
    const event = payload.event;
    if (!event) return res.status(200).json({ ignored: true });

    res.status(200).json({ accepted: true });

    setImmediate(async () => {
      try {
        let productBefore = null;
        if (event.pulseId) {
          const item = await req.monday.getItem(event.pulseId);
          if (item) productBefore = inventoryItemToProduct(item, req.cfg);
        }
        const plan = await planReverseSync({
          event,
          productBefore,
          cfg: req.cfg,
          storage: req.storage
        });
        if (plan.skip) {
          console.log(`[reverse-sync] skipped: ${plan.reason}`);
          return;
        }

        if (plan.movement) {
          const payload = buildMovementPayload(
            { ...plan.movement, timestamp: new Date() },
            req.cfg
          );
          await req.monday.createItem({
            boardId: req.cfg.MOVEMENTS_BOARD_ID,
            itemName: payload.itemName,
            columnValues: payload.columnValues
          });
        }

        const followUpUpdates = {};
        if (Object.prototype.hasOwnProperty.call(plan.updates, 'statusIndex')) {
          followUpUpdates.statusIndex = plan.updates.statusIndex;
        }
        followUpUpdates.lastMovementAt = new Date().toISOString();

        await writeInventoryUpdate({
          client: req.monday,
          storage: req.storage,
          cfg: req.cfg,
          itemId: event.pulseId,
          updates: followUpUpdates
        });
      } catch (err) {
        console.error('[reverse-sync] error', err.stack || err.message);
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
