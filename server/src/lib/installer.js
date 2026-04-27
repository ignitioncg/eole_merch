'use strict';

const REORDER_POINT_TITLE = 'Reorder Point';
const LAST_MOVEMENT_TITLE = 'Last Movement';

function findColumnByTitle(columns, title) {
  const lower = title.toLowerCase();
  return columns.find((c) => c.title.toLowerCase() === lower) || null;
}

async function ensureInventoryColumns(client, cfg, { saveConfig } = {}) {
  const columns = await client.listBoardColumns(cfg.INVENTORY_BOARD_ID);
  const patch = {};

  let reorderId = cfg.INVENTORY_REORDER_POINT_COLUMN_ID;
  if (!reorderId) {
    const existing = findColumnByTitle(columns, REORDER_POINT_TITLE);
    if (existing) {
      reorderId = existing.id;
    } else {
      const created = await client.createColumn({
        boardId: cfg.INVENTORY_BOARD_ID,
        title: REORDER_POINT_TITLE,
        columnType: 'numbers'
      });
      reorderId = created.id;
    }
    patch.INVENTORY_REORDER_POINT_COLUMN_ID = reorderId;
  }

  let lastMovementId = cfg.INVENTORY_LAST_MOVEMENT_COLUMN_ID;
  if (!lastMovementId) {
    const existing = findColumnByTitle(columns, LAST_MOVEMENT_TITLE);
    if (existing) {
      lastMovementId = existing.id;
    } else {
      const created = await client.createColumn({
        boardId: cfg.INVENTORY_BOARD_ID,
        title: LAST_MOVEMENT_TITLE,
        columnType: 'date'
      });
      lastMovementId = created.id;
    }
    patch.INVENTORY_LAST_MOVEMENT_COLUMN_ID = lastMovementId;
  }

  if (Object.keys(patch).length && saveConfig) {
    return saveConfig(patch);
  }
  return { ...cfg, ...patch };
}

module.exports = { ensureInventoryColumns, REORDER_POINT_TITLE, LAST_MOVEMENT_TITLE };
