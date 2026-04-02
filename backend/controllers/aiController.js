const { runAgent } = require("../utils/aiAgent");
const { quickIntent } = require("../utils/quickIntent");
const { classifyWithNLU } = require("../utils/nluSystem");
const { executeTool } = require("../utils/toolExecutor");
const Task = require("../models/Task");
const User = require("../models/User");
const { isAllowed, requiresConfirmation, isForbiddenIntent } = require("../utils/guard");
const { askAnalyst } = require("../utils/aiAnalyst");
const { replyIfUnsupportedChatAction } = require("../utils/chatUnsupportedIntents");
const { setChatTaskContext, peekChatTaskContext } = require("../utils/chatTaskContext");
const {
  mergeAiToolInput,
  finalizeUpdateDueDateInput,
  tryCoerceDateOnlyToDueDateUpdate,
  parseDueDateFromText,
} = require("../utils/parseDueDate");
const {
  sanitizeAgentResult,
  needsClarification,
  retrieveTaskCandidates,
  buildClarificationMessage,
} = require("../utils/intentResolver");
const { setDraft, getDraft, clearDraft } = require("../utils/chatDraftContext");
const { getFocusedAssignee, clearFocusedAssignee } = require("../utils/chatEntityContext");
const { isAiUnavailable, markAiUnavailable } = require("../utils/aiAvailability");
const {
  aiBusyMessage,
  unclearTaskMessage,
  nonTaskScopeMessage,
  safeErrorMessage,
} = require("../utils/chatUserMessages");
const { detectChatLanguage, pickByLanguage } = require("../utils/chatLanguage");
const { isWebsiteInfoQuery, getWebsiteInfoReply } = require("../utils/siteKnowledge");
const { evaluateRoutingPolicy } = require("../utils/chatRoutingPolicy");
const { deriveConversationState } = require("../utils/chatStateMachine");
const { normalizeChatText } = require("../utils/textNormalizer");
const { extractTitleHintVariants } = require("../utils/chatTitleHint");
const { findTaskByTitle, findMultipleTasksByTitles } = require("../utils/smartTaskFinder");
const { escapeRegex, escapeRegexTruncated } = require("../utils/regexSafe");
const axios = require("axios");

// 🔄 Fallback when Groq / AI path is unavailable (used by classifyIntent below)
function classifyIntentHeuristic(text) {
  const lower = (text || "").toLowerCase();
  if (/\b(how many|kitne|कितने)\b/i.test(lower)) return true;
  if (/\b(overview|summary|statistics|stats|snapshot|progress)\b/i.test(lower)) return true;
  if (/\b(show|dikhao|dikha|dikha do|list|fetch|export|download|cancel|start|verify|approve|create|add|banao|karo|kar do)\b/i.test(lower))
    return false;
  return false;
}

function isUserTaskCountQuery(text) {
  const lower = String(text || "").toLowerCase();
  const asksAllUsers = /\b(saare\s*user|sare\s*user|sab\s*user|all\s*users?)\b/i.test(lower);
  if (asksAllUsers) return true;
  const asksCount = /(kitne|how many|count|total)/i.test(lower);
  const hasTaskWord = /(task|tasks|assigned tasks|kaam)/i.test(lower);
  const hasPersonRef =
    /(k\s*pass|k\s*paas|ke\s*pass|ke\s*paas|mera|meri|my|apna|apni|khud|own|\buser\b|@)/i.test(lower);
  return asksCount && hasTaskWord && hasPersonRef;
}

function hasPersonScopeInQuery(text) {
  const lower = String(text || "").toLowerCase();
  return /(k\s*pass|k\s*paas|ke\s*pass|ke\s*paas|mera|meri|my|apna|apni|khud|own|user\s+\w+|@)/i.test(lower);
}

function extractStatusForCountQuery(text) {
  const lower = String(text || "").toLowerCase();
  if (/\bpending|pend\b/i.test(lower)) return "pending";
  if (/\b(in[\s_]?progress|progress)\b/i.test(lower)) return "in_progress";
  if (/\bverified\b/i.test(lower)) return "verified";
  if (/\bcancelled?\b/i.test(lower)) return "cancelled";
  if (/\bsubmitted?\b/i.test(lower)) return "submitted";
  if (/\brejected?\b/i.test(lower)) return "rejected";
  if (/\bdue|overdue|expired\b/i.test(lower)) return "due";
  return null;
}

function isGlobalTaskCountQuery(text) {
  const lower = String(text || "").toLowerCase();
  const asksCount = /\b(kitne|how many|count|total)\b/i.test(lower);
  const hasTaskWord = /\b(task|tasks|kaam)\b/i.test(lower);
  if (!asksCount || !hasTaskWord) return false;
  return !hasPersonScopeInQuery(lower);
}

function isIdentityQuery(text) {
  const lower = String(text || "").toLowerCase();
  return (
    /(mera\s*role|merarole|my role|role kya|main kaun|me kon hu|mein kon hu|who am i|meri email|my email|mera naam|my name)/i.test(
      lower
    )
  );
}

