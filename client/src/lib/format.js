export const STATUS_KEY_TO_LABEL = {
  InStock: 'In Stock',
  LowStock: 'Low Stock',
  OutOfStock: 'Out of Stock',
  OnOrder: 'On Order',
  Discontinued: 'Discontinued'
};

export const STATUS_KEY_TO_CLASS = {
  InStock: 'in_stock',
  LowStock: 'low_stock',
  OutOfStock: 'out_of_stock',
  OnOrder: 'on_order',
  Discontinued: 'discontinued'
};

export function formatDate(input) {
  if (!input) return '—';
  try {
    return new Date(input).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) {
    return input;
  }
}

export function formatNumber(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-AU');
}
