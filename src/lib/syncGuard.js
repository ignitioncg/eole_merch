'use strict';

function markerKey(boardId, itemId) {
  return `sync-guard:${boardId}:${itemId}`;
}

async function setOriginMarker(storage, boardId, itemId, ttlSeconds) {
  await storage.set(markerKey(boardId, itemId), { at: Date.now() }, { ttl: ttlSeconds });
}

async function isEcho(storage, boardId, itemId, ttlSeconds) {
  const got = await storage.get(markerKey(boardId, itemId));
  if (!got) return false;
  const value = got.value || got;
  if (!value || !value.at) return false;
  const ageMs = Date.now() - value.at;
  return ageMs < ttlSeconds * 1000;
}

async function clearMarker(storage, boardId, itemId) {
  if (typeof storage.delete === 'function') {
    await storage.delete(markerKey(boardId, itemId));
  }
}

module.exports = { setOriginMarker, isEcho, clearMarker, markerKey };
