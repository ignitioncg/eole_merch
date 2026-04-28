'use strict';

const express = require('express');
const { loadConfig, saveConfig, validateConfig, FIELD_GROUPS, DEFAULTS } = require('../lib/config');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const cfg = await loadConfig(req.storage);
    res.json({ config: cfg, defaults: DEFAULTS, groups: FIELD_GROUPS });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const patch = req.body || {};
    const next = await saveConfig(req.storage, patch);
    const errors = validateConfig(next);
    if (errors.length) return res.status(400).json({ error: errors.join('; '), config: next });
    res.json({ config: next });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