function isSmallTalk(text) {
  const lower = String(text || "").toLowerCase().trim();
  return (
    /^(hi|hii|hello|hey|heyy|hlo|hola|namaste|ram ram)\b/.test(lower) ||
    /\b(how are you|how r u|kese ho|kaise ho|kaisa hai|kya haal|kya hal|whats up|what's up)\b/.test(lower) ||
    /^(acha|achaa|accha|ok|okay|theek|theek hai|thik|thik hai)\b/.test(lower)
  );
}

function smallTalkReply(text) {
  const lower = String(text || "").toLowerCase();
  const lang = detectChatLanguage(text);
  if (/\bhow are you|how r u|whats up|what's up\b/.test(lower)) {
    return pickByLanguage(lang, {
      en: "I am doing great and ready to help. Tell me what you want to do with tasks 🙂",
      hi: "मैं बढ़िया हूँ और मदद के लिए तैयार हूँ। बताइए, tasks में क्या करना है 🙂",
      hinglish: "I am doing great and ready to help. Aap batao — tasks me kya karna hai? 🙂",
    });
  }
  return pickByLanguage(lang, {
    en: "Hey! 👋 I am ready. Tell me what help you need with tasks — list, create, update, assign, or due date.",
    hi: "नमस्ते! 👋 मैं तैयार हूँ। बताइए tasks में क्या मदद चाहिए — list, create, update, assign या due date.",
    hinglish: "Hey! 👋 Main ready hoon. Bolo tasks me kya help chahiye — list, create, update, assign ya due date.",
  });
}

function isCapabilityQuery(text) {
  const lower = String(text || "").toLowerCase();
  return /(kya kya|kya kar sakte|kya kr skte|what can you do|what you can do|what can u do|capabilit|help menu|commands?)/i.test(lower);
}

function capabilityReply() {
  return null;
}

function l10n(lang, en, hi, hinglish) {
  return pickByLanguage(lang, { en, hi, hinglish });
}

function isUnsafeOrAdultOffTopic(text) {
  const lower = String(text || "").toLowerCase();
  return /(weapon|gun|bomb|explosive|kill|murder|hack|malware|porn|xxx|sex\b|sexual|sex video|adult|nude|nsfw)/i.test(
    lower
  );
}

function hasTaskDomainSignal(text) {
  const lower = String(text || "").toLowerCase();
  return /(task|tasks|due|deadline|pending|assigned|assign|start|cancel|verify|submit|dashboard|role|user|admin|my tasks|meri tasks|login|logout|delete|remove|hata|mita)/i.test(
    lower
  );
}

/** List ke aakhiri (neeche) item ko delete/remove/cancel — chat context IDs se. Plain "last" avoid (last pending ≠ list position). */
function wantsLastListedTaskRemove(text) {
  const lower = String(text || "").toLowerCase();
  const refersListEnd =
    /\b(last\s*wale?|last\s*wali|akhiri|akheer|antim|sabse\s*(niche|neeche))\b/i.test(lower) ||
    /\b(neeche|niche)\s*wala\b/i.test(lower) ||
    /\blast\s+(ek|1|one)(\s+task)?\b/i.test(lower) ||
    /\blast\s+\d+\s+task\b/i.test(lower) ||
    /\blast\s+task\b/i.test(lower) ||
    /\b(ek|1)\s+last\s+task\b/i.test(lower);
  if (!refersListEnd) return false;
  return (
    /\b(delete|delet|remove|hata|hatao|mita|mitao|mitha|trash|khatam)\b/i.test(lower) ||
    /\bcancel\b/i.test(lower)
  );
}

function isUserAssignedListQuery(text) {
  const lower = String(text || "").toLowerCase();
  const hasListVerb = /(dikho|dikhao|dikha|show|list|fetch|dekho|lao)/i.test(lower);
  const hasTaskWord = /(task|tasks|assigned task|assigned tasks|kaam)/i.test(lower);
  const hasPersonRef = /(k\s*pass|k\s*paas|ke\s*pass|ke\s*paas|mera|meri|my|khud|own|\buser\b|@)/i.test(lower);
  return hasListVerb && hasTaskWord && hasPersonRef;
}

function isFileUpdatePhrase(text) {
  const lower = String(text || "").toLowerCase();
  const hasFile =
    /(file|attachment|attach|attached|document|pdf|image|screenshot|upload)/i.test(lower);
  if (!hasFile) return false;
  return /(update|replace|change|badal|badlo|attach|upload|lagao|laga|dal\s*do|daal|jo\s+attached)/i.test(
    lower
  );
}

function extractUserQueryFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const email = raw.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i);
  if (email?.[1]) return email[1].trim();
  const m =
    raw.match(/\b(.+?)\s+k\s+p(?:a|aa)ss\b/i) ||
    raw.match(/\b(.+?)\s+ke\s+p(?:a|aa)ss\b/i) ||
    raw.match(/\b(.+?)\s+ka\s+(?:assigned\s+)?task/i) ||
    raw.match(/\b(.+?)\s+ki\s+(?:assigned\s+)?task/i);
  return String(m?.[1] || "")
    .replace(/\b(user|users|member|members)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUserText(text) {
  return normalizeChatText(text);
}

/** Groq kabhi-kabhi "pending tasks cancel" ko analytical samajh leta hai — analyst phir galat salah deta hai */
function mustUseActionPath(text) {
  const lower = (text || "").toLowerCase();
  const isCountQuestion = /\b(kitne|how many|कितने)\b/i.test(lower);
  const hasImperative = /\b(karo|krdo|kardo|kar do|kar de|kardi|karna|lagao)\b/i.test(lower);
  if (isCountQuestion && !hasImperative) return false;

  const hasTaskWord = /(task|tasks|kaam)/i.test(lower);
  const hasPending = /pending|pend/i.test(lower);
  const cancelVerb = /(cancel|band|rok|khatam)/i.test(lower);
  const otherMutate =
    /(verify|approve|pass|start|shuru|begin|chalu|export|download|create|add|banao|banado|assign|reassign)/i.test(lower);

  if ((cancelVerb || otherMutate) && (hasTaskWord || hasPending)) return true;
  if (cancelVerb && /\b(inko|inho|unko|unhe|in ko|in sab|ye sab|yehi)\b/i.test(lower)) return true;

  if (/(due date|deadline|\bdue\b)/i.test(lower) && /(change|badal|badlo|update|set|krdo|karo|extend)/i.test(lower))
    return true;

  if (
    /(pending|pend)/i.test(lower) &&
    /(due|deadline|date)/i.test(lower) &&
    /(badh|badhao|badha|extend|aage|delay|shift)/i.test(lower)
  )
    return true;

  if (
    hasTaskWord &&
    /(complete|completed|done|mark)/i.test(lower) &&
    /(started|start ho|in progress|in_progress|chalu|shuru|running)/i.test(lower)
  )
    return true;

  return false;
}

/** User wants a list (not mutate): bta/batao, dikhao, export/download, kitne... */
const TASK_LIST_VERB_RE =
  /\b(bta|btao|batao|batado|batana|dikhao|dikha|dikha do|show|list|fetch|dekho|lao|kitne|how many|count|total|export|download)\b/i;

function hasTaskListIntent(text) {
  const lower = String(text || "").toLowerCase();
  return /(task|tasks|task list)/i.test(lower) && TASK_LIST_VERB_RE.test(lower);
}

/**
 * "cancelled/canceled task bta" = list filter, NOT cancelTask mutation.
 */
function isStatusFilteredListQuery(text) {
  const lower = String(text || "").toLowerCase();
  if (!/\b(tasks?|kaam)\b/i.test(lower)) return false;
  if (!TASK_LIST_VERB_RE.test(lower)) return false;
  if (/\b(cancelled|canceled)\b/i.test(lower)) return true;
  if (/\b(pending|verified|rejected|submitted)\b/i.test(lower)) return true;
  if (/\b(in[\s_]?progress|processing)\b/i.test(lower)) return true;
  if (/\b(due|overdue|expired)\b/i.test(lower) && !/\b(update|change|badal|extend)\b/i.test(lower)) return true;
  return false;
}

function extractSearchKeywordFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const cleanKeyword = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\b(aata|aate|aayi|aata hai|hai|ho|h|wo|wale|wala|wahi|please)\b/gi, " ")
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

  const quoted =
    raw.match(/\b(?:keyword|search|find|filter)\b[^"'`]*["'`](.+?)["'`]/i) ||
    raw.match(/\b(?:jisme|jinme|jismein|jinmein)\b[^"'`]*["'`](.+?)["'`]\s*(?:keyword)?/i);
  if (quoted?.[1]) return cleanKeyword(quoted[1]);

  const scoped =
    raw.match(/\b(?:jisme|jinme|jismein|jinmein)\s+(.+?)\s+keyword\b/i) ||
    raw.match(/\bwith\s+(.+?)\s+keyword\b/i);
  if (scoped?.[1]) {
    const cleanedScoped = cleanKeyword(scoped[1]);
    if (cleanedScoped) return cleanedScoped;
  }

  const beforeKeyword =
    raw.match(/\b([a-zA-Z0-9_-]{2,})\s+keyword\b/i) ||
    raw.match(/\bkeyword\s+([a-zA-Z0-9_-]{2,})\b/i);
  if (beforeKeyword?.[1]) {
    const k = cleanKeyword(beforeKeyword[1]);
    if (k) return k;
  }

  const m =
    raw.match(/\b(?:keyword|search|find|filter)\s+([a-zA-Z0-9 _-]{2,})$/i) ||
    raw.match(/\b(?:jisme|jinme|jismein|jinmein)\s+([a-zA-Z0-9 _-]{2,})\s+(?:keyword|aata|aate|hai|ho)\b/i);
  return cleanKeyword(m?.[1] || "");
}

function hasKeywordSearchIntent(text) {
  const lower = String(text || "").toLowerCase();
  const hasKeywordTerm = /\b(keyword|search|find|filter|jisme|jinme|jismein|jinmein)\b/i.test(lower);
  const hasTaskTerm = /(task|tasks|task list)\b/i.test(lower);
  if (hasKeywordTerm && hasTaskTerm) return true;
  if (hasKeywordTerm && extractSearchKeywordFromText(lower)) return true;
  return false;
}

function isGenericListOnly(text) {
  const lower = String(text || "").toLowerCase().trim();
  const asksList = TASK_LIST_VERB_RE.test(lower);
  const hasTaskWord = /\b(task|tasks|task list)\b/i.test(lower);
  const hasSpecificFilter = /\b(cancelled|rejected|verified|submitted|pending|due|today|aaj|kal|tomorrow|assign|title|status)\b/i.test(
    lower
  );
  return asksList && (!hasTaskWord || hasTaskWord) && !hasSpecificFilter;
}

function extractQuickCreateInput(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const lower = raw.toLowerCase();

  // Prefer phrase after "ki/that" as task intent
  let title = "";
  const kiIdx = lower.lastIndexOf(" ki ");
  const thatIdx = lower.lastIndexOf(" that ");
  const cutIdx = Math.max(kiIdx, thatIdx);
  if (cutIdx > -1) {
    const token = cutIdx === kiIdx ? " ki " : " that ";
    title = raw.slice(cutIdx + token.length).trim();
  }

  if (!title) {
    title = raw
      .replace(/\b(kl|kal|aaj|today|tomorrow|tmr|tmrw|subah|morning|evening|shaam|raat|night)\b/gi, " ")
      .replace(/\b(\d{1,2})(?::\d{2})?\s*(bje|baje|am|pm)?\b/gi, " ")
      .replace(/\b(ek|naya|mujhe|mera|jiska|uska|koi|please|plz|sir|madam)\b/gi, " ")
      .replace(/\b(task|tasks|create|add|banao|banado|bana|kro|karo|kar do|kardo|make|new)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (title && title.length < 3) title = ""; // avoid tiny garbage leftovers

  if (!title) return {};
  title = title.slice(0, 90);
  return {
    title,
    description: "Created via AI assistant",
  };
}

function inferListFiltersFromText(text) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const searchKeyword = extractSearchKeywordFromText(raw);
  const statusMap = [
    { re: /\b(cancelled?|canceled)\b/i, status: "cancelled" },
    { re: /\brejected?\b/i, status: "rejected" },
    { re: /\bverified?\b/i, status: "verified" },
    { re: /\b(submitted?|submited|submittted|submit(ed)?)\b/i, status: "submitted" },
    { re: /\b(in[\s_]?progress|progress)\b/i, status: "in_progress" },
    { re: /\bpending\b/i, status: "pending" },
    { re: /\bdue|expired|overdue\b/i, status: "due" },
  ];
  const statusHit = statusMap.find((x) => x.re.test(lower));

  const asksList = /(task|tasks|task list)/i.test(lower) && TASK_LIST_VERB_RE.test(lower);

  const wantsDueList =
    /(due|deadline|due date)/i.test(lower) &&
    /(task|tasks|dikhao|show|list|dekho|btao|batao|bta|kitne|count|export|download)/i.test(lower);
  // If not a due-date style list, apply generic status listing.
  if (!wantsDueList) {
    if (asksList && statusHit) {
      return { ...(searchKeyword ? { search: searchKeyword } : {}), status: statusHit.status };
    }
    return searchKeyword ? { search: searchKeyword } : {};
  }

  const out = {};
  out.statusIn = "pending,in_progress,submitted,due";
  const fmtLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (/\b(aaj|today)\b/i.test(lower)) {
    out.from = fmtLocalYMD(start);
    out.to = fmtLocalYMD(end);
    return out;
  }

  if (/\b(kal|tomorrow|tmr|tmrw)\b/i.test(lower)) {
    const s = new Date(start);
    s.setDate(s.getDate() + 1);
    const e = new Date(end);
    e.setDate(e.getDate() + 1);
    out.from = fmtLocalYMD(s);
    out.to = fmtLocalYMD(e);
    return out;
  }

  // Common Hinglish typo normalization for month names.
  const normalizedRaw = raw.replace(/\baprail\b/gi, "april");

  // Specific date phrase: "1 aprail ko due ...", "due 1 apr", etc.
  const parsed = parseDueDateFromText(normalizedRaw);
  if (parsed && !isNaN(parsed.getTime())) {
    const s = new Date(parsed);
    s.setHours(0, 0, 0, 0);
    const e = new Date(parsed);
    e.setHours(23, 59, 59, 999);
    out.from = fmtLocalYMD(s);
    out.to = fmtLocalYMD(e);
    return out;
  }

  // "due tasks dikhao" without explicit date still maps to due-like statuses.
  if (searchKeyword) out.search = searchKeyword;
  return out;
}

function looksLikeCancelDraft(text) {
  return /^\s*(cancel|chhodo|rehne do|mat karo|stop|abort|nahi|nhi)\s*$/i.test(String(text || ""));
}

function extractCandidateSelectionIndex(text) {
  const lower = String(text || "").toLowerCase().trim();
  if (!lower) return null;
  const numeric = lower.match(/\b(\d{1,2})\s*(?:number|num|no|option)?\b/);
  if (numeric) {
    const n = parseInt(numeric[1], 10);
    if (!isNaN(n) && n > 0) return n - 1;
  }
  if (/\b(first|1st|fist|pehla|pehle)\b/i.test(lower)) return 0;
  if (/\b(second|2nd|dusra|doosra)\b/i.test(lower)) return 1;
  if (/\b(third|3rd|teesra)\b/i.test(lower)) return 2;
  return null;
}

function isStatusFilterFollowup(text) {
  const lower = String(text || "").toLowerCase();
  const hasStatus = /\b(pending|in[\s_]?progress|progress|processing|prosesing|verified|cancelled|submitted|rejected|due|expired)\b/i.test(lower);
  const hasFilterCue = /\b(filter|lagao|lgao|dikhao|show|list)\b/i.test(lower);
  return hasStatus && hasFilterCue;
}

function inferStatusActionTool(text) {
  const lower = String(text || "").toLowerCase();
  if (isFileUpdatePhrase(text)) return null;
  if (!/\bstatus\b/i.test(lower)) return null;
  if (/\b(processing|prosesing|in[\s_]?progress|start(?:ed)?)\b/i.test(lower)) return "startTask";
  if (/\b(cancelled?|cancel)\b/i.test(lower)) return "cancelTask";
  if (/\b(verified?|approve|approved)\b/i.test(lower)) return "verifyTask";
  return null;
}

function extractAssignInput(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const out = {};
  const email = raw.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (email) out.assigneeQuery = email[1];

  const titleLead = raw.match(/\b(.+?)\s+task\s+ko\s+.+?\s+(?:assign|assine|asign|reassign)\b/i);
  if (titleLead?.[1]) out.taskTitle = titleLead[1].trim();

  const refKo = raw.match(
    /\b(?:isko|usko|is task ko|ye task ko)\s+(.+?)\s+ko\s+(?:assign|assine|asign|reassign)\b/i
  );
  if (refKo?.[1]) out.assigneeQuery = refKo[1].trim();
  const byKo = raw.match(/\b(.+?)\s+ko\s+(?:assign|assine|asign|reassign)\b/i);
  if (byKo?.[1] && !out.assigneeQuery) out.assigneeQuery = byKo[1].trim();
  const byTo = raw.match(/\b(?:assign|assine|asign|reassign)\s+(?:to\s+)?(.+?)\b$/i);
  if (byTo?.[1] && !out.assigneeQuery) out.assigneeQuery = byTo[1].trim();

  const parsed = parseDueDateFromText(raw);
  if (parsed) out.dueDate = parsed.toISOString();

  return out;
}

function extractTitleUpdateInput(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  let title = "";
  const m1 = raw.match(/\b(?:title|name)\b.*?\b(?:ki|to)\s+(.+)$/i);
  if (m1?.[1]) title = m1[1].trim();
  if (!title) {
    const m2 = raw.match(/\b(?:rename|update|change|badal|badlo)\b.*?\b(?:to)\s+(.+)$/i);
    if (m2?.[1]) title = m2[1].trim();
  }
  if (!title) return {};
  return { title: title.replace(/["'.\s]+$/g, "").slice(0, 140) };
}

function isStatusMutationPhrase(text) {
  const lower = String(text || "").toLowerCase();
  const hasStatusWord = /\bstatus\b/.test(lower);
  const hasStateToken =
    /\b(done|complete|completed|cancel|cancelled|start|started|in progress|in_progress|submitted|verified|rejected|pending)\b/.test(
      lower
    );
  return hasStatusWord && hasStateToken;
}

function isValidObjectId(id) {
  return /^[a-f\d]{24}$/i.test(String(id || ""));
}

function hasYearInText(text) {
  return /\b(19|20)\d{2}\b/.test(String(text || ""));
}

function sameLocalSlot(a, b, strictYear = true) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  if (strictYear && a.getFullYear() !== b.getFullYear()) return false;
  return (
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

function extractIncrementDays(text) {
  const lower = String(text || "").toLowerCase();
  const m = lower.match(/(\d{1,3})\s*(day|days|din)\s*(badha|badhao|badh|extend|aage|increase)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (isNaN(n) || n <= 0) return null;
  return Math.min(n, 365);
}

function extractReferenceDueText(text) {
  const s = String(text || "");
  const m = s.match(/due\s*date\s+(.+?)\s+hai/i);
  return m?.[1]?.trim() || s;
}

async function resolveTaskIdForAssignFromText(userId, text) {
  const parsed = parseDueDateFromText(extractReferenceDueText(text));
  if (!parsed || isNaN(parsed.getTime())) return null;

  const list = await Task.find({
    $or: [{ createdBy: userId }, { assignedTo: userId }],
  })
    .select("_id dueDate status")
    .lean();
  if (!list.length) return null;

  const strictYear = hasYearInText(text);
  const exact = list.filter((t) => t?.dueDate && sameLocalSlot(new Date(t.dueDate), parsed, strictYear));
  if (exact.length === 1) return String(exact[0]._id);

  if (exact.length > 1) {
    const active = exact.filter((t) => t.status !== "cancelled" && t.status !== "verified");
    if (active.length === 1) return String(active[0]._id);
  }
  return null;
}

async function resolveTaskIdFromText(userId, text, rawText = null) {
  const oid = String(text || "").match(/\b[a-f\d]{24}\b/i);
  if (oid?.[0]) return oid[0];

  const byDue = await resolveTaskIdForAssignFromText(userId, text);
  if (byDue) return byDue;

  const variants = extractTitleHintVariants(text, rawText);
  const escs = variants.map((h) => escapeRegexTruncated(h)).filter(Boolean);
  if (!escs.length) return null;

  const orCond = escs.flatMap((esc) => [
    { title: { $regex: esc, $options: "i" } },
    { description: { $regex: esc, $options: "i" } },
  ]);

  const list = await Task.find({
    $and: [{ $or: [{ createdBy: userId }, { assignedTo: userId }] }, { $or: orCond }],
  })
    .select("_id status")
    .lean();
  const dedup = [];
  const seen = new Set();
  for (const t of list) {
    const id = String(t._id);
    if (seen.has(id)) continue;
    seen.add(id);
    dedup.push(t);
  }
  if (dedup.length === 1) return String(dedup[0]._id);
  if (dedup.length > 1) {
    const active = dedup.filter((t) => t.status !== "cancelled" && t.status !== "verified");
    if (active.length === 1) return String(active[0]._id);
  }
  return null;
}

async function suggestTaskChoicesFromTitle(userId, text, limit = 3, rawText = null) {
  const variants = extractTitleHintVariants(text, rawText);
  const escs = variants.map((h) => escapeRegexTruncated(h)).filter(Boolean);
  if (!escs.length) return [];

  const orCond = escs.flatMap((esc) => [
    { title: { $regex: esc, $options: "i" } },
    { description: { $regex: esc, $options: "i" } },
  ]);

  const list = await Task.find({
    $and: [{ $or: [{ createdBy: userId }, { assignedTo: userId }] }, { $or: orCond }],
  })
    .select("_id title status dueDate")
    .sort({ updatedAt: -1 })
    .limit(Math.max(limit * 6, 18))
    .lean();
  const out = [];
  const seen = new Set();
  for (const t of list) {
    const id = String(t._id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out.map((t) => ({
    taskId: String(t._id),
    title: t.title,
    status: t.status,
    dueDate: t.dueDate,
  }));
}

async function parseAICommandPayload(req) {
  let text = "";
  let pendingTool = null;
  let pendingInput = null;
  let contextTaskIds = [];
  let uploadedFile = null;

  if (typeof req.isMultipart === "function" && req.isMultipart()) {
    const parts = req.parts();
    for await (const part of parts) {
      if (part.file && part.fieldname === "file") {
        const buffer = await part.toBuffer();
        uploadedFile = {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
          buffer,
        };
      } else if (part.type === "field") {
        if (part.fieldname === "text") text = String(part.value || "");
        if (part.fieldname === "pendingTool") pendingTool = String(part.value || "");
        if (part.fieldname === "pendingInput") {
          try {
            pendingInput = JSON.parse(part.value || "{}");
          } catch {
            pendingInput = {};
          }
        }
        if (part.fieldname === "contextTaskIds") {
          try {
            const arr = JSON.parse(part.value || "[]");
            if (Array.isArray(arr)) contextTaskIds = arr;
          } catch {
            contextTaskIds = [];
          }
        }
      } else if (part.file) {
        await part.toBuffer();
      }
    }
  } else {
    const body = req.body || {};
    text = String(body.text || "");
    pendingTool = body.pendingTool || null;
    pendingInput = body.pendingInput || null;
    contextTaskIds = Array.isArray(body.contextTaskIds) ? body.contextTaskIds : [];
  }

  return { text, pendingTool, pendingInput, contextTaskIds, uploadedFile };
}

async function classifyIntent(text) {
  if (isAiUnavailable()) return classifyIntentHeuristic(text);
  if (!process.env.GROQ_API_KEY?.trim()) {
    return classifyIntentHeuristic(text);
  }
  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an intent classifier. Classify into ONE of:
"action" — user wants to PERFORM/EXECUTE something
"analytical" — user wants to KNOW/SEE information only

ACTION → reply "action":
- Any fetch/show/list of tasks
- cancel, start, verify, export tasks
- "karo", "kardo", "kar do", "kar de", "dikhao", "dikha do"
- "haan", "yes", "confirm", "pakka", "theek hai" (confirmations)

ANALYTICAL → reply "analytical":
- "kitne hain", "how many", counts, stats
- "kya status hai", "progress kya hai"
- Questions about numbers/info only

CRITICAL: "haan", "yes", "pakka", "theek hai" → ALWAYS "action" (confirmations)
CRITICAL: "X tasks dikhao/dikha" → ALWAYS "action"
CRITICAL: "pending tasks cancel", "cancel pending", "tasks cancel karo", "inko cancel" → ALWAYS "action" (never analytical)
CRITICAL: "due date change", "deadline extend", "start pending tasks" → ALWAYS "action"
CRITICAL: "pending due date 1 din badhao", "extend due by days" → ALWAYS "action"
CRITICAL: "started task complete", "in progress mark done" → ALWAYS "action" (handled as info reply, not analyst fluff)
CRITICAL: "new task banao", "task create karo" → ALWAYS "action"
CRITICAL: "isko X ko assign karo", "reassign task to X" → ALWAYS "action"

Reply with ONLY one word: action OR analytical`,
          },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );
    const result = res.data.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`[INTENT] "${text}" → ${result}`);
    return result === "analytical";
  } catch (err) {
    if (err?.response?.status === 429) {
      markAiUnavailable(120 * 1000);
    }
    console.error("classifyIntent error:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────
exports.handleAI = async (req, reply) => {
  try {
    const payload = await parseAICommandPayload(req);
    const rawUserText = String(payload.text || "").trim();
    const text = normalizeUserText(rawUserText);
    const { pendingTool, pendingInput, contextTaskIds, uploadedFile } = payload;
    const user = req.user;
    req.aiUploadFile = uploadedFile || null;
    req.aiRawUserText = rawUserText;
    req.aiOriginalText = text || "";
    req.setDraft = (d) => setDraft(user.id, d);

    if (Array.isArray(contextTaskIds) && contextTaskIds.length) {
      setChatTaskContext(user.id, contextTaskIds);
    }

    const draft = getDraft(user.id);
    const chatLang = detectChatLanguage(text);
    if (!text?.trim()) {
      if (draft?.tool === "updateTaskFile" && req.aiUploadFile?.buffer && isValidObjectId(draft?.input?.taskId)) {
        clearDraft(user.id);
        return await executeTool("updateTaskFile", { ...(draft.input || {}) }, req, reply);
      }
      return reply.send({
        success: false,
        message: pickByLanguage(chatLang, {
          en: "Please type something 😊",
          hi: "कृपया कुछ लिखिए 😊",
          hinglish: "Kuch toh type karo! 😊",
        }),
      });
    }

    if (isSmallTalk(text)) {
      return reply.send({
        success: true,
        type: "analyst",
        message: smallTalkReply(text),
      });
    }

    if (isCapabilityQuery(text)) {
      return reply.send({
        success: true,
        type: "analyst",
        message: pickByLanguage(chatLang, {
          en:
            "I can help with WorkSync tasks: list/filter, quick create, title/due/file updates, assign, start/cancel pending, and task/user insights.",
          hi:
            "मैं WorkSync tasks में मदद कर सकता हूँ: list/filter, quick create, title/due/file update, assign, pending start/cancel, और task/user insights.",
          hinglish:
            "Main WorkSync me ye sab kar sakta hoon: tasks list/filter, quick create, title/due/file update, assign, pending start/cancel, aur task/user insights.",
        }),
      });
    }

    if (isWebsiteInfoQuery(text)) {
      return reply.send({
        success: true,
        type: "analyst",
        message: getWebsiteInfoReply(text),
      });
    }

    if (isUnsafeOrAdultOffTopic(text)) {
      return reply.send({
        success: true,
        type: "analyst",
        message: nonTaskScopeMessage(chatLang),
      });
    }

    // Jo list chat mein aayi (contextTaskIds), uske sabse neeche wale task ko cancel — hard DB delete API nahi
    if (wantsLastListedTaskRemove(text)) {
      const listedIds = peekChatTaskContext(user.id);
      if (!listedIds.length) {
        return reply.send({
          success: true,
          type: "analyst",
          message: l10n(
            chatLang,
            "First show a task list in chat (e.g. \"cancelled tasks dikhao\"), then say \"last wala cancel\" or \"last task delete\". I use the list order from your last reply — permanent DB delete is not available here; I can cancel (admin only).",
            "पहले chat में task list दिखाएँ, फिर \"last wala cancel\" बोलें। यहाँ permanent delete नहीं — cancel (admin)।",
            "Pehle chat mein list dikhao (jaise \"cancelled task bta\"), phir bolo \"last wala delete/cancel\". Neeche wala = list ka last item. Permanent DB delete yahan nahi — **cancel** hoga (sirf admin)."
          ),
        });
      }
      if (!isAllowed(user, "cancelTask")) {
        return reply.send({
          success: true,
          type: "analyst",
          message: l10n(
            chatLang,
            "Your role cannot cancel tasks from chat. Use the app or ask an admin.",
            "आपके role से chat से cancel/delete नहीं हो सकता।",
            "Tumhare role se chat se task cancel/delete allowed nahi. Tasks page ya admin se karo."
          ),
        });
      }
      const taskId = listedIds[listedIds.length - 1];
      return reply.send({
        success: true,
        confirm: true,
        tool: "cancelTask",
        input: { taskId },
        message: l10n(
          chatLang,
          "Cancel the bottom task from your last chat list? (Sets status to Cancelled — not permanent delete.)",
          "चैट लिस्ट का सबसे नीचे वाला task cancel करें? (स्थायी delete नहीं।)",
          "Jo list abhi chat mein thi, uske **sabse neeche wale** task ko **cancel** karun? (Permanent delete nahi — sirf Cancelled status.)"
        ),
      });
    }

    // 🎯 SMART TASK RESOLUTION - Handle task title extraction
    if (req.aiExtractedTaskTitle) {
      const foundTask = await findTaskByTitle(user, req.aiExtractedTaskTitle);
      if (foundTask) {
        req.aiExtractedTaskId = foundTask._id;
        req.aiExtractedTask = foundTask;
        console.log(`[TASK-RESOLVER] Found task "${req.aiExtractedTaskTitle}" → ID: ${foundTask._id}`);
      } else {
        console.log(`[TASK-RESOLVER] Task "${req.aiExtractedTaskTitle}" not found`);
      }
    }

    // Draft flow: createSimpleTask slot-filling (title + dueDate)
    if (draft) {
      if (isValidObjectId(text.trim())) {
        draft.input = draft.input || {};
        draft.input.taskId = text.trim();
        clearDraft(user.id);
        return await executeTool(draft.tool, draft.input, req, reply);
      }
      if (Array.isArray(draft.candidates) && draft.candidates.length) {
        const idx = extractCandidateSelectionIndex(text);
        if (idx != null && draft.candidates[idx]?.taskId) {
          const nextInput = { ...(draft.input || {}), taskId: draft.candidates[idx].taskId };
          clearDraft(user.id);
          return await executeTool(draft.tool, nextInput, req, reply);
        }
      }
    }
    if (draft?.tool === "createSimpleTask") {
      if (!isAllowed(user, "createSimpleTask")) {
        clearDraft(user.id);
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            "Task creation is admin-only. Please ask an admin to assign you a task.",
            "Task बनाना admin-only action है। कृपया admin से task assign करवाएँ।",
            "Task create karna admin-only action hai. Aap admin se task assign karwa sakte ho."
          ),
        });
      }
      if (looksLikeCancelDraft(text)) {
        clearDraft(user.id);
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "Okay, I have cancelled the create flow.",
            "ठीक है, create flow cancel कर दिया गया है।",
            "Theek hai, create flow cancel kar diya."
          ),
        });
      }

      const merged = { ...(draft.input || {}) };
      if (!merged.title) {
        const guessed = extractQuickCreateInput(text);
        if (guessed?.title) merged.title = guessed.title;
        if (guessed?.description) merged.description = guessed.description;
      }
      if (!merged.dueDate) {
        const d = parseDueDateFromText(text);
        if (d) merged.dueDate = d.toISOString();
      }

      if (!merged.title) {
        setDraft(user.id, { tool: "createSimpleTask", input: merged });
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "Please share the task title. Example: client update follow-up.",
            "कृपया task का title बताइए। उदाहरण: client update follow-up.",
            "Task ka title batao. Example: client ko update karna hai"
          ),
        });
      }
      if (!merged.dueDate) {
        setDraft(user.id, { tool: "createSimpleTask", input: merged });
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "Please share the due date. Example: 1 April 11:00 AM.",
            "कृपया due date बताइए। उदाहरण: 1 April 11:00 AM.",
            "Due date batao. Example: 1 April 11:00 AM ya kal subah 10 baje."
          ),
        });
      }

      clearDraft(user.id);
      return await executeTool("createSimpleTask", merged, req, reply);
    }

    if (draft?.tool === "updateTaskFile") {
      if (looksLikeCancelDraft(text)) {
        clearDraft(user.id);
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "Okay, I have cancelled the file update flow.",
            "ठीक है, file update flow cancel कर दिया गया है।",
            "Theek hai, file update flow cancel kar diya."
          ),
        });
      }

      const merged = { ...(draft.input || {}) };
      if (!isValidObjectId(merged.taskId)) {
        const inferred = await resolveTaskIdFromText(user.id, text, req.aiRawUserText);
        if (inferred) merged.taskId = inferred;
      }

      if (!isValidObjectId(merged.taskId)) {
        setDraft(user.id, { tool: "updateTaskFile", input: merged });
        return reply.send({
          success: true,
          type: "clarify",
          message:
            "Task clear nahi hui. Example: \"jiski due 31 Mar 12:00 PM hai usme file update karo\" ya exact task title/ID do.",
        });
      }

      if (!req.aiUploadFile?.buffer) {
        setDraft(user.id, { tool: "updateTaskFile", input: merged });
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            'Now attach the file and send a short message: "update this task file".',
            'अब file attach करके छोटा message भेजें: "is task ki file update karo".',
            'Ab file attach karke ek short message bhejo: "is task ki file update karo".'
          ),
        });
      }

      clearDraft(user.id);
      return await executeTool("updateTaskFile", merged, req, reply);
    }

    if (draft?.tool === "assignTask") {
      if (looksLikeCancelDraft(text)) {
        clearDraft(user.id);
        return reply.send({ success: true, type: "clarify", message: "Assignment cancelled." });
      }
      const merged = { ...(draft.input || {}) };
      const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
      if (emailMatch && draft.clarifyQuery) {
         merged.assigneeQuery = merged.assigneeQuery.replace(draft.clarifyQuery, emailMatch[1]);
      } else {
         merged.assigneeQuery = text.trim();
      }
      clearDraft(user.id);
      return await executeTool("assignTask", merged, req, reply);
    }


    // Standalone negative replies ko analyst-greeting pe mat bhejo
    if (/^\s*(nahi|nhi|nah|no|nope|nhi pta|nahi pata|pata nahi|dont know|don't know)\s*$/i.test(text)) {
      return reply.send({
        success: true,
        type: "clarify",
        message:
          "Theek hai, koi issue nahi. Agar task ID nahi pata, bolo: \"tasks dikhao\" ya \"jiska title <title> hai usko cancel/start karo\".",
      });
    }

    // 🚫 Hard block
    if (isForbiddenIntent(text)) {
      return reply.send({
        success: false,
        message: l10n(
          chatLang,
          "This action is not allowed.",
          "यह action allowed नहीं है।",
          "Ye action allowed nahi hai."
        ),
      });
    }

    // ─── PATH 1: Pending confirmation — "haan/nahi" handle karo ───
    // Frontend pending confirm bhej raha hai — seedha execute karo
    if (pendingTool) {
      if (!isAllowed(user, pendingTool)) {
        return reply.send({
          success: false,
          message: l10n(chatLang, "You do not have permission for this action.", "आपके पास इस action की permission नहीं है।", "Permission nahi hai 🔒"),
        });
      }
      return await executeTool(pendingTool, pendingInput || {}, req, reply);
    }

    // Policy-driven pre-routing (declarative rules, not imperative branch chains)
    const conversationState = deriveConversationState(draft, Boolean(req.aiUploadFile?.buffer));
    const routePolicy = evaluateRoutingPolicy(text, {
      currentDraftTool: draft?.tool || null,
      conversationState,
    });
    if (routePolicy.route === "analytical") {
      const answer = await askAnalyst(routePolicy.analystText || text, user.role, user.id);
      return reply.send({ success: true, type: "analyst", message: answer });
    }
    const forceActionByPolicy = routePolicy.route === "action";

    // ─── PATH 2: Classify ───
    if (isStatusFilterFollowup(text)) {
      const inferred = inferListFiltersFromText(`tasks ${text}`);
      return await executeTool("getTasks", inferred, req, reply);
    }

    if (isGlobalTaskCountQuery(text)) {
      const status = extractStatusForCountQuery(text);
      const filter =
        user.role === "admin"
          ? {}
          : { $or: [{ createdBy: user.id }, { assignedTo: user.id }] };
      if (status) filter.status = status;
      const total = await Task.countDocuments(filter);
      const statusLabel = status ? `${status} ` : "";
      return reply.send({
        success: true,
        type: "analyst",
        message: l10n(
          chatLang,
          `Total ${statusLabel}tasks: ${total}.`,
          `कुल ${statusLabel}tasks: ${total}.`,
          `Total ${statusLabel}tasks: ${total}.`
        ),
      });
    }

    if (isUserAssignedListQuery(text)) {
      const me = await User.findById(user.id).select("_id name email role").lean();
      const asksSelf =
        /\b(me|my|mera|meri|mujhe|apna|apni|khud|own)\b/i.test(text) ||
        (me?.name && String(text).toLowerCase().includes(String(me.name).toLowerCase())) ||
        (me?.email && String(text).toLowerCase().includes(String(me.email).toLowerCase()));

      if (user.role !== "admin" && !asksSelf) {
        return reply.send({
          success: true,
          type: "analyst",
          message:
            "Ye user-wise assigned task list admin-only hai. Apni list ke liye bolo: \"meri assigned tasks dikhao\".",
        });
      }

      const q = asksSelf ? (me?.email || me?.name || "") : extractUserQueryFromText(text);
      if (!q) {
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            "Which user's assigned tasks do you want? Please provide name or email.",
            "किस user की assigned tasks चाहिए? कृपया name या email दें।",
            "Kis user ki assigned tasks chahiye? Name ya email do."
          ),
        });
      }

      let users = [];
      if (q.includes("@")) {
        users = await User.find({
          email: { $regex: `^${escapeRegex(q)}$`, $options: "i" },
        })
          .select("_id name email role")
          .lean();
      } else {
        const tokens = q.split(/\s+/).filter(Boolean);
        const tokenRegex = tokens.map((t) => `(?=.*${escapeRegex(t)})`).join("");
        const safePattern = tokenRegex ? `${tokenRegex}.*` : escapeRegex(q);
        users = await User.find({ name: { $regex: safePattern, $options: "i" } })
          .select("_id name email role")
          .lean();
      }

      if (users.length > 1) {
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            `"${q}" matches ${users.length} users. Please provide exact email.`,
            `"${q}" से ${users.length} users match हो रहे हैं। कृपया exact email दें।`,
            `"${q}" se ${users.length} users mil rahe hain. Exact email do.`
          ),
        });
      }
      if (!users.length) {
        return reply.send({
          success: false,
          message: l10n(chatLang, `User "${q}" not found.`, `User "${q}" नहीं मिला।`, `User "${q}" nahi mila.`),
        });
      }

      return await executeTool("getTasks", { assignedTo: String(users[0]._id) }, req, reply);
    }

    if (isIdentityQuery(text) || isUserTaskCountQuery(text)) {
      const answer = await askAnalyst(text, user.role, user.id);
      return reply.send({ success: true, type: "analyst", message: answer });
    }

    let isAnalytical = await classifyIntent(text);
    if (forceActionByPolicy) isAnalytical = false;
    if (hasKeywordSearchIntent(text)) isAnalytical = false;
    if (mustUseActionPath(text)) isAnalytical = false;

    if (isAnalytical) {
      const answer = await askAnalyst(text, user.role, user.id);
      return reply.send({ success: true, type: "analyst", message: answer });
    }

    // ─── PATH 3: Action → Tool ───
    let aiRes = quickIntent(text);
    let source = aiRes ? "quick" : "ai";

    if (!aiRes) {
      const nluRes = await classifyWithNLU(text);
      if (nluRes) {
         aiRes = nluRes;
         source = "nlu";
      }
    }

    if (!aiRes && !isAiUnavailable()) {
      aiRes = await runAgent(text);
      source = "ai";
    }
    aiRes = sanitizeAgentResult(aiRes);

    if (aiRes?.tool === "cancelTask" && isStatusFilteredListQuery(text)) {
      aiRes = sanitizeAgentResult({
        tool: "getTasks",
        input: inferListFiltersFromText(text),
        confidence: 0.93,
        needs_clarification: false,
      });
      source = "status-list-not-cancel";
    }

    const forcedStatusTool = inferStatusActionTool(text);
    if (forcedStatusTool && ["unknown", "createSimpleTask", "assignTask"].includes(aiRes?.tool)) {
      aiRes = {
        ...aiRes,
        tool: forcedStatusTool,
        input: { ...(aiRes?.input || {}) },
        confidence: Math.max(Number(aiRes?.confidence || 0), 0.8),
        needs_clarification: !isValidObjectId(aiRes?.input?.taskId),
      };
      source = "status-intent-coerce";
    }

    console.log(`[AI] source=${source} tool=${aiRes?.tool} input=`, aiRes?.input);

    // Deterministic listing fallback: avoid unknown/clarification loops for list queries
    const hasFocusedAssignee = Boolean(getFocusedAssignee(user.id)?.assigneeUserId);
    if (hasTaskListIntent(text) || hasKeywordSearchIntent(text) || (isGenericListOnly(text) && hasFocusedAssignee)) {
      const inferredList = inferListFiltersFromText(text);
      if (
        aiRes?.tool === "unknown" ||
        aiRes?.tool === "getTasks" ||
        (aiRes?.tool === "cancelTask" && isStatusFilteredListQuery(text))
      ) {
        const focused = getFocusedAssignee(user.id);
        if (focused?.assigneeUserId && isGenericListOnly(text)) {
          inferredList.assignedTo = focused.assigneeUserId;
        }
        aiRes = {
          ...aiRes,
          tool: "getTasks",
          input: { ...(aiRes?.input || {}), ...inferredList },
          confidence: 0.92,
          needs_clarification: false,
        };
        source = "deterministic-list";
      }
    }

    if (!aiRes || aiRes.tool === "unknown") {
      const coerced = await tryCoerceDateOnlyToDueDateUpdate(text, user.id);
      if (coerced) {
        aiRes = coerced;
        source = coerced.source || "coerce-date";
      }
    }

    // During AI cooldown (e.g., 429), avoid repeated unknown loops.
    if ((isAiUnavailable() || !process.env.GROQ_API_KEY?.trim()) && (!aiRes || aiRes.tool === "unknown")) {
      const quickFallback = quickIntent(text);
      if (quickFallback?.tool) {
        aiRes = sanitizeAgentResult(quickFallback);
        source = "cooldown-quick-fallback";
      }
    }

    if ((isAiUnavailable() || !process.env.GROQ_API_KEY?.trim()) && (!aiRes || aiRes.tool === "unknown")) {
      // Deterministic task-list fallback if query resembles list intent.
      if (hasTaskListIntent(text) || hasKeywordSearchIntent(text) || isGenericListOnly(text)) {
        const inferredList = inferListFiltersFromText(text);
        const focused = getFocusedAssignee(user.id);
        if (focused?.assigneeUserId && isGenericListOnly(text)) {
          inferredList.assignedTo = focused.assigneeUserId;
        }
        aiRes = {
          tool: "getTasks",
          input: inferredList,
          confidence: 0.9,
          needs_clarification: false,
        };
        source = "cooldown-list-fallback";
      } else if (hasTaskDomainSignal(text)) {
        return reply.send({
          success: true,
          type: "clarify",
          message: unclearTaskMessage(chatLang),
        });
      } else {
        // For non-list intent in cooldown, send local analyst response directly.
        const answer = (await askAnalyst(text, user.role, user.id)) || aiBusyMessage(chatLang);
        return reply.send({ success: true, type: "analyst", message: answer });
      }
    }

    // create flow ko low-confidence clarification path me tootne se bachao
    if (aiRes?.tool === "createSimpleTask") {
      const guessed = extractQuickCreateInput(text);
      aiRes.input = { ...guessed, ...(aiRes.input || {}) };
      if (!aiRes.input?.title) {
        setDraft(user.id, { tool: "createSimpleTask", input: aiRes.input || {} });
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "Please share the task title and a short description.",
            "कृपया task title और short description बताइए।",
            "Task ka title aur short description kya hai?"
          ),
        });
      }
      if (!aiRes.input?.dueDate) {
        setDraft(user.id, { tool: "createSimpleTask", input: aiRes.input || {} });
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "What due date should I set for this task?",
            "इस task के लिए due date क्या रखनी है?",
            "Is task ki due date kya rakhni hai?"
          ),
        });
      }
      aiRes.needs_clarification = false;
      if (aiRes.confidence == null || aiRes.confidence < 0.6) aiRes.confidence = 0.8;
    }

    // Action tools ke liye clarification se pehle deterministic task resolve try karo
    if (["cancelTask", "startTask", "verifyTask", "updateTaskTitle", "updateTaskFile", "updateTaskDueDate", "assignTask"].includes(aiRes.tool)) {
      if (!isValidObjectId(aiRes.input?.taskId)) {
        const inferred = await resolveTaskIdFromText(user.id, text, req.aiRawUserText);
        if (inferred) aiRes.input.taskId = inferred;
      }
      if (isValidObjectId(aiRes.input?.taskId)) {
        aiRes.needs_clarification = false;
        if (aiRes.confidence == null || aiRes.confidence < 0.65) Math.max(0.8, aiRes.confidence || 0);
      } else {
        aiRes.needs_clarification = true;
      }
    }

    if (needsClarification(aiRes)) {
      if (!hasTaskDomainSignal(text)) {
        return reply.send({
          success: true,
          type: "analyst",
          message: nonTaskScopeMessage(chatLang),
        });
      }
      const blocked = replyIfUnsupportedChatAction(text, user.role);
      if (blocked) {
        return reply.send({ success: true, type: "analyst", message: blocked });
      }
      if (["cancelTask", "startTask", "verifyTask", "assignTask", "updateTaskTitle", "updateTaskDueDate", "updateTaskFile"].includes(aiRes?.tool)) {
        const choices = await suggestTaskChoicesFromTitle(user.id, text, 3, req.aiRawUserText);
        if (choices.length) {
          setDraft(user.id, { tool: aiRes.tool, input: aiRes.input || {}, clarifyQuery: text, candidates: choices });
          return reply.send({
            success: true,
            type: "clarify",
            tool: aiRes.tool,
            input: aiRes.input,
            confidence: aiRes?.confidence ?? null,
            candidates: choices,
            message:
              "Task clear nahi hai. Inme se kaunsi task pe action karna hai? Exact option ya ID do.",
          });
        }
      }
      const candidates = await retrieveTaskCandidates(user.id, text, 3, req.aiRawUserText);
      if (!candidates.length) {
        return reply.send({
          success: true,
          type: "clarify",
          tool: aiRes?.tool || "unknown",
          confidence: aiRes?.confidence ?? null,
          candidates: [],
          message: unclearTaskMessage(chatLang),
        });
      }
      return reply.send({
        success: true,
        type: "clarify",
        tool: aiRes?.tool || "unknown",
        input: aiRes?.input || {},
        confidence: aiRes?.confidence ?? null,
        candidates,
        message: buildClarificationMessage(aiRes, candidates),
      });
    }

    if (!aiRes || !aiRes.tool || aiRes.tool === "unknown") {
      const blocked = replyIfUnsupportedChatAction(text, user.role);
      if (blocked) {
        return reply.send({ success: true, type: "analyst", message: blocked });
      }
      const answer = await askAnalyst(text, user.role, user.id);
      return reply.send({
        success: true,
        type: "analyst",
        message: answer || unclearTaskMessage(chatLang),
      });
    }

    if (aiRes.tool === "createTask" || aiRes.tool === "submitTask") {
      const msg =
        replyIfUnsupportedChatAction(text, user.role) ||
        (aiRes.tool === "submitTask"
          ? "Task submit chat se nahi — My Tasks page use karo."
          : "Advanced task (file/assignee) chat se nahi — app form se banao.");
      return reply.send({ success: true, type: "analyst", message: msg });
    }

    aiRes.input = mergeAiToolInput(text, user.id, aiRes.tool, aiRes.input);

    if (aiRes.tool === "createSimpleTask") {
      // already normalized above; keep here as no-op guard for readability
    }

    if (aiRes.tool === "assignTask") {
      // Guard: LLM may misroute file-change text as assign because title contains "assigne".
      if (isFileUpdatePhrase(text)) {
        aiRes.tool = "updateTaskFile";
        aiRes.input = aiRes.input || {};
      }
    }

    if (aiRes.tool === "assignTask") {
      const guessed = extractAssignInput(text);
      aiRes.input = { ...guessed, ...(aiRes.input || {}) };
      if (!aiRes.input?.taskId) {
        const inferredTaskId = await resolveTaskIdForAssignFromText(user.id, text);
        if (inferredTaskId) aiRes.input.taskId = inferredTaskId;
      }
      if (!aiRes.input?.taskId) {
        return reply.send({
          success: false,
          message:
            "Kaunsi task assign karni hai? Pehle task list dikhao ya task ID do, phir bolo: \"isko test user ko assign karo\".",
        });
      }
      if (!aiRes.input?.assigneeQuery) {
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            "Whom should I assign this task to? Provide name or email. Example: test user / test@worksync.com",
            "Task किसे assign करना है? Name या email दें। उदाहरण: test user / test@worksync.com",
            "Kisko assign karna hai? Name ya email do. Example: test user / test@worksync.com"
          ),
        });
      }
    }

    if (aiRes.tool === "getTasks") {
      aiRes.input = { ...(aiRes.input || {}), ...inferListFiltersFromText(text) };
      const focus = getFocusedAssignee(user.id);
      const hasExplicitAssigned = Boolean(aiRes.input?.assignedTo);
      if (focus && !hasExplicitAssigned && isGenericListOnly(text)) {
        aiRes.input.assignedTo = focus.assigneeUserId;
      } else if (!focus || /\b(my tasks|meri tasks|mere tasks)\b/i.test(text)) {
        clearFocusedAssignee(user.id);
      }
    }

    if (aiRes.tool === "exportTasks") {
      aiRes.input = { ...(aiRes.input || {}), ...inferListFiltersFromText(text) };
      const focus = getFocusedAssignee(user.id);
      const hasExplicitAssigned = Boolean(aiRes.input?.assignedTo);
      if (focus && !hasExplicitAssigned && isGenericListOnly(text)) {
        aiRes.input.assignedTo = focus.assigneeUserId;
      } else if (!focus || /\b(my tasks|meri tasks|mere tasks)\b/i.test(text)) {
        clearFocusedAssignee(user.id);
      }
    }

    if (["cancelTask", "startTask", "verifyTask"].includes(aiRes.tool)) {
      if (!isValidObjectId(aiRes.input?.taskId)) {
        const inferred = await resolveTaskIdFromText(user.id, text, req.aiRawUserText);
        if (inferred) aiRes.input.taskId = inferred;
      }
      if (!isValidObjectId(aiRes.input?.taskId)) {
        return reply.send({
          success: false,
          message:
            "Kaunsi task pe action karna hai? Task title/due-date ke saath clear bolo ya task ID do.",
        });
      }
    }

    if (aiRes.tool === "updateTaskTitle") {
      // Hard guard: "status done/cancel/..." ko kabhi title update mat banao
      if (isStatusMutationPhrase(text)) {
        const blocked = replyIfUnsupportedChatAction(text, user.role);
        return reply.send({
          success: true,
          type: "analyst",
          message:
            blocked ||
            "Status change request detect hui hai, title update nahi. Kaunsi status action chahiye (start/cancel/submit/verify)?",
        });
      }
      const guessed = extractTitleUpdateInput(text);
      aiRes.input = { ...guessed, ...(aiRes.input || {}) };
      if (!isValidObjectId(aiRes.input?.taskId)) {
        const inferred = await resolveTaskIdFromText(user.id, text, req.aiRawUserText);
        if (inferred) aiRes.input.taskId = inferred;
      }
      if (!aiRes.input?.taskId) {
        return reply.send({
          success: false,
          message:
            "Kaunsi task ka title update karna hai? Due date/title reference ya task ID do.",
        });
      }
      if (!aiRes.input?.title) {
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            'New title is missing. Example: "update title to fix bugs".',
            'नया title missing है। उदाहरण: "title update karke fix bugs kar do".',
            "Naya title missing hai. Example: uska title update karo ki fix bugs."
          ),
        });
      }
    }

    if (aiRes.tool === "updateTaskFile") {
      if (!isValidObjectId(aiRes.input?.taskId)) {
        const inferred = await resolveTaskIdFromText(user.id, text, req.aiRawUserText);
        if (inferred) aiRes.input.taskId = inferred;
      }
      if (!aiRes.input?.taskId) {
        setDraft(user.id, { tool: "updateTaskFile", input: aiRes.input || {} });
        return reply.send({
          success: true,
          type: "clarify",
          message:
            "Kaunsi task mein file update karni hai? Due date/title ya task ID ke saath bolo, aur file attach karo.",
        });
      }
      if (!req.aiUploadFile?.buffer) {
        setDraft(user.id, { tool: "updateTaskFile", input: aiRes.input || {} });
        return reply.send({
          success: true,
          type: "clarify",
          message: l10n(
            chatLang,
            "No file is attached. Please attach a file and send again.",
            "कोई file attach नहीं है। कृपया file attach करके फिर भेजें।",
            "File attach nahi hai. Pehle file select karo, phir message bhejo."
          ),
        });
      }
    }

    if (aiRes.tool === "updateTaskDueDate") {
      if (!isValidObjectId(aiRes.input?.taskId)) {
        const inferred = await resolveTaskIdFromText(user.id, text, req.aiRawUserText);
        if (inferred) aiRes.input.taskId = inferred;
      }
      aiRes.input = await finalizeUpdateDueDateInput(text, user.id, aiRes.input);
      const inc = extractIncrementDays(text);
      if (inc && aiRes.input?.taskId) {
        aiRes.input.incrementDays = inc;
      }
      if (!aiRes.input?.taskId) {
        return reply.send({
          success: false,
          message:
            "Kaunsi task? List mein ek se zyada pending ho sakti hain — MongoDB task ID batao, ya jab sirf ek pending ho to \"30 march krdo\" / \"iski due date ...\" likho.",
        });
      }
      if (!aiRes.input?.dueDate) {
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            "Please provide the new due date, e.g. 2026-04-20 or 20/4/2026.",
            "कृपया नई due date दें, जैसे 2026-04-20 या 20/4/2026।",
            "Nayi due date likho — jaise 2026-04-20, 20/4/2026, ya 30 March 2026."
          ),
        });
      }
    }

    // 🔐 Permission check
    if (!isAllowed(user, aiRes.tool)) {
      if (aiRes.tool === "createSimpleTask") {
        return reply.send({
          success: false,
          message: l10n(
            chatLang,
            "Task creation is admin-only. Please ask an admin to assign you a task.",
            "Task बनाना admin-only action है। कृपया admin से task assign करवाएँ।",
            "Task create karna admin-only action hai. Aap admin se task assign karwa sakte ho."
          ),
        });
      }
      return reply.send({
        success: false,
        message: l10n(
          chatLang,
          `You do not have permission for "${aiRes.tool}".`,
          `आपके पास "${aiRes.tool}" की permission नहीं है।`,
          `Tumhare paas "${aiRes.tool}" ka permission nahi hai 🔒`
        ),
      });
    }

    // ⚠️ Confirmation required
    if (requiresConfirmation(aiRes.tool)) {
      let bulkMsg = `Pakka karna chahte ho? "${aiRes.tool}"${aiRes.input?.taskId ? ` (ID: ${aiRes.input.taskId})` : ""} 🤔`;
      if (aiRes.tool === "cancelPendingTasks") {
        bulkMsg =
          "Jo bhi pending tasks tumhe is system mein dikh sakti hain, sab cancel ho jayengi. Pakka?";
      } else if (aiRes.tool === "startPendingTasks") {
        bulkMsg =
          "Saari pending tasks (jo tumhe dikh sakti hain) in-progress / start ho jayengi. Pakka?";
      }
      return reply.send({
        success: true,
        confirm: true,
        tool: aiRes.tool,
        input: aiRes.input,
        message: bulkMsg,
      });
    }

    return await executeTool(aiRes.tool, aiRes.input, req, reply);

  } catch (err) {
    console.error("AI Controller Error:", err);
    return reply.send({ success: false, message: safeErrorMessage("hinglish") });
  }
};

// ─── Confirm endpoint ───
exports.confirmAction = async (req, reply) => {
  try {
    const { tool, input } = req.body;
    const user = req.user;

    if (!tool) return reply.send({ success: false, message: "Tool missing hai." });
    if (!isAllowed(user, tool)) return reply.send({ success: false, message: "Permission nahi hai 🔒" });

    return await executeTool(tool, input, req, reply);
  } catch (err) {
    console.error("Confirm Action Error:", err);
    return reply.send({ success: false, message: "Action fail ho gaya 😅" });
  }
};