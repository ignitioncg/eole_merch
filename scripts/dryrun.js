#!/usr/bin/env node
'use strict';

/**
 * Dry-run validator for the EOLE Stock Catalog app.
 *
 * Runs three simulations against your monday data without writing anything:
 *
 *   1. Initial sync against the Inventory board
 *   2. An order with three lines: Cutlery Sets x5, Pens - with stylus x10,
 *      Charging cables x3 (which should fuzzy-match "July: Charging cables"
 *      if your inventory item is named that way)
 *   3. A reverse-sync trace: the user manually drops "Tote bags" stock from
 *      462 to 450 on the Inventory board. Confirms the loop-guard suppresses
 *      the echoed status write-back.
 *
 * Usage:
 *   MONDAY_API_TOKEN=... npm run dryrun
 *   MONDAY_API_TOKEN=... node scripts/dryrun.js [--no-fixtures]
 *
 * The script uses fixtures by default (so it works without a token). Pass
 * --no-fixtures to hit the live API.
 */

const path = require('path');
const fs = require('fs');

const SERVER = path.join(__dirname, '..', 'server');
const { MondayClient } = require(path.join(SERVER, 'src/lib/monday'));
const { InMemoryStorage } = require(path.join(SERVER, 'src/lib/storage'));
const { DEFAULTS, mergeConfig } = require(path.join(SERVER, 'src/lib/config'));
const { inventoryItemToProduct } = require(path.join(SERVER, 'src/lib/productMapping'));
const { planInitialSync } = require(path.join(SERVER, 'src/lib/initialSync'));
const { submitOrder } = require(path.join(SERVER, 'src/lib/orderSubmission'));
const { planReverseSync } = require(path.join(SERVER, 'src/lib/reverseSync'));
const { setOriginMarker } = require(path.join(SERVER, 'src/lib/syncGuard'));

const args = process.argv.slice(2);
const noFixtures = args.includes('--no-fixtures');
const cfg = mergeConfig({});

function header(s) {
  console.log('\n' + '='.repeat(72));
  console.log(s);
  console.log('='.repeat(72));
}

function fixturesInventory() {
  const products = [
    ['Cutlery Sets', 481, 24],
    ['Pens - with stylus', 575, 100],
    ['July: Charging cables', 80, 5],
    ['Tote bags', 462, 38],
    ['Notepads', 230, 15],
    ['Stickers', 1200, 200],
    ['Lanyards', 380, 12],
    ['Eco bottles', 95, 0],
    ['Branded T-shirts', 60, 4],
    ['Conference booklet', 25, 0],
    ['Beach towel', 12, 0],
    ['EOLE Hoodie', 80, 0],
    ['Wristbands', 1500, 800],
    ['Bookmarks', 540, 0],
    ['Stress balls', 220, 50],
    ['Mugs', 145, 6],
    ['Postcards', 690, 12],
    ['Pens', 350, 18],
    ['Notebook A5', 200, 22],
    ['Accreditation Certificates', 26, 0],
    ['Phone wallets', 110, 7],
    ['Discontinued Item', 5, 0, 17],
    ['On Order Item', 0, 0, 7],
    ['Resource pack', 0, 0]
  ];
  let id = 2636400000;
  return products.map(([name, stock, used, statusIdx = 1]) => ({
    id: String(id++),
    name,
    column_values: [
      { id: cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID, type: 'numbers', text: String(stock), value: JSON.stringify(stock) },
      { id: cfg.INVENTORY_STOCK_IN_USE_COLUMN_ID, type: 'numbers', text: String(used), value: JSON.stringify(used) },
      { id: cfg.INVENTORY_STATUS_COLUMN_ID, type: 'status', text: '', value: JSON.stringify({ index: statusIdx }) }
    ]
  }));
}

