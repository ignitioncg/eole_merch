'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const { MondayClient } = require('./lib/monday');
const { getStorage } = require('./lib/storage');
const { loadConfig } = require('./lib/config');
const { getMondayApiToken } = require('./lib/secrets');

const productsRoute = require('./routes/products');
const ordersRoute = require('./routes/orders');
const movementsRoute = require('./routes/movements');
const contactsRoute = require('./routes/contacts');
const configRoute = require('./routes/config');
const installRoute = require('./routes/install');
const webhooksRoute = require('./routes/webhooks');
const queueRoute = require('./routes/queue');

async function buildApp({ storage: storageOverride } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const storage = storageOverride || getStorage();

  app.use(async (req, _res, next) => {
    req.storage = storage;
    req.cfg = await loadConfig(storage);
    req.sessionToken = req.get('x-monday-token') || null;
    const apiToken = await getMondayApiToken();
    if (apiToken) req.monday = new MondayClient({ token: apiToken });
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, version: 1 }));

  app.use('/api', (req, res, next) => {
    if (!req.monday) {
      return res.status(503).json({
        error:
          'MONDAY_API_TOKEN is not set on this monday code app. Run one of:\n' +
          '  mapps code:env    -m set -k MONDAY_API_TOKEN -v <your-token>\n' +
          '  mapps code:secret -m set -k MONDAY_API_TOKEN -v <your-token>\n' +
          'Generate the token at Admin → Developer → My access tokens. ' +
          'The backend re-reads the value within 60 seconds — no redeploy required.'
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
    const msg = err.message || 'internal error';
    if (/HTTP 401/.test(msg) || /NOT_AUTHENTICATED/.test(msg)) {
      const { getTokenSource } = require('./lib/secrets');
      return res.status(401).json({
        error:
          'monday rejected the API token (Not authenticated). The token in MONDAY_API_TOKEN is invalid, revoked, or empty. ' +
          'Verify it works at https://api.monday.com/v2 first, then run one of:\n' +
          '  mapps code:env    -m set -k MONDAY_API_TOKEN -v <new-token>\n' +
          '  mapps code:secret -m set -k MONDAY_API_TOKEN -v <new-token>\n' +
          `Backend resolved token from: ${getTokenSource() || 'none'}.`
      });
    }
    res.status(500).json({ error: msg });
  });

  return app;
}

module.exports = { buildApp };
