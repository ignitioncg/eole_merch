'use strict';

const { findMatch } = require('./matcher');
const { STATUS, nextStatus, isLowOrOut } = require('./status');

const COUNT_COLUMN_ID = 'numeric_mm121bdf';
const STATUS_COLUMN_ID = 'color_mm12nas5';

function readNumber(columnValue) {
  if (!columnValue) return 0;
  if (typeof columnValue.number === 'number') return columnValue.number;
  if (columnValue.text != null && columnValue.text !== '') {
    const n = Number(columnValue.text);
    if (!Number.isNaN(n)) return n;
  }
  if (columnValue.value) {
    try {
      const parsed = JSON.parse(columnValue.value);
      if (typeof parsed === 'number') return parsed;
      if (parsed && typeof parsed.number === 'number') return parsed.number;
    } catch (_) {
      const n = Number(columnValue.value);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function readStatusIndex(columnValue) {
  if (!columnValue) return null;
  if (typeof columnValue.index === 'number') return columnValue.index;
  if (columnValue.value) {
    try {
      const parsed = JSON.parse(columnValue.value);
      if (parsed && typeof parsed.index === 'number') return parsed.index;
    } catch (_) {
      // ignore
    }
  }
  return null;
}

function buildOrderLines(orderColumnValues, columnTitleMap) {
  const lines = [];
  for (const cv of orderColumnValues || []) {
    if (cv.type !== 'numbers') continue;
    const qty = readNumber(cv);
    if (!qty || qty <= 0) continue;
    const title = columnTitleMap[cv.id] || cv.id;
    lines.push({ columnId: cv.id, title, qty });
  }
  return lines;
}

function planDeductions({
  orderColumnValues,
  columnTitleMap,
  inventoryItems,
  threshold
}) {
  const lines = buildOrderLines(orderColumnValues, columnTitleMap);
  const results = [];

  for (const line of lines) {
    const match = findMatch(line.title, inventoryItems);
    if (!match) {
      results.push({
        action: 'unmatched',
        title: line.title,
        columnId: line.columnId,
        qty: line.qty
      });
      continue;
    }

    const item = match.item;
    const countCv = (item.column_values || []).find((c) => c.id === COUNT_COLUMN_ID);
    const statusCv = (item.column_values || []).find((c) => c.id === STATUS_COLUMN_ID);
    const oldCount = readNumber(countCv);
    const newCount = oldCount - line.qty;
    const oldStatus = readStatusIndex(statusCv);
    const newStatus = oldStatus == null
      ? nextStatus(STATUS.IN_STOCK, newCount, threshold)
      : nextStatus(oldStatus, newCount, threshold);

    results.push({
      action: 'deduct',
      title: line.title,
      columnId: line.columnId,
      qty: line.qty,
      inventoryId: item.id,
      matchedName: item.name,
      matchDistance: match.distance,
      oldCount,
      newCount,
      oldStatus,
      newStatus,
      transitionedToLowOrOut:
        !isLowOrOut(oldStatus) && isLowOrOut(newStatus) && newStatus !== oldStatus
    });
  }

  return results;
}

module.exports = {
  planDeductions,
  buildOrderLines,
  readNumber,
  readStatusIndex,
  COUNT_COLUMN_ID,
  STATUS_COLUMN_ID
};