function fixturesOrderColumns() {
  return [
    { id: 'numbers_a', title: 'Cutlery Sets', type: 'numbers' },
    { id: 'numbers_b', title: 'Pens - with stylus', type: 'numbers' },
    { id: 'numbers_c', title: 'July: Charging cables', type: 'numbers' },
    { id: 'numbers_d', title: 'Tote bags', type: 'numbers' },
    { id: 'numbers_e', title: 'EOLE Hoodie', type: 'numbers' },
    { id: 'numbers_f', title: 'Stickers', type: 'numbers' },
    { id: 'numbers_g', title: 'Mugs', type: 'numbers' },
    { id: 'numbers_h', title: 'Wristbands', type: 'numbers' },
    { id: 'numbers_i', title: 'Postcards', type: 'numbers' },
    { id: 'numbers_j', title: 'Pens', type: 'numbers' },
    { id: 'numbers_k', title: 'Notebook A5', type: 'numbers' },
    { id: 'numbers_l', title: 'Accrediation Certificates - PRINT AS REQUIRED', type: 'numbers' },
    { id: 'numbers_m', title: 'Phone wallets', type: 'numbers' },
    { id: 'numbers_n', title: 'Stress balls', type: 'numbers' },
    { id: 'numbers_o', title: 'Bookmarks', type: 'numbers' },
    { id: 'numbers_p', title: 'Resource pack', type: 'numbers' },
    { id: 'numbers_q', title: 'Conference booklet', type: 'numbers' },
    { id: 'numbers_r', title: 'Beach towel', type: 'numbers' },
    { id: 'numbers_s', title: 'Lanyards', type: 'numbers' },
    { id: 'numbers_t', title: 'Eco bottles', type: 'numbers' },
    { id: 'numbers_u', title: 'Notepads', type: 'numbers' },
    { id: 'numbers_v', title: 'Branded T-shirts', type: 'numbers' },
    { id: 'text_x', title: 'Notes', type: 'long_text' },
    { id: 'date_y', title: 'Date Sent', type: 'date' }
  ];
}

class FixtureClient {
  constructor() {
    this.inventoryItems = fixturesInventory();
    this.orderColumns = fixturesOrderColumns();
    this.movementsByProduct = new Set();
    this.calls = [];
  }
  async listBoardItems(boardId) {
    if (String(boardId) === String(cfg.INVENTORY_BOARD_ID)) return this.inventoryItems;
    if (String(boardId) === String(cfg.MOVEMENTS_BOARD_ID)) return [];
    return [];
  }
  async listBoardColumns(boardId) {
    if (String(boardId) === String(cfg.ORDERS_BOARD_ID)) return this.orderColumns;
    if (String(boardId) === String(cfg.INVENTORY_BOARD_ID)) {
      return [
        { id: cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID, title: 'Stock on Hand', type: 'numbers' },
        { id: cfg.INVENTORY_STOCK_IN_USE_COLUMN_ID, title: 'Stock in Use', type: 'numbers' },
        { id: cfg.INVENTORY_STATUS_COLUMN_ID, title: 'Status', type: 'status' }
      ];
    }
    return [];
  }
  async getItem(itemId) {
    return this.inventoryItems.find((i) => String(i.id) === String(itemId));
  }
  async createItem(args) { this.calls.push({ kind: 'createItem', args }); return { id: 'sim-' + Math.random().toString(36).slice(2, 8) }; }
  async updateColumnValues(...args) { this.calls.push({ kind: 'updateColumnValues', args }); return { id: 'sim' }; }
  async createUpdate(...args) { this.calls.push({ kind: 'createUpdate', args }); return { id: 'sim' }; }
  async getMe() { return { id: '100619102', name: 'Christopher Gheller' }; }
}

