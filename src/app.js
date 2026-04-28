'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const { MondayClient } = require('./lib/monday');
const { getStorage } = require('./lib/storage');
const { loadConfig } = require('./lib/config');

const productsRoute = require('./routes/products');
const ordersRoute = require('./routes/orders');
const movementsRoute = require('./routes/movements');
const contactsRoute = require('./routes/contacts');
const configRoute = require('./routes/config');
const installRoute = require('./routes/install');
const webhooksRoute = require('./routes/webhooks');
const queueRoute = require('./routes/queue');

function getMondayToken(req) {
  return (
    req.get('x-monday-token') ||
    req.get('authorization') ||
    process.env.MONDAY_API_TOKEN ||
    ''
  );
}

async function buildApp({ storage: storageOverride } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const storage = storageOverride || getStorage();

  app.use(async (req, _res, next) => {
    req.storage = storage;
    req.cfg = await loadConfig(storage);
    const token = getMondayToken(req);
    if (token) req.monday = new MondayClient({ token });
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, version: 1 }));

  app.use('/api', (req, res, next) => {
    if (!req.monday) {
      return res.status(401).json({
        error: 'monday API token unavailable — set MONDAY_API_TOKEN secret or pass x-monday-token header'
      });
    }
    next();
  });

  app.use('/api/products', productsRoute);
  app.use('/api/orders', ordersRoute);
  app.use('/api/movements', movementsRoute);
  app.use('/api/contacts', contactsRoute);
  app.use('/api/config', configRoute);
  app.use('/api/install', installRoute);
  app.use('/webhooks', webhooksRoute);
  app.use('/mndy-queue', queueRoute);

  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/') || req.path === '/mndy-queue') {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('[app] client/dist/index.html not found — frontend will 404. Run `npm run build:client` before deploying.');
  }

  app.use((err, _req, res, _next) => {
    console.error('[error]', err.stack || err.message);
    res.status(500).json({ error: err.message || 'internal error' });
  });

  return app;
}

module.exports = { buildApp };
