'use strict';

const express = require('express');

const router = express.Router();

router.post('/', async (req, res) => {
  const payload = req.body || {};
  const cfg = req.cfg;
  const maxAttempts = cfg.RETRY_MAX_ATTEMPTS || 5;
  const initialDelay = cfg.RETRY_INITIAL_DELAY_MS || 2000;

  if (!payload.kind) return res.status(200).json({ ignored: true });

  const attempt = (payload.attempt || 0) + 1;
  try {
    if (payload.kind === 'inventory_update') {
      await req.monday.updateColumnValues(
        cfg.INVENTORY_BOARD_ID,
        payload.itemId,
        payload.columnValues
      );
      return res.status(200).json({ ok: true, attempt });
    }
    return res.status(200).json({ ignored: true, kind: payload.kind });
  } catch (err) {
    if (attempt >= maxAttempts) {
      console.error(`[queue] giving up after ${attempt} attempts: ${err.message}`);
      return res.status(200).json({ ok: false, gaveUp: true, attempt });
    }
    const delayMs = initialDelay * Math.pow(2, attempt - 1);
    console.warn(`[queue] retry ${attempt} in ${delayMs}ms: ${err.message}`);
    return res.status(500).json({ retryAfterMs: delayMs, attempt, error: err.message });
  }
});

module.exports = router;
