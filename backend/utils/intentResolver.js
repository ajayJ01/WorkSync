const Task = require("../models/Task");
const { parseDueDateFromText } = require("./parseDueDate");

const SUPPORTED_TOOLS = new Set([
  "getTasks",
  "createSimpleTask",
  "updateTaskFile",
  "updateTaskTitle",
  "assignTask",
  "startTask",
  "cancelTask",
  "cancelPendingTasks",
  "startPendingTasks",
  "updateTaskDueDate",
  "extendPendingDueDate",
  "verifyTask",
  "exportTasks",
  "unknown",
]);

function sanitizeAgentResult(aiRes) {
  const out = aiRes && typeof aiRes === "object" ? { ...aiRes } : {};
  out.tool = String(out.tool || "unknown").trim();
  if (!SUPPORTED_TOOLS.has(out.tool)) out.tool = "unknown";
  out.input = out.input && typeof out.input === "object" ? out.input : {};
  const conf = Number(out.confidence);
  out.confidence = Number.isFinite(conf) ? Math.min(Math.max(conf, 0), 1) : null;
  out.needs_clarification = Boolean(out.needs_clarification);
  out.clarification_question = String(out.clarification_question || "").trim();
  return out;
}

function needsClarification(aiRes) {
  if (!aiRes || aiRes.tool === "unknown") return true;
  if (aiRes.needs_clarification) return true;
  if (aiRes.confidence != null && aiRes.confidence < 0.55) return true;
  return false;
}

function extractTitleHint(text) {
  const raw = String(text || "").trim();
  const m =
    raw.match(/\btitle\s+(.+?)\s+hai\b/i) ||
    raw.match(/\bjiska\s+title\s+(.+?)\s+hai\b/i) ||
    raw.match(/\btask\s+(.+?)\s+(?:ko|ka|ki)\b/i);
  return m?.[1]?.trim() || "";
}

function sameLocalSlot(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

async function retrieveTaskCandidates(userId, text, limit = 3) {
  const visibility = { $or: [{ createdBy: userId }, { assignedTo: userId }] };
  const due = parseDueDateFromText(String(text || ""));
  const titleHint = extractTitleHint(text);

  let list = [];
  if (due && !isNaN(due.getTime())) {
    const all = await Task.find(visibility)
      .select("_id title dueDate status")
      .sort({ updatedAt: -1 })
      .lean();
    list = all.filter((t) => t?.dueDate && sameLocalSlot(new Date(t.dueDate), due));
  } else if (titleHint) {
    const esc = titleHint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    list = await Task.find({
      $and: [visibility, { title: { $regex: esc, $options: "i" } }],
    })
      .select("_id title dueDate status")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  } else {
    list = await Task.find(visibility)
      .select("_id title dueDate status")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  return list.slice(0, limit).map((t) => ({
    taskId: String(t._id),
    title: t.title,
    status: t.status,
    dueDate: t.dueDate,
  }));
}

function buildClarificationMessage(aiRes, candidates) {
  if (aiRes?.clarification_question) return aiRes.clarification_question;
  if (!candidates?.length) {
    return "Mujhe exact action clear nahi hua. Short me bolo: kaunsi task aur kya update karna hai (title/status/due/assign/file).";
  }
  const lines = candidates
    .map((c, i) => `${i + 1}) ${c.title} (${c.status})${c.dueDate ? ` - due ${new Date(c.dueDate).toLocaleString()}` : ""}`)
    .join("\n");
  return `Kaunsi task pe action chahiye? Reply me task ID ya option number bhejo:\n${lines}`;
}

module.exports = {
  sanitizeAgentResult,
  needsClarification,
  retrieveTaskCandidates,
  buildClarificationMessage,
};
