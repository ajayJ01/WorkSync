const { peekChatTaskContext, refersToListedTask } = require("./chatTaskContext");
const { resolveUniquePendingTaskId } = require("./dueDateTaskResolve");

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Natural / typed dates from user message (Hinglish + common formats).
 */
function parseDueDateFromText(text) {
  if (!text || typeof text !== "string") return null;
  let s = text
    .trim()
    .replace(/\b(krdo|kardo|karo|kar do|set|rakho|please|kr|do|kar|badl|change|likh|likho)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const dmy = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month, day, 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const mdy = s.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/i);
  if (mdy) {
    const day = parseInt(mdy[1], 10);
    const monKey = mdy[2].toLowerCase();
    const mon = MONTHS[monKey];
    if (mon !== undefined) {
      let year = mdy[3] ? parseInt(mdy[3], 10) : new Date().getFullYear();
      let dt = new Date(year, mon, day, 12, 0, 0);
      if (!mdy[3]) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (dt < startOfToday) {
          year += 1;
          dt = new Date(year, mon, day, 12, 0, 0);
        }
      }
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime()) && s.length >= 6) return d;

  return null;
}

function isLikelyDateOnlyFollowup(text) {
  const t = (text || "").trim();
  if (t.length < 4 || t.length > 52) return false;
  const cleaned = t.replace(/\b(krdo|kardo|karo|kar do|set|rakho|please|kr|do|kar)\b/gi, "").trim();
  if (cleaned.length > 28) return false;
  return parseDueDateFromText(t) != null;
}

const REF_TASK_TOOLS = ["startTask", "cancelTask", "verifyTask", "updateTaskDueDate"];

function mergeAiToolInput(text, userId, tool, input) {
  const out = { ...(input || {}) };

  if (REF_TASK_TOOLS.includes(tool) && !out.taskId && refersToListedTask(text)) {
    const ids = peekChatTaskContext(userId);
    if (ids.length === 1) out.taskId = ids[0];
  }

  if (tool === "updateTaskDueDate" && !out.dueDate) {
    const parsed = parseDueDateFromText(text);
    if (parsed) out.dueDate = parsed.toISOString();
  }

  return out;
}

async function finalizeUpdateDueDateInput(text, userId, input) {
  const out = { ...(input || {}) };
  if (!out.taskId) {
    const tid = await resolveUniquePendingTaskId(userId, peekChatTaskContext(userId));
    if (tid) out.taskId = tid;
  }
  if (!out.dueDate) {
    const parsed = parseDueDateFromText(text);
    if (parsed) out.dueDate = parsed.toISOString();
  }
  return out;
}

/**
 * "30 march krdo" jaisa — jab system mein exactly ek pending ho (context + DB).
 */
async function tryCoerceDateOnlyToDueDateUpdate(text, userId) {
  if (!isLikelyDateOnlyFollowup(text)) return null;
  const d = parseDueDateFromText(text);
  if (!d || isNaN(d.getTime())) return null;
  const tid = await resolveUniquePendingTaskId(userId, peekChatTaskContext(userId));
  if (!tid) return null;
  return {
    tool: "updateTaskDueDate",
    input: { taskId: tid, dueDate: d.toISOString() },
    source: "coerce-date",
  };
}

module.exports = {
  parseDueDateFromText,
  mergeAiToolInput,
  finalizeUpdateDueDateInput,
  tryCoerceDateOnlyToDueDateUpdate,
  isLikelyDateOnlyFollowup,
};
