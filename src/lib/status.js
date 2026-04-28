'use strict';

const STATUS = {
  LOW_STOCK: 0,
  IN_STOCK: 1,
  OUT_OF_STOCK: 2,
  ON_ORDER: 7,
  DISCONTINUED: 17
};

const STATUS_LABEL = {
  0: 'Low Stock',
  1: 'In Stock',
  2: 'Out of Stock',
  7: 'On Order',
  17: 'Discontinued'
};

const STATUS_KEY = {
  0: 'LowStock',
  1: 'InStock',
  2: 'OutOfStock',
  7: 'OnOrder',
  17: 'Discontinued'
};

const STATUS_SORT_ORDER = {
  2: 0,
  0: 1,
  1: 2,
  7: 3,
  17: 4
};

function recalcStatus({ currentIndex, newCount, reorderPoint, defaultThreshold }) {
  if (currentIndex === STATUS.DISCONTINUED || currentIndex === STATUS.ON_ORDER) {
    return currentIndex;
  }
  if (newCount <= 0) return STATUS.OUT_OF_STOCK;
  const threshold = reorderPoint != null ? reorderPoint : defaultThreshold;
  if (newCount < threshold) return STATUS.LOW_STOCK;
  return STATUS.IN_STOCK;
}

function isLowOrOut(index) {
  return index === STATUS.LOW_STOCK || index === STATUS.OUT_OF_STOCK;
}

function transitionedToLowOrOut(oldIndex, newIndex) {
  return !isLowOrOut(oldIndex) && isLowOrOut(newIndex) && newIndex !== oldIndex;
}

module.exports = {
  STATUS,
  STATUS_LABEL,
  STATUS_KEY,
  STATUS_SORT_ORDER,
  recalcStatus,
  isLowOrOut,
  transitionedToLowOrOut
};
