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
    (lower.includes("dikhao") ||
      lower.includes("dikha") ||
      lower.includes("dikh") ||
      lower.includes("show") ||
      lower.includes("fetch") ||
      lower.includes("list") ||
      lower.includes("dekho") ||
      lower.includes("lao") ||
      lower.includes("batao") ||
      lower.includes("btao") ||
      lower.includes("btana") ||
      lower.includes("batana") ||
      lower.includes("display") ||
      lower.includes("open"));

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
    /\b(create|add|banao|banado|bana do|bana de|banwana|banwa do|bnao|bna do|bnado|new task|naya task|naye task|naya kaam|naye kaam)\b/i.test(
      lower
    ) &&
    /\b(task|kaam|kam)\b/i.test(lower);
  const titleChangeCue =
    /\b(title|name|nam|naam|heading)\b/i.test(lower) &&
    /\b(change|badal|badlo|update|rename|karna|karni|karo|krdo|kar do)\b/i.test(lower);
  const pastCreatedRef =
    (/\b(humne|hum\s*ne|hamne|maine|we)\b/i.test(lower) &&
      /\b(create|bana|banaya|banayi|bana diya|bana di|banayi|banaya tha)\b/i.test(lower)) ||
    /\b(i|we)\s+(just\s+)?(created|made|added)\b/i.test(lower) ||
    /\b(task|tasks)\s+(i|we)\s+(created|made|added)\b/i.test(lower) ||
    /\b(the|this|that)\s+task\s+(i|we)\s+(created|made|added)\b/i.test(lower) ||
    /\b(abhi|abhi abhi|abhi jo|fresh|naya)\s+(banaya|banayi|bana|create|bani)\b/i.test(lower) ||
    /\b(ne|ne\s+hi)\s+(banaya|banayi|bana diya|create)\b/i.test(lower);
  // Allow assignment to override if sentence clearly means assign to an existing past-tense or created task
  if (
    wantsCreate &&
    !/\b(assign|assine|asign|reassign)\b/i.test(lower) &&
    !titleChangeCue &&
    !pastCreatedRef
  ) {
    return { tool: "createSimpleTask", input: {}, source: "quick" };
  }

  // ── Case 6: File update (assign se pehle, taaki "file change" pe assign misfire na ho)
  const wantsFileUpdate =
    /(file|attachment|attach|attached|document|pdf|image|screenshot|upload|chipka|chipkao|laga|lagao|lgado)/i.test(lower) &&
    /(tasks?\b|task list|kaam|kam|due date|deadline|jiski due|isko|usko|usme|isme|jisme|jinme|iska|iski|uska|uski|yahi|wahi|update|replace|badal|change)/i.test(
      lower
    );
  if (wantsFileUpdate) {
    return { tool: "updateTaskFile", input: {}, source: "quick" };
  }

  // ── Case 7: Assign / reassign task (strict phrases only)
  const wantsAssign =
    /\b(assign|assine|asign|reassign|allot|saupo|sign)\b/i.test(lower) ||
    /\bko\s+(assign|assine|asign|reassign|sign)\b/i.test(lower) ||
    /\b(assign|assine|asign|reassign|sign)\s+to\b/i.test(lower);
  if (
    !wantsCreate &&
    wantsAssign &&
    /(task|tasks|isko|is task|ye task|usko|us task|ko|this task|that task|the task|is\s*ko|us\s*ko|jo\s*task|jo\s*kaam|abhi\s+wala|abhi\s+wali|iska|iski)/i.test(
      lower
    )
  ) {
    const m =
      userInput.match(/\b(?:to\s+)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i) ||
      userInput.match(/\b(?:isko|usko|is task ko|ye task ko)\s+(.+?)\s+ko\s+(?:assign|assine|asign|reassign|sign)\b/i) ||
      userInput.match(/\b(.+?)\s+ko\s+(?:assign|assine|asign|reassign|sign)\b/i) ||
      userInput.match(/\b(?:assign|reassign|sign)\s+to\s+(.+?)(?:\s+please)?$/i) ||
      userInput.match(/\b(?:assign|reassign|sign)\s+(.+?)\s+to\s+this\s+task\b/i);
    const assigneeQuery = m?.[1]?.trim() || "";
    return { tool: "assignTask", input: assigneeQuery ? { assigneeQuery } : {}, source: "quick" };
  }

  // ── Case 8: Title update (due-date sentence se conflict avoid karne ke liye due update se pehle)
  const titleField = /(title|name|nam|naam|heading|shirshak)\b/i.test(lower);
  const titleVerb =
    /(update|change|rename|badal|badlo|set|kro|karo|kar do|krdo|karna|karni|rakho|rakhna|likh|likho|likh do)/i.test(
      lower
    );
  const titleTaskRef =
    /(task|tasks|jiski due|jiska|jiski|uska|uski|iska|iski|isko|is task|ye task|this task|that task|the task|whose due|abhi wala|abhi wali|jo banaya|jo banayi|kaam|kam)/i.test(
      lower
    );
  const wantsTitleUpdate =
    titleField &&
    titleVerb &&
    (titleTaskRef || (lower.length < 120 && titleField && titleVerb)) &&
    !/(status|done|complete|completed|verify|approved|submitted)/i.test(lower);
  if (wantsTitleUpdate) {
    return { tool: "updateTaskTitle", input: {}, source: "quick" };
  }

  // ── Case 8b: Description update (short phrase = last-touched task se bind hoga)
  const wantsDescUpdate =
    /\b(description|discription|details|detail|vivran|notes?|remark|remarks|info)\b/i.test(lower) &&
    /\b(update|change|edit|set|badal|badlo|likho|likh)\b/i.test(lower) &&
    (/(task|tasks|this|that|the|is|iski|iska|isko|uska|uski|kaam|kam|abhi)/i.test(lower) ||
      (lower.length < 115 && /\b(update|change|edit|set|badal|likho)\b/i.test(lower)));
  if (wantsDescUpdate) {
    return { tool: "updateTaskDescription", input: {}, source: "quick" };
  }

  // ── Case 9: Due date change (detail Groq / context se aayega)
  const wantsDueUpdate =
    /(due date|deadline|last date|do date|do dat|tarikh|tareek|tareekh|tarik|\bdue\b|\bdate\b)/i.test(lower) &&
    /(change|badal|badlo|badhao|badh|bdhao|bdha|update|set|krdo|kardo|karo|kar do|extend|aage|shift|move|reschedule|postpone|prepone|plus)/i.test(
      lower
    ) &&
    (/(task|tasks|kaam|kam)/i.test(lower) ||
      /\b(is|iski|iske|iska|uska|uski|ye|yeh|yehi|yahi|wahi|abhi|this|that|the)\b/i.test(lower) ||
      (lower.length < 130 &&
        /(due date|deadline|tarikh|tareek|do date|\bdue\b)/i.test(lower) &&
        /(change|badal|badhao|set|extend|aage|shift|krdo|kardo)/i.test(lower)));
  if (wantsDueUpdate) {
    return { tool: "updateTaskDueDate", input: {}, source: "quick" };
  }

  // Baaki sab → AI pe bhejo
  return null;
}

module.exports = { quickIntent };