'use strict';

const express = require('express');
const crypto = require('crypto');
const { MondayClient } = require('./monday');
const { processOrder, createInventoryCache } = require('./processor');

const TRIGGER_COLUMN_ID = 'date_mm126tcf';

function loadEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] != null && process.env[m[1]] !== '') continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch (_) {
    // best-effort
  }
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const provided = signatureHeader.replace(/^sha256=/, '');
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch (_) {
    return false;
  }
}

function dateColumnHasValue(event) {
  if (!event) return false;
  const v = event.value;
  if (v && (v.date || v.value)) return true;
  return false;
}

function buildApp({ client, inventoryCache, threshold, webhookSecret, logger = console } = {}) {
  const app = express();

  app.use(
    '/webhooks/orders',
    express.raw({ type: '*/*', limit: '1mb' })
  );

  app.post('/webhooks/orders', async (req, res) => {
    const raw = req.body && req.body.length ? req.body.toString('utf8') : '';
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (err) {
      return res.status(400).json({ error: 'invalid json' });
    }

    if (payload.challenge) {
      return res.status(200).json({ challenge: payload.challenge });
    }

    if (webhookSecret) {
      const sig = req.get('Authorization') || req.get('X-Monday-Signature');
      if (!verifySignature(raw, sig, webhookSecret)) {
        logger.warn('[webhook] signature verification failed');
        return res.status(401).json({ error: 'invalid signature' });
      }
    }

    const event = payload.event;
    if (!event || event.columnId !== TRIGGER_COLUMN_ID) {
      return res.status(200).json({ ignored: true });
    }
    if (!dateColumnHasValue(event)) {
      return res.status(200).json({ ignored: true, reason: 'date cleared' });
    }

    const orderItemId = event.pulseId;
    res.status(200).json({ accepted: true, orderItemId });

    setImmediate(async () => {
      try {
        await processOrder({
          client,
          orderItemId,
          inventoryCache,
          threshold,
          logger
        });
        logger.log(`[ok] processed order ${orderItemId}`);
      } catch (err) {
        logger.error(`[err] processing order ${orderItemId}: ${err.stack || err.message}`);
      }
    });
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  return app;
}

if (require.main === module) {
  loadEnv();
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    console.error('MONDAY_API_TOKEN is required');
    process.exit(1);
  }
  const webhookSecret = process.env.MONDAY_WEBHOOK_SECRET || '';
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 25);
  const port = Number(process.env.PORT || 3000);

  const client = new MondayClient({ token });
  const inventoryCache = createInventoryCache(client);
  const app = buildApp({ client, inventoryCache, threshold, webhookSecret });

  app.listen(port, () => {
    console.log(`[app] listening on :${port} (threshold=${threshold})`);
    if (!webhookSecret) console.warn('[app] MONDAY_WEBHOOK_SECRET not set — signatures will not be verified');
  });
}

module.exports = { buildApp, verifySignature, loadEnv };
