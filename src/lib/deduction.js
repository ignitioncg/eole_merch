'use strict';

const { recalcStatus, transitionedToLowOrOut, STATUS_LABEL } = require('./status');

function planOrderSubmission({ order, products, cfg, now = new Date() }) {
  const productById = new Map(products.map((p) => [p.productId, p]));
  const linePlans = [];
  const warnings = [];

  if (!order.lines || order.lines.length === 0) {
    return {
      ok: false,
      errors: ['Order must have at least one line'],
      linePlans,
      warnings
    };
  }

  const errors = [];
  for (const line of order.lines) {
    if (!line.productId) {
      errors.push('Line missing productId');
      continue;
    }
    if (typeof line.quantity !== 'number' || line.quantity <= 0) {
      errors.push(`Line for product ${line.productId} has invalid quantity ${line.quantity}`);
      continue;
    }

    const product = productById.get(line.productId);
    if (!product) {
      errors.push(`Product ${line.productId} not found`);
      continue;
    }

    const stockBefore = product.stockOnHand;
    const stockAfter = stockBefore - line.quantity;
    const stockInUseBefore = product.stockInUse;
    const stockInUseAfter = stockInUseBefore + line.quantity;

    const newStatus = recalcStatus({
      currentIndex: product.statusIndex,
      newCount: stockAfter,
      reorderPoint: product.reorderPoint,
      defaultThreshold: cfg.DEFAULT_LOW_STOCK_THRESHOLD
    });

    if (line.quantity > stockBefore) {
      warnings.push(
        `Line for ${product.name} requests ${line.quantity} but only ${stockBefore} on hand — stock will go negative`
      );
    }

    linePlans.push({
      productId: product.productId,
      productName: product.name,
      productNameAtTime: line.productNameAtTime || product.name,
      linkedInventoryItemId: product.linkedInventoryItemId,
      quantity: line.quantity,
      stockBefore,
      stockAfter,
      stockInUseBefore,
      stockInUseAfter,
      oldStatus: product.statusIndex,
      newStatus,
      oldStatusLabel: STATUS_LABEL[product.statusIndex],
      newStatusLabel: STATUS_LABEL[newStatus],
      transitionedToLowOrOut: transitionedToLowOrOut(product.statusIndex, newStatus),
      timestamp: now.toISOString()
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    linePlans
  };
}

function planManualAdjustment({ product, newStockOnHand, reason, note, actor, cfg, now = new Date() }) {
  if (!product) throw new Error('product is required');
  const stockBefore = product.stockOnHand;
  const stockAfter = newStockOnHand;
  const delta = stockAfter - stockBefore;

  const newStatus = recalcStatus({
    currentIndex: product.statusIndex,
    newCount: stockAfter,
    reorderPoint: product.reorderPoint,
    defaultThreshold: cfg.DEFAULT_LOW_STOCK_THRESHOLD
  });

  return {
    productId: product.productId,
    productName: product.name,
    linkedInventoryItemId: product.linkedInventoryItemId,
    delta,
    stockBefore,
    stockAfter,
    stockInUseAfter: null,
    oldStatus: product.statusIndex,
    newStatus,
    transitionedToLowOrOut: transitionedToLowOrOut(product.statusIndex, newStatus),
    reason,
    note: note || null,
    actor,
    timestamp: now.toISOString()
  };
}

module.exports = { planOrderSubmission, planManualAdjustment };
