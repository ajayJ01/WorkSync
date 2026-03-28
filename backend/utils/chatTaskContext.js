/** In-memory: last task IDs shown in chat (frontend bhejta hai) — "iski due date" resolve karne ke liye */
const TTL_MS = 45 * 60 * 1000;
const store = new Map();

function key(userId) {
  return String(userId);
}

function prune(userId) {
  const e = store.get(key(userId));
  if (!e) return;
  if (Date.now() - e.at > TTL_MS) store.delete(key(userId));
}

exports.setChatTaskContext = (userId, taskIds) => {
  const ids = [...new Set((taskIds || []).map(String).filter(Boolean))].slice(0, 30);
  if (!ids.length) return;
  store.set(key(userId), { ids, at: Date.now() });
};

exports.peekChatTaskContext = (userId) => {
  prune(userId);
  const e = store.get(key(userId));
  return e?.ids?.length ? [...e.ids] : [];
};

exports.refersToListedTask = (text) =>
  /\b(is|iski|iske|ye|yeh|yehi|us|uski|uske|in|inho|unko|this|that)\b/i.test(text || "");
