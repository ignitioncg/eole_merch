'use strict';

class InMemoryStorage {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return { value: entry.value, version: entry.version };
  }
  async set(key, value, options = {}) {
    const expiresAt = options.ttl ? Date.now() + options.ttl * 1000 : null;
    const version = (this.map.get(key)?.version || 0) + 1;
    this.map.set(key, { value, version, expiresAt });
    return { version };
  }
  async delete(key) {
    this.map.delete(key);
  }
  async search(prefix, { cursor } = {}) {
    const start = cursor ? Number(cursor) : 0;
    const keys = [...this.map.keys()].filter((k) => k.startsWith(prefix));
    const slice = keys.slice(start, start + 100);
    const nextCursor = start + slice.length < keys.length ? String(start + slice.length) : null;
    const records = slice.map((k) => ({ key: k, value: this.map.get(k).value, version: this.map.get(k).version }));
    return { records, cursor: nextCursor };
  }
}

function getStorage({ overrideForTests } = {}) {
  if (overrideForTests) return overrideForTests;
  try {
    const sdk = require('@mondaycom/apps-sdk');
    if (sdk && sdk.Storage) {
      const inst = new sdk.Storage(process.env.MONDAY_CODE_STORAGE_TOKEN || '');
      return {
        get: (k) => inst.get(k),
        set: (k, v, opts) => inst.set(k, v, opts || {}),
        delete: (k) => inst.delete(k),
        search: (k, opts) => inst.search(k, opts || {})
      };
    }
  } catch (_) {}
  return new InMemoryStorage();
}

module.exports = { InMemoryStorage, getStorage };
