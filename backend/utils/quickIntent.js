// ⚡ quickIntent — ONLY handles cases with explicit MongoDB ObjectId
// Baaki sab classifyIntent + runAgent pe jaata hai
// Static keyword matching = unreliable, isliye minimize kiya

const objectIdPattern = /\b[a-f\d]{24}\b/i;

const TOOL_MAP = [
  { tool: "startTask",  patterns: ["start", "shuru", "begin", "chalu"] },
  { tool: "cancelTask", patterns: ["cancel", "band", "rok"] },
  { tool: "verifyTask", patterns: ["verify", "approve", "pass"] },
];

// Status filter extract karo
function extractStatusFilter(text) {
  const lower = text.toLowerCase();
  if (lower.includes("pending"))   return "pending";
  if (lower.includes("verified"))  return "verified";
  if (lower.includes("cancelled")) return "cancelled";
  if (lower.includes("progress"))  return "in_progress";
  if (lower.includes("submitted") || lower.includes("submited")) return "submitted";
  if (lower.includes("rejected"))  return "rejected";
  return null;
}

function quickIntent(userInput) {
  const lower = userInput.toLowerCase().trim();

  // ── Case 1: ObjectId present → seedha tool identify karo ──
  const objectIdMatch = userInput.match(objectIdPattern);
  if (objectIdMatch) {
    const taskId = objectIdMatch[0];

    // Konsa tool?
    for (const { tool, patterns } of TOOL_MAP) {
      if (patterns.some(p => lower.includes(p))) {
        return { tool, input: { taskId }, source: "quick" };
      }
    }

    // ObjectId hai but action unclear → getTasks
    return { tool: "getTasks", input: { taskId }, source: "quick" };
  }

  // ── Case 2: getTasks — explicit "tasks + dikhao/fetch/show" combo ──
  const isShowTask =
    (lower.includes("tasks") || lower.includes("task") || lower.includes("task list")) &&
    (lower.includes("dikhao") || lower.includes("dikha") ||
     lower.includes("show") || lower.includes("fetch") ||
     lower.includes("list") || lower.includes("dekho") ||
     lower.includes("lao") || lower.includes("batao"));

  if (isShowTask) {
    const status = extractStatusFilter(lower);
    return {
      tool: "getTasks",
      input: status ? { status } : {},
      source: "quick",
    };
  }

  // ── Case 3: Export — explicit export/download + tasks combo ──
  const isExport =
    (lower.includes("export") || lower.includes("download")) &&
    (lower.includes("task") || lower.includes("excel") || lower.includes("pdf"));

  if (isExport) {
    return { tool: "exportTasks", input: {}, source: "quick" };
  }

  // ── Case 4: Sab pending tasks cancel (bulk)
  const cancelVerb = lower.includes("cancel") || lower.includes("band") || lower.includes("rok");
  const wantsCancelPending =
    cancelVerb &&
    (lower.includes("pending") || lower.includes("pend")) &&
    (lower.includes("task") || lower.includes("tasks") || lower.includes("kaam"));
  const referentialCancel =
    cancelVerb &&
    /\b(inko|inho|unko|unhe|in ko|in sab|ye sab|yehi)\b/i.test(lower);

  if (wantsCancelPending || referentialCancel) {
    return { tool: "cancelPendingTasks", input: {}, source: "quick" };
  }

  // ── Case 5: Sab pending start / in-progress (bulk)
  const startVerb =
    lower.includes("start") ||
    lower.includes("shuru") ||
    lower.includes("chalu") ||
    lower.includes("begin");
  const wantsStartPending =
    startVerb &&
    (lower.includes("pending") || lower.includes("pend")) &&
    (lower.includes("task") || lower.includes("tasks") || lower.includes("kaam"));
  if (wantsStartPending) {
    return { tool: "startPendingTasks", input: {}, source: "quick" };
  }

  // ── Case 5b: Pending ki due X din aage badhao (sirf tab safe jab ek hi pending)
  const wantsExtendPendingDue =
    /(pending|pend)/i.test(lower) &&
    /(due|deadline|date)/i.test(lower) &&
    /(badh|badhao|badha|extend|aage|delay|shift|\s+or\s+|aur)/i.test(lower);
  if (wantsExtendPendingDue) {
    let extendDays = 1;
    const dayMatch = lower.match(/(\d+)\s*(din|day|days)/);
    if (dayMatch) extendDays = Math.min(Math.max(parseInt(dayMatch[1], 10), 1), 365);
    if (/\bek din\b|one day|^\s*1\s*din\b/.test(lower)) extendDays = 1;
    if (/\b(do din|2 din|two day)\b/.test(lower)) extendDays = 2;
    return { tool: "extendPendingDueDate", input: { days: extendDays }, source: "quick" };
  }

  // ── Case 5c: Create intent ko assign se pehle पकड़ो (phrase: "create ... assign to X")
  const wantsCreate =
    /\b(create|add|banao|banado|bana do|bana de|new task|naya task|naye task)\b/i.test(lower) &&
    /\b(task|kaam)\b/i.test(lower);
  // Allow assignment to override if sentence clearly means assign to an existing past-tense or created task
  if (wantsCreate && !/\b(assign|assine|asign|reassign)\b/i.test(lower)) {
    return { tool: "createSimpleTask", input: {}, source: "quick" };
  }

  // ── Case 6: File update (assign se pehle, taaki "file change" pe assign misfire na ho)
  const wantsFileUpdate =
    /(file|attachment|attach|document|pdf|image|screenshot|upload)/i.test(lower) &&
    /(task|due date|deadline|jiski due|isko|usko|update|replace|badal|change)/i.test(lower);
  if (wantsFileUpdate) {
    return { tool: "updateTaskFile", input: {}, source: "quick" };
  }

  // ── Case 7: Assign / reassign task (strict phrases only)
  const wantsAssign =
    /\b(assign|assine|asign|reassign|allot|saupo)\b/i.test(lower) ||
    /\bko\s+(assign|assine|asign|reassign)\b/i.test(lower) ||
    /\b(assign|assine|asign|reassign)\s+to\b/i.test(lower);
  if (!wantsCreate && wantsAssign && /(task|isko|is task|ye task|usko|ko)/i.test(lower)) {
    const m =
      userInput.match(/\b(?:to\s+)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i) ||
      userInput.match(/\b(?:isko|usko|is task ko|ye task ko)\s+(.+?)\s+ko\s+(?:assign|assine|asign|reassign)\b/i) ||
      userInput.match(/\b(.+?)\s+ko\s+(?:assign|assine|asign|reassign)\b/i);
    const assigneeQuery = m?.[1]?.trim() || "";
    return { tool: "assignTask", input: assigneeQuery ? { assigneeQuery } : {}, source: "quick" };
  }

  // ── Case 8: Title update (due-date sentence se conflict avoid karne ke liye due update se pehle)
  const wantsTitleUpdate =
    /(title|name)\b/i.test(lower) &&
    /(update|change|rename|badal|badlo|set|kro|karo|kar do|krdo)/i.test(lower) &&
    /(task|jiski due|uska|isko|is task)/i.test(lower) &&
    !/(status|done|complete|completed|verify|approved|submitted)/i.test(lower);
  if (wantsTitleUpdate) {
    return { tool: "updateTaskTitle", input: {}, source: "quick" };
  }

  // ── Case 9: Due date change (detail Groq / context se aayega)
  const wantsDueUpdate =
    /(due date|deadline|last date|\bdue\b)/i.test(lower) &&
    /(change|badal|badlo|badhao|badh|update|set|krdo|kardo|karo|kar do|extend|aage)/i.test(lower) &&
    (/(task|tasks|kaam)/i.test(lower) || /\b(is|iski|iske|ye|yeh|yehi)\b/i.test(lower));
  if (wantsDueUpdate) {
    return { tool: "updateTaskDueDate", input: {}, source: "quick" };
  }

  // Baaki sab → AI pe bhejo
  return null;
}

module.exports = { quickIntent };