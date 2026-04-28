'use strict';

let cachedToken = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function loadFromSecretsManager() {
  try {
    const sdk = require('@mondaycom/apps-sdk');
    if (!sdk || !sdk.SecretsManager) return null;
    const secrets = new sdk.SecretsManager();
    const token = await secrets.get('MONDAY_API_TOKEN');
    return token || null;
  } catch (_) {
    return null;
  }
}

async function getMondayApiToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedToken;
  }
  const fromSecrets = await loadFromSecretsManager();
  cachedToken = fromSecrets || process.env.MONDAY_API_TOKEN || null;
  cachedAt = Date.now();
  return cachedToken;
}

function bustTokenCache() {
  cachedToken = null;
  cachedAt = 0;
}

module.exports = { getMondayApiToken, bustTokenCache };
