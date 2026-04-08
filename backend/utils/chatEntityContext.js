const TTL_MS = 20 * 60 * 1000;
const store = new Map();

function key(userId) {
  return String(userId);
}

function setFocusedAssignee(actorUserId, assigneeUserId, assigneeName = "") {
  store.set(key(actorUserId), {
    assigneeUserId: String(assigneeUserId || ""),
    assigneeName: String(assigneeName || ""),
    at: Date.now(),
  });
}

function getFocusedAssignee(actorUserId) {
  const row = store.get(key(actorUserId));
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    store.delete(key(actorUserId));
    return null;
  }
  if (!row.assigneeUserId) return null;
  return { assigneeUserId: row.assigneeUserId, assigneeName: row.assigneeName || "" };
}

function clearFocusedAssignee(actorUserId) {
  store.delete(key(actorUserId));
}

module.exports = {
  setFocusedAssignee,
  getFocusedAssignee,
  clearFocusedAssignee,
};
