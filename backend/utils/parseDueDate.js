const {
  peekChatTaskContext,
  refersToListedTask,
  refersToImplicitFollowupEdit,
  peekLastTouchedTaskId,
} = require("./chatTaskContext");
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

function parseTimeFromText(text) {
  const lower = (text || "").toLowerCase();
  let hours = 12;
  let minutes = 0;

  // Prefer explicit time tokens instead of first number in sentence (e.g. "1 Apr, 11:00 AM")
  const h1 = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/); // 11:30 pm
  if (h1) {
    hours = parseInt(h1[1], 10);
    minutes = parseInt(h1[2], 10);
    const ap = h1[3];
    if (ap === "pm" && hours < 12) hours += 12;
    if (ap === "am" && hours === 12) hours = 0;
  } else {
    const h2 = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(bje|baje)\b/); // 5 bje / 5:30 baje
    if (h2) {
      hours = parseInt(h2[1], 10);
      minutes = h2[2] ? parseInt(h2[2], 10) : 0;
    } else {
      const h3 = lower.match(/\b(\d{1,2})\s*(am|pm)\b/); // 3pm
      if (h3) {
        hours = parseInt(h3[1], 10);
        minutes = 0;
        const ap = h3[2];
        if (ap === "pm" && hours < 12) hours += 12;
        if (ap === "am" && hours === 12) hours = 0;
      }
    }
  }

  // Hinglish hints
  if (/\b(evening|shaam|sham)\b/i.test(lower) && hours < 12) hours += 12;
  if (/\b(morning|subah)\b/i.test(lower) && hours === 12) hours = 9;
  if (/\b(night|raat)\b/i.test(lower) && hours < 12) hours += 12;

  if (hours > 23 || minutes > 59) return { hours: 12, minutes: 0 };
  return { hours, minutes };
}

function parseRelativeDate(text) {
  const lower = (text || "").toLowerCase();
  const now = new Date();
  now.setSeconds(0, 0);
  const { hours, minutes } = parseTimeFromText(lower);

  if (/\b(aaj|today)\b/i.test(lower)) {
    const d = new Date(now);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  if (/\b(kal|kl|tomorrow|tmrw|tmr)\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  if (/\b(parso|day after tomorrow)\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  // "10 din baad" / "after 10 days"
  const daysLater =
    lower.match(/\b(\d{1,3})\s*(din|day|days)\s*(baad|later)?\b/i) ||
    lower.match(/\b(after)\s*(\d{1,3})\s*(day|days)\b/i);
  if (daysLater) {
    const n = parseInt(daysLater[1] || daysLater[2], 10);
    if (!isNaN(n) && n > 0) {
      const d = new Date(now);
      d.setDate(d.getDate() + Math.min(n, 365));
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
  }

  // "1 mahina baad" / "after 1 month"
  const monthsLater =
    lower.match(/\b(\d{1,2})\s*(mahina|mahine|month|months)\s*(baad|later)?\b/i) ||
    lower.match(/\b(after)\s*(\d{1,2})\s*(month|months)\b/i);
  if (monthsLater) {
    const n = parseInt(monthsLater[1] || monthsLater[2], 10);
    if (!isNaN(n) && n > 0) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + Math.min(n, 24));
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
  }

  return null;
}

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

  const rel = parseRelativeDate(s);
  if (rel && !isNaN(rel.getTime())) return rel;

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const t = parseTimeFromText(s);
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    d.setHours(t.hours, t.minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const dmy = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const t = parseTimeFromText(s);
    const d = new Date(year, month, day, t.hours, t.minutes, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Supports: "1 Apr", "1 Apr, 11:00 AM", "1 April 2026", "1 April, 2026"
  const mdy = s.match(/\b(\d{1,2})\s+([a-z]+)\s*,?\s*(\d{4})?\b/i);
  if (mdy) {
    const day = parseInt(mdy[1], 10);
    const monKey = mdy[2].toLowerCase();
    const mon = MONTHS[monKey];
    if (mon !== undefined) {
      let year = mdy[3] ? parseInt(mdy[3], 10) : new Date().getFullYear();
      const t = parseTimeFromText(s);
      let dt = new Date(year, mon, day, t.hours, t.minutes, 0);
      if (!mdy[3]) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (dt < startOfToday) {
          year += 1;
          dt = new Date(year, mon, day, t.hours, t.minutes, 0);
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

const REF_TASK_TOOLS = [
  "startTask",
  "cancelTask",
  "verifyTask",
  "updateTaskDueDate",
  "assignTask",
  "updateTaskTitle",
  "updateTaskFile",
  "updateTaskDescription",
];

function mergeAiToolInput(text, userId, tool, input) {
  const out = { ...(input || {}) };

  if (REF_TASK_TOOLS.includes(tool) && !out.taskId) {
    if (refersToListedTask(text)) {
      const ids = peekChatTaskContext(userId);
      if (ids.length === 1) out.taskId = ids[0];
    }
    if (!out.taskId && refersToImplicitFollowupEdit(text)) {
      const last = peekLastTouchedTaskId(userId);
      if (last) out.taskId = last;
    }
  }

  if (tool === "updateTaskDueDate" && !out.dueDate) {
    const parsed = parseDueDateFromText(text);
    if (parsed) out.dueDate = parsed.toISOString();
  }

  // createSimpleTask: user ke raw text ki due-date ko priority do
  if (tool === "createSimpleTask") {
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
