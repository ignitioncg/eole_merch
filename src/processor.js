'use strict';

const { planDeductions, COUNT_COLUMN_ID, STATUS_COLUMN_ID } = require('./deduction');
const { STATUS_LABEL } = require('./status');

const ORDERS_BOARD_ID = '5027265628';
const INVENTORY_BOARD_ID = '5027265627';
const NOTES_COLUMN_ID = 'long_text_mm12n4rz';
const DEDUCTED_MARKER = '[STOCK_DEDUCTED:';

const CACHE_TTL_MS = 5 * 60 * 1000;

function createInventoryCache(client) {
  let cached = null;
  let fetchedAt = 0;

  return {
    async get() {
      const now = Date.now();
      if (cached && now - fetchedAt < CACHE_TTL_MS) return cached;
      cached = await client.listBoardItems(INVENTORY_BOARD_ID);
      fetchedAt = now;
      return cached;
    },
    bust() {
      cached = null;
      fetchedAt = 0;
    }
  };
}

function readNotesText(item) {
  const cv = (item.column_values || []).find((c) => c.id === NOTES_COLUMN_ID);
  if (!cv) return '';
  if (cv.text != null) return cv.text;
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed && typeof parsed.text === 'string') return parsed.text;
    } catch (_) {}
  }
  return '';
}

function alreadyDeducted(item) {
  return readNotesText(item).includes(DEDUCTED_MARKER);
}

function formatAEST(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} AEST`;
}

function buildAuditBody(results, when = new Date()) {
  const lines = [`Stock deducted ${formatAEST(when)}`];
  for (const r of results) {
    if (r.action === 'unmatched') {
      lines.push(`- ${r.title}: ${r.qty} (no inventory match — please update manually)`);
      continue;
    }
    const matchedDifferently = r.matchedName && r.matchedName.trim().toLowerCase() !== r.title.trim().toLowerCase();
    const detail = matchedDifferently
      ? `matched '${r.matchedName}': ${r.oldCount} → ${r.newCount}`
      : `${r.matchedName}: ${r.oldCount} → ${r.newCount}`;
    lines.push(`- ${r.title}: ${r.qty} (${detail})`);
  }
  return lines.join('\n');
}

function buildLowStockBody(result) {
  return `Stock alert: ${result.matchedName} now ${STATUS_LABEL[result.newStatus]} (${result.newCount} remaining). Reorder soon.`;
}

function buildColumnTitleMap(boardColumns) {
  const map = {};
  for (const c of boardColumns || []) map[c.id] = c.title;
  return map;
}

async function fetchOrderWithColumns(client, orderItemId) {
  const data = await client.query(`
    query ($id: [ID!]) {
      items(ids: $id) {
        id
        name
        board {
          id
          columns { id title type }
        }
        column_values {
          id
          type
          text
          value
        }
      }
    }
  `, { id: [String(orderItemId)] });
  return data.items && data.items[0];
}

async function processOrder({
  client,
  orderItemId,
  inventoryCache,
  threshold,
  dryRun = false,
  logger = console
}) {
  const order = await fetchOrderWithColumns(client, orderItemId);
  if (!order) throw new Error(`Order item ${orderItemId} not found`);

  const notesText = readNotesText(order);
  if (notesText.includes(DEDUCTED_MARKER)) {
    logger.log(`[skip] order ${orderItemId} already has ${DEDUCTED_MARKER} marker`);
    return { skipped: true, reason: 'already-deducted' };
  }

  const columnTitleMap = buildColumnTitleMap(order.board && order.board.columns);

  let inventoryItems = await inventoryCache.get();
  let results = planDeductions({
    orderColumnValues: order.column_values,
    columnTitleMap,
    inventoryItems,
    threshold
  });

  const hasUnmatched = results.some((r) => r.action === 'unmatched');
  if (hasUnmatched) {
    inventoryCache.bust();
    inventoryItems = await inventoryCache.get();
    results = planDeductions({
      orderColumnValues: order.column_values,
      columnTitleMap,
      inventoryItems,
      threshold
    });
  }

  if (dryRun) {
    logger.log(`[dry-run] order ${orderItemId} (${order.name})`);
    for (const r of results) {
      if (r.action === 'unmatched') {
        logger.log(`  - ${r.title}: qty ${r.qty} → NO MATCH (skipped)`);
      } else {
        logger.log(`  - ${r.title}: qty ${r.qty} → '${r.matchedName}' (id ${r.inventoryId}) ${r.oldCount} → ${r.newCount} [status ${STATUS_LABEL[r.oldStatus]} → ${STATUS_LABEL[r.newStatus]}]`);
      }
    }
    return { dryRun: true, order, results };
  }

  for (const r of results) {
    if (r.action !== 'deduct') continue;
    const columnValues = {
      [COUNT_COLUMN_ID]: r.newCount,
      [STATUS_COLUMN_ID]: { index: r.newStatus }
    };
    await client.updateColumnValues(INVENTORY_BOARD_ID, r.inventoryId, columnValues);

    if (r.transitionedToLowOrOut) {
      try {
        await client.createUpdate(r.inventoryId, buildLowStockBody(r));
      } catch (err) {
        logger.error(`[warn] failed to post low-stock alert on item ${r.inventoryId}: ${err.message}`);
      }
    }
  }

  const auditBody = buildAuditBody(results, new Date());
  await client.createUpdate(orderItemId, auditBody);

  const newNotes = `[STOCK_DEDUCTED:${new Date().toISOString()}]\n${notesText}`;
  await client.updateColumnValues(ORDERS_BOARD_ID, orderItemId, {
    [NOTES_COLUMN_ID]: newNotes
  });

  return { order, results, auditBody };
}

module.exports = {
  processOrder,
  createInventoryCache,
  buildAuditBody,
  buildLowStockBody,
  buildColumnTitleMap,
  readNotesText,
  alreadyDeducted,
  formatAEST,
  ORDERS_BOARD_ID,
  INVENTORY_BOARD_ID,
  NOTES_COLUMN_ID,
  DEDUCTED_MARKER
};
