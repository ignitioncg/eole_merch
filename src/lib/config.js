'use strict';

const CONFIG_KEY = 'config:active';

const DEFAULTS = Object.freeze({
  ORDERS_BOARD_ID: '5027265628',
  INVENTORY_BOARD_ID: '5027265627',
  CONTACTS_BOARD_ID: '5027265629',
  MOVEMENTS_BOARD_ID: '5028073700',

  INVENTORY_NAME_COLUMN_ID: 'name',
  INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'numeric_mm121bdf',
  INVENTORY_STOCK_IN_USE_COLUMN_ID: 'numeric_mm2taffr',
  INVENTORY_STATUS_COLUMN_ID: 'color_mm12nas5',
  INVENTORY_REORDER_POINT_COLUMN_ID: '',
  INVENTORY_LAST_MOVEMENT_COLUMN_ID: '',

  ORDERS_DATE_SENT_COLUMN_ID: 'date_mm126tcf',
  ORDERS_RECIPIENT_COLUMN_ID: 'text_mm1qa31x',
  ORDERS_SHIPPING_ADDRESS_COLUMN_ID: 'text_mm12rnwn',
  ORDERS_SENT_VIA_COLUMN_ID: 'text_mm14q2wv',
  ORDERS_CONTACT_COLUMN_ID: 'board_relation_mm12p6ve',
  ORDERS_NOTES_COLUMN_ID: 'long_text_mm12n4rz',
  ORDERS_EVENT_COLUMN_ID: 'text_mm1qtw9r',

  MOVEMENTS_PRODUCT_COLUMN_ID: 'board_relation_mm2tna2x',
  MOVEMENTS_RELATED_ORDER_COLUMN_ID: 'board_relation_mm2t2wah',
  MOVEMENTS_REASON_COLUMN_ID: 'color_mm2tden0',
  MOVEMENTS_DELTA_COLUMN_ID: 'numeric_mm2ten3',
  MOVEMENTS_STOCK_BEFORE_COLUMN_ID: 'numeric_mm2tf633',
  MOVEMENTS_STOCK_AFTER_COLUMN_ID: 'numeric_mm2t4v6f',
  MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID: 'numeric_mm2tzkz7',
  MOVEMENTS_MOVEMENT_AT_COLUMN_ID: 'date_mm2tah61',
  MOVEMENTS_ACTOR_COLUMN_ID: 'multiple_person_mm2ta5qh',
  MOVEMENTS_NOTE_COLUMN_ID: 'long_text_mm2tjamp',

  DEFAULT_LOW_STOCK_THRESHOLD: 25,
  SYNC_LOOP_GUARD_SECONDS: 3,
  COLUMN_CACHE_TTL_SECONDS: 300,
  RETRY_MAX_ATTEMPTS: 5,
  RETRY_INITIAL_DELAY_MS: 2000
});

const FIELD_GROUPS = Object.freeze({
  Boards: ['ORDERS_BOARD_ID', 'INVENTORY_BOARD_ID', 'CONTACTS_BOARD_ID', 'MOVEMENTS_BOARD_ID'],
  'Inventory Columns': [
    'INVENTORY_NAME_COLUMN_ID',
    'INVENTORY_STOCK_ON_HAND_COLUMN_ID',
    'INVENTORY_STOCK_IN_USE_COLUMN_ID',
    'INVENTORY_STATUS_COLUMN_ID',
    'INVENTORY_REORDER_POINT_COLUMN_ID',
    'INVENTORY_LAST_MOVEMENT_COLUMN_ID'
  ],
  'Orders Columns': [
    'ORDERS_DATE_SENT_COLUMN_ID',
    'ORDERS_RECIPIENT_COLUMN_ID',
    'ORDERS_SHIPPING_ADDRESS_COLUMN_ID',
    'ORDERS_SENT_VIA_COLUMN_ID',
    'ORDERS_CONTACT_COLUMN_ID',
    'ORDERS_NOTES_COLUMN_ID',
    'ORDERS_EVENT_COLUMN_ID'
  ],
  'Movements Columns': [
    'MOVEMENTS_PRODUCT_COLUMN_ID',
    'MOVEMENTS_RELATED_ORDER_COLUMN_ID',
    'MOVEMENTS_REASON_COLUMN_ID',
    'MOVEMENTS_DELTA_COLUMN_ID',
    'MOVEMENTS_STOCK_BEFORE_COLUMN_ID',
    'MOVEMENTS_STOCK_AFTER_COLUMN_ID',
    'MOVEMENTS_STOCK_IN_USE_AFTER_COLUMN_ID',
    'MOVEMENTS_MOVEMENT_AT_COLUMN_ID',
    'MOVEMENTS_ACTOR_COLUMN_ID',
    'MOVEMENTS_NOTE_COLUMN_ID'
  ],
  Behaviour: [
    'DEFAULT_LOW_STOCK_THRESHOLD',
    'SYNC_LOOP_GUARD_SECONDS',
    'COLUMN_CACHE_TTL_SECONDS',
    'RETRY_MAX_ATTEMPTS',
    'RETRY_INITIAL_DELAY_MS'
  ]
});

function mergeConfig(stored) {
  const merged = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (stored && Object.prototype.hasOwnProperty.call(stored, k) && stored[k] !== undefined && stored[k] !== '') {
      merged[k] = stored[k];
    }
  }
  return merged;
}

async function loadConfig(storage) {
  if (!storage) return { ...DEFAULTS };
  const got = await storage.get(CONFIG_KEY);
  const value = got && (got.value || got);
  return mergeConfig(value);
}

async function saveConfig(storage, patch) {
  const got = await storage.get(CONFIG_KEY);
  const current = (got && (got.value || got)) || {};
  const next = { ...current, ...patch };
  await storage.set(CONFIG_KEY, next);
  return mergeConfig(next);
}

function validateConfig(cfg) {
  const errors = [];
  for (const key of FIELD_GROUPS.Boards) {
    if (!cfg[key]) errors.push(`${key} is required`);
  }
  for (const key of [
    'INVENTORY_NAME_COLUMN_ID',
    'INVENTORY_STOCK_ON_HAND_COLUMN_ID',
    'INVENTORY_STATUS_COLUMN_ID'
  ]) {
    if (!cfg[key]) errors.push(`${key} is required`);
  }
  if (typeof cfg.DEFAULT_LOW_STOCK_THRESHOLD !== 'number' || cfg.DEFAULT_LOW_STOCK_THRESHOLD < 0) {
    errors.push('DEFAULT_LOW_STOCK_THRESHOLD must be a non-negative number');
  }
  if (typeof cfg.SYNC_LOOP_GUARD_SECONDS !== 'number' || cfg.SYNC_LOOP_GUARD_SECONDS < 1) {
    errors.push('SYNC_LOOP_GUARD_SECONDS must be a number >= 1');
  }
  return errors;
}

module.exports = {
  DEFAULTS,
  FIELD_GROUPS,
  CONFIG_KEY,
  loadConfig,
  saveConfig,
  mergeConfig,
  validateConfig
};