async function main() {
  const client = noFixtures
    ? new MondayClient({ token: process.env.MONDAY_API_TOKEN })
    : new FixtureClient();
  if (noFixtures && !process.env.MONDAY_API_TOKEN) {
    console.error('--no-fixtures requires MONDAY_API_TOKEN');
    process.exit(1);
  }
  const storage = new InMemoryStorage();
  const actor = { id: '100619102', name: 'Christopher Gheller' };

  /* -------- Step 1: initial sync -------- */
  header('STEP 1 — Initial sync (dry-run)');
  const inventoryItems = await client.listBoardItems(cfg.INVENTORY_BOARD_ID);
  console.log(`Found ${inventoryItems.length} items on Inventory board ${cfg.INVENTORY_BOARD_ID}`);
  const initial = planInitialSync({
    inventoryItems,
    existingMovementProductIds: new Set(),
    cfg,
    actorMondayUserId: actor.id
  });
  console.log(`Will create ${initial.newProducts.length} Products + ${initial.movementsToWrite.length} initial_sync movements.`);
  for (const p of initial.newProducts.slice(0, 6)) {
    console.log(`  - ${p.name.padEnd(36)} stockOnHand=${p.stockOnHand} stockInUse=${p.stockInUse} status=${p.statusKey}`);
  }
  if (initial.newProducts.length > 6) console.log(`  …and ${initial.newProducts.length - 6} more.`);

  /* -------- Step 2: order submission -------- */
  header('STEP 2 — Order submission (dry-run): Cutlery Sets x5, Pens - with stylus x10, Charging cables x3');
  const products = inventoryItems.map((i) => inventoryItemToProduct(i, cfg));

  const cutlery = products.find((p) => /cutlery/i.test(p.name));
  const pens = products.find((p) => /pens.*stylus/i.test(p.name));
  const cables = products.find((p) => /charging\s*cables/i.test(p.name));
  if (!cutlery || !pens || !cables) {
    console.error('Could not locate one of: Cutlery Sets, Pens - with stylus, Charging cables.');
    console.error('Resolved:', { cutlery: cutlery?.name, pens: pens?.name, cables: cables?.name });
    process.exit(1);
  }

  const order = {
    recipientName: 'Hospital Collaborative — Royal Melbourne',
    recipientContactItemId: '12345678',
    shippingAddress: '300 Grattan St, Parkville VIC 3050',
    sentVia: 'AusPost express',
    dateSent: new Date().toISOString().slice(0, 10),
    event: null,
    notes: 'Quarterly resupply',
    lines: [
      { productId: cutlery.productId, quantity: 5, productNameAtTime: cutlery.name },
      { productId: pens.productId, quantity: 10, productNameAtTime: pens.name },
      { productId: cables.productId, quantity: 3, productNameAtTime: cables.name }
    ]
  };

  const orderResult = await submitOrder({
    client,
    storage,
    cfg,
    order,
    actor,
    products,
    dryRun: true
  });
  console.log(`Plan ok: ${orderResult.ok}`);
  console.log(`Warnings: ${(orderResult.warnings || []).join(' | ') || 'none'}`);
  console.log('\nProduct mutations:');
  for (const line of orderResult.plan.linePlans) {
    console.log(`  - ${line.productName.padEnd(28)} ${line.stockBefore} → ${line.stockAfter} (Δ -${line.quantity})  stockInUse ${line.stockInUseBefore} → ${line.stockInUseAfter}  status ${line.oldStatusLabel} → ${line.newStatusLabel}${line.transitionedToLowOrOut ? '  ⚠ LOW/OUT' : ''}`);
  }
  console.log('\nStock movements (one per line):');
  for (const m of orderResult.movementsToWrite) {
    console.log(`  - "${m.itemName}"  → board ${cfg.MOVEMENTS_BOARD_ID}`);
  }
  console.log('\nOrder Custom Object:');
  console.log(`  - linkedOrderItemId will be set after create_item on board ${cfg.ORDERS_BOARD_ID}`);
  console.log(`  - itemName: "${orderResult.orderItemName}"`);
  console.log('\nOrders board payload:');
  for (const [k, v] of Object.entries(orderResult.orderItemPayload)) {
    console.log(`  - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
  console.log('\nInventory board updates:');
  for (const u of orderResult.inventoryUpdates) {
    console.log(`  - item ${u.linkedInventoryItemId} (${u.name}): ${JSON.stringify(u.columnValues)}${u.transitionedToLowOrOut ? '  ⚠ low-stock alert will be posted' : ''}`);
  }

  /* -------- Step 3: reverse-sync trace -------- */
  header('STEP 3 — Manual stocktake on Inventory board: Tote bags 462 → 450');
  const tote = products.find((p) => /tote/i.test(p.name));
  if (!tote) {
    console.warn('No Tote bags item — skipping reverse-sync trace.');
  } else {
    const event = {
      boardId: cfg.INVENTORY_BOARD_ID,
      pulseId: tote.linkedInventoryItemId,
      columnId: cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID,
      value: { value: '450' },
      userId: actor.id
    };
    const revPlan = await planReverseSync({ event, productBefore: tote, cfg, storage });
    if (revPlan.skip) {
      console.log(`(reverse-sync skipped: ${revPlan.reason})`);
    } else {
      console.log(`Detected real edit. Will:`);
      console.log(`  - Update Product stockOnHand → ${revPlan.updates.stockOnHand}`);
      console.log(`  - Recalc status → ${revPlan.updates.newStatusLabel}`);
      console.log(`  - Write StockMovement: reason=${revPlan.movement.reason} delta=${revPlan.movement.delta} before=${revPlan.movement.stockBefore} after=${revPlan.movement.stockAfter} actor=${revPlan.movement.actorMondayUserId}`);
      console.log(`  - Then write back to Inventory board with sync-guard marker (TTL ${cfg.SYNC_LOOP_GUARD_SECONDS}s)`);
    }

    // Now simulate the loop-guard suppressing the echoed write-back:
    await setOriginMarker(storage, cfg.INVENTORY_BOARD_ID, tote.linkedInventoryItemId, cfg.SYNC_LOOP_GUARD_SECONDS);
    const echoed = await planReverseSync({ event, productBefore: tote, cfg, storage });
    console.log(`\nEchoed event check (after we set the sync-guard marker): skip=${echoed.skip} reason=${echoed.reason || '—'}`);
    if (echoed.skip && echoed.reason === 'echo') {
      console.log('  ✓ Loop-guard correctly suppressed the echoed write-back.');
    } else {
      console.log('  ✗ Loop-guard did NOT suppress the echo — review SYNC_LOOP_GUARD_SECONDS and storage scoping.');
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
