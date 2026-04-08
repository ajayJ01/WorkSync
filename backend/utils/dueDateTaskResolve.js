const Task = require("../models/Task");

function visibilityFilter(userId) {
  return { $or: [{ createdBy: userId }, { assignedTo: userId }] };
}

/**
 * Chat context mein se pending, ya poori visibility mein sirf ek pending — tab hi taskId.
 */
async function resolveUniquePendingTaskId(userId, contextIds) {
  const vis = visibilityFilter(userId);
  const ids = (contextIds || []).filter(Boolean).map(String);

  if (ids.length) {
    const inCtx = await Task.find({
      $and: [{ _id: { $in: ids } }, vis, { status: "pending" }],
    })
      .select("_id")
      .lean();
    if (inCtx.length === 1) return String(inCtx[0]._id);
  }

  const allPending = await Task.find({ $and: [vis, { status: "pending" }] })
    .select("_id")
    .lean();
  if (allPending.length === 1) return String(allPending[0]._id);

  return null;
}

module.exports = { resolveUniquePendingTaskId };
