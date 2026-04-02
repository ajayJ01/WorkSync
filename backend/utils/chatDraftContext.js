const TTL_MS = 20 * 60 * 1000;
const store = new Map();

function key(userId) {
  return String(userId);
}

function prune(userId) {
  const k = key(userId);
  const row = store.get(k);
  if (!row) return;
  if (Date.now() - row.at > TTL_MS) store.delete(k);
}

function setDraft(userId, draft) {
  const k = key(userId);
  store.set(k, { draft: { ...(draft || {}) }, at: Date.now() });
}

function getDraft(userId) {
  prune(userId);
  const row = store.get(key(userId));
  return row?.draft ? { ...row.draft } : null;
}

function clearDraft(userId) {
  store.delete(key(userId));
}

module.exports = {
  setDraft,
  getDraft,
  clearDraft,
};
