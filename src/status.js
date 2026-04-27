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

function nextStatus(currentIndex, newCount, threshold) {
  if (currentIndex === STATUS.DISCONTINUED || currentIndex === STATUS.ON_ORDER) {
    return currentIndex;
  }
  if (newCount <= 0) return STATUS.OUT_OF_STOCK;
  if (newCount < threshold) return STATUS.LOW_STOCK;
  return STATUS.IN_STOCK;
}

function isLowOrOut(index) {
  return index === STATUS.LOW_STOCK || index === STATUS.OUT_OF_STOCK;
}

module.exports = { STATUS, STATUS_LABEL, nextStatus, isLowOrOut };
