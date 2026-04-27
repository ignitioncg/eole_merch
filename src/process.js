#!/usr/bin/env node
'use strict';

const { MondayClient } = require('./monday');
const { processOrder, createInventoryCache } = require('./processor');
const { loadEnv } = require('./app');

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const orderItemId = args.find((a) => !a.startsWith('--'));

  if (!orderItemId) {
    console.error('Usage: node src/process.js <orderItemId> [--dry-run]');
    process.exit(1);
  }

  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    console.error('MONDAY_API_TOKEN is required (set it in .env or the environment)');
    process.exit(1);
  }
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 25);

  const client = new MondayClient({ token });
  const inventoryCache = createInventoryCache(client);

  const result = await processOrder({
    client,
    orderItemId,
    inventoryCache,
    threshold,
    dryRun
  });

  if (!dryRun) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
