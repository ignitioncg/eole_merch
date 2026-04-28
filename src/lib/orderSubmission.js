'use strict';

const { planOrderSubmission } = require('./deduction');
const { inventoryItemToProduct, resolveProductsToOrderColumns } = require('./productMapping');
const { buildMovementPayload } = require('./movements');
const {
  buildInventoryColumnUpdate,
  buildOrderColumnPayload,
  writeLowStockAlert
} = require('./sync');
const { setOriginMarker } = require('./syncGuard');

const COLUMN_CACHE_KEY = 'column-cache:product-to-orders-column';

async function loadOrderColumnCache(storage) {
  if (!storage) return null;
  const got = await storage.get(COLUMN_CACHE_KEY);
  return got ? got.value || got : null;
}

async function saveOrderColumnCache(storage, value, ttlSeconds) {
  if (!storage) return;
  await storage.set(COLUMN_CACHE_KEY, value, { ttl: ttlSeconds });
}

async function bustOrderColumnCache(storage) {
  if (storage && typeof storage.delete === 'function') {
    await storage.delete(COLUMN_CACHE_KEY);
  }
}

async function resolveProductOrderColumns({ client, products, cfg, storage }) {
  const cached = await loadOrderColumnCache(storage);
  if (cached && cached.byProduct) {
    const allResolved = products.every((p) => cached.byProduct[p.productId]);
    if (allResolved) return cached.byProduct;
  }
  const orderColumns = await client.listBoardColumns(cfg.ORDERS_BOARD_ID);
  const { orderColumnByProductId, unresolvedProductIds } = resolveProductsToOrderColumns(products, orderColumns);
  await saveOrderColumnCache(storage, { byProduct: orderColumnByProductId, at: Date.now() }, cfg.COLUMN_CACHE_TTL_SECONDS);
  return { ...orderColumnByProductId, __unresolved: unresolvedProductIds };
}

async function submitOrder({ client, storage, cfg, order, actor, products, dryRun = false, logger = console }) {
  const plan = planOrderSubmission({ order, products, cfg });

  if (!plan.ok) {
    return { ok: false, errors: plan.errors, warnings: plan.warnings, plan };
  }

  let columnMap = await resolveProductOrderColumns({ client, products, cfg, storage });
  let unresolved = (columnMap.__unresolved || []).filter((id) => plan.linePlans.some((l) => l.productId === id));
  if (unresolved.length) {
    await bustOrderColumnCache(storage);
    columnMap = await resolveProductOrderColumns({ client, products, cfg, storage });
    unresolved = (columnMap.__unresolved || []).filter((id) => plan.linePlans.some((l) => l.productId === id));
  }
  if (unresolved.length) {
    plan.warnings.push(`Could not resolve Orders board columns for product ids: ${unresolved.join(', ')}`);
  }

  const orderItemPayload = buildOrderColumnPayload({
    order,
    cfg,
    productLines: plan.linePlans,
    productOrderColumnIdByProduct: columnMap
  });

  const movementsToWrite = plan.linePlans.map((line) =>
    buildMovementPayload(
      {
        productName: line.productName,
        linkedInventoryItemId: line.linkedInventoryItemId,
        linkedOrderItemId: null,
        reason: 'order_placed',
        delta: -line.quantity,
        stockBefore: line.stockBefore,
        stockAfter: line.stockAfter,
        stockInUseAfter: line.stockInUseAfter,
        actorMondayUserId: actor.id,
        timestamp: new Date(line.timestamp),
        note: order.notes || null
      },
      cfg
    )
  );

  const inventoryUpdates = plan.linePlans.map((line) => ({
    linkedInventoryItemId: line.linkedInventoryItemId,
    columnValues: buildInventoryColumnUpdate(
      {
        stockOnHand: line.stockAfter,
        stockInUse: line.stockInUseAfter,
        statusIndex: line.newStatus,
        lastMovementAt: line.timestamp
      },
      cfg
    ),
    transitionedToLowOrOut: line.transitionedToLowOrOut,
    newStatus: line.newStatus,
    newCount: line.stockAfter,
    name: line.productName,
    reorderPoint: products.find((p) => p.productId === line.productId)?.reorderPoint
  }));

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      plan,
      orderItemPayload,
      orderBoardId: cfg.ORDERS_BOARD_ID,
      orderItemName: buildOrderItemName(order),
      movementsToWrite,
      movementsBoardId: cfg.MOVEMENTS_BOARD_ID,
      inventoryUpdates,
      inventoryBoardId: cfg.INVENTORY_BOARD_ID,
      warnings: plan.warnings
    };
  }

  const itemName = buildOrderItemName(order);
  const created = await client.createItem({
    boardId: cfg.ORDERS_BOARD_ID,
    itemName,
    columnValues: orderItemPayload
  });
  const linkedOrderItemId = created.id;

  for (const m of movementsToWrite) {
    m.columnValues[cfg.MOVEMENTS_RELATED_ORDER_COLUMN_ID] = { item_ids: [Number(linkedOrderItemId)] };
  }
  for (const m of movementsToWrite) {
    await client.createItem({ boardId: cfg.MOVEMENTS_BOARD_ID, itemName: m.itemName, columnValues: m.columnValues });
  }

  for (const u of inventoryUpdates) {
    if (storage) {
      await setOriginMarker(storage, cfg.INVENTORY_BOARD_ID, u.linkedInventoryItemId, cfg.SYNC_LOOP_GUARD_SECONDS);
    }
    try {
      await client.updateColumnValues(cfg.INVENTORY_BOARD_ID, u.linkedInventoryItemId, u.columnValues);
      if (u.transitionedToLowOrOut) {
        await writeLowStockAlert({
          client,
          cfg,
          linkedInventoryItemId: u.linkedInventoryItemId,
          name: u.name,
          statusIndex: u.newStatus,
          count: u.newCount,
          reorderPoint: u.reorderPoint
        });
      }
    } catch (err) {
      logger.error(`[order ${linkedOrderItemId}] inventory update for ${u.linkedInventoryItemId} failed: ${err.message}`);
      if (storage) {
        await enqueueRetry(storage, {
          kind: 'inventory_update',
          itemId: u.linkedInventoryItemId,
          columnValues: u.columnValues,
          attempt: 1,
          firstSeen: Date.now()
        });
      }
    }
  }

  return {
    ok: true,
    linkedOrderItemId,
    plan,
    movementsWritten: movementsToWrite.length,
    inventoryUpdated: inventoryUpdates.length,
    warnings: plan.warnings
  };
}

function buildOrderItemName(order) {
  const recipient = order.recipientName || 'Unnamed recipient';
  const date = order.dateSent || new Date().toISOString().slice(0, 10);
  return `${recipient} — ${date}`;
}

async function enqueueRetry(storage, payload) {
  const id = `retry:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await storage.set(id, payload);
}

module.exports = {
  submitOrder,
  buildOrderItemName,
  resolveProductOrderColumns,
  bustOrderColumnCache,
  COLUMN_CACHE_KEY
};
