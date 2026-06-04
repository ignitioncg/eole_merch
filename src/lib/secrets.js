'use strict';

let cachedToken = null;
let cachedAt = 0;
let cachedSource = null;
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

async function loadFromEnvManager() {
  try {
    const sdk = require('@mondaycom/apps-sdk');
    if (!sdk || !sdk.EnvironmentVariablesManager) return null;
    const envManager = new sdk.EnvironmentVariablesManager();
    const token = await envManager.get('MONDAY_API_TOKEN');
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
  const fromEnvMgr = fromSecrets ? null : await loadFromEnvManager();
  const fromProcessEnv = process.env.MONDAY_API_TOKEN || null;

  cachedToken = fromSecrets || fromEnvMgr || fromProcessEnv || null;
  cachedSource = fromSecrets ? 'SecretsManager'
    : fromEnvMgr ? 'EnvironmentVariablesManager'
    : fromProcessEnv ? 'process.env'
    : 'none';
  cachedAt = Date.now();

  if (cachedToken) {
    const tail = String(cachedToken).slice(-4);
    console.log(`[secrets] resolved MONDAY_API_TOKEN from ${cachedSource} (len=${String(cachedToken).length}, …${tail})`);
  } else {
    console.warn('[secrets] MONDAY_API_TOKEN not found in SecretsManager, EnvironmentVariablesManager, or process.env');
  }

  return cachedToken;
}

function bustTokenCache() {
  cachedToken = null;
  cachedAt = 0;
  cachedSource = null;
}

function getTokenSource() {
  return cachedSource;
}

module.exports = { getMondayApiToken, bustTokenCache, getTokenSource };
