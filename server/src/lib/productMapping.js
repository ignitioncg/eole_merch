'use strict';

const { STATUS, STATUS_KEY } = require('./status');
const { findMatch } = require('./matcher');

function readNumber(cv) {
  if (!cv) return 0;
  if (typeof cv.number === 'number') return cv.number;
  if (cv.text != null && cv.text !== '') {
    const n = Number(cv.text);
    if (!Number.isNaN(n)) return n;
  }
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (typeof parsed === 'number') return parsed;
      if (parsed && typeof parsed.number === 'number') return parsed.number;
    } catch (_) {
      const n = Number(cv.value);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function readNumberOrNull(cv) {
  if (!cv) return null;
  if (cv.text == null || cv.text === '') {
    if (!cv.value) return null;
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed == null) return null;
      if (typeof parsed === 'number') return parsed;
      if (parsed && typeof parsed.number === 'number') return parsed.number;
      return null;
    } catch (_) {
      return null;
    }
  }
  const n = Number(cv.text);
  return Number.isNaN(n) ? null : n;
}

function readStatusIndex(cv) {
  if (!cv) return null;
  if (typeof cv.index === 'number') return cv.index;
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed && typeof parsed.index === 'number') return parsed.index;
    } catch (_) {}
  }
  return null;
}

function readDate(cv) {
  if (!cv) return null;
  if (cv.text) return cv.text;
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (parsed && parsed.date) return parsed.date;
    } catch (_) {}
  }
  return null;
}

function inventoryItemToProduct(item, cfg) {
  const cvs = item.column_values || [];
  const byId = Object.fromEntries(cvs.map((c) => [c.id, c]));

  const stockOnHand = readNumber(byId[cfg.INVENTORY_STOCK_ON_HAND_COLUMN_ID]);
  const stockInUse = readNumber(byId[cfg.INVENTORY_STOCK_IN_USE_COLUMN_ID]);
  const statusIndex = readStatusIndex(byId[cfg.INVENTORY_STATUS_COLUMN_ID]);
  const reorderPoint = cfg.INVENTORY_REORDER_POINT_COLUMN_ID
    ? readNumberOrNull(byId[cfg.INVENTORY_REORDER_POINT_COLUMN_ID])
    : null;
  const lastMovementAt = cfg.INVENTORY_LAST_MOVEMENT_COLUMN_ID
    ? readDate(byId[cfg.INVENTORY_LAST_MOVEMENT_COLUMN_ID])
    : null;

  const effectiveStatus = statusIndex == null ? STATUS.IN_STOCK : statusIndex;

  return {
    productId: item.id,
    name: item.name,
    stockOnHand,
    stockInUse,
    reorderPoint,
    statusIndex: effectiveStatus,
    statusKey: STATUS_KEY[effectiveStatus] || 'InStock',
    lastMovementAt,
    linkedInventoryItemId: item.id
  };
}

function resolveProductsToOrderColumns(products, orderColumns) {
  const numericColumns = (orderColumns || []).filter((c) => c.type === 'numbers');
  const productsByOrderColumn = {};
  const orderColumnByProductId = {};
  const unresolvedProductIds = [];

  for (const product of products) {
    const match = findMatch(product.name, numericColumns, (c) => c.title);
    if (match) {
      orderColumnByProductId[product.productId] = match.entry.id;
      productsByOrderColumn[match.entry.id] = product;
    } else {
      unresolvedProductIds.push(product.productId);
    }
  }

  return { productsByOrderColumn, orderColumnByProductId, unresolvedProductIds };
}

module.exports = {
  inventoryItemToProduct,
  resolveProductsToOrderColumns,
  readNumber,
  readNumberOrNull,
  readStatusIndex,
  readDate
};
