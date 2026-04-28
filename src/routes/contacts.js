'use strict';

const express = require('express');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ contacts: [] });
    const items = await req.monday.searchItemsByName(req.cfg.CONTACTS_BOARD_ID, q);
    const contacts = items.map((item) => ({
      id: item.id,
      name: item.name,
      columnValues: item.column_values
    }));
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
