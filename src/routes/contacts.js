'use strict';

const express = require('express');

const router = express.Router();

const CACHE_TTL_MS = 60 * 1000;
let cache = { boardId: null, items: null, at: 0 };

async function loadContacts(req) {
  const boardId = String(req.cfg.CONTACTS_BOARD_ID || '');
  if (!boardId) throw new Error('CONTACTS_BOARD_ID is not configured');
  if (cache.items && cache.boardId === boardId && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.items;
  }
  const items = await req.monday.listBoardItems(boardId);
  cache = { boardId, items, at: Date.now() };
  return items;
}

function bustCache() {
  cache = { boardId: null, items: null, at: 0 };
}

router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) return res.json({ contacts: [] });

    let items;
    try {
      items = await loadContacts(req);
    } catch (err) {
      bustCache();
      throw err;
    }

    const matches = items
      .filter((i) => (i.name || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        name: item.name,
        columnValues: item.column_values
      }));

    res.json({ contacts: matches, boardId: req.cfg.CONTACTS_BOARD_ID, total: items.length });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', (_req, res) => {
  bustCache();
  res.json({ ok: true });
});

module.exports = router;
