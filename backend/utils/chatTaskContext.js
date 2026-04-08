/** In-memory: last task IDs shown in chat (frontend bhejta hai) — "iski due date" resolve karne ke liye */
const TTL_MS = 45 * 60 * 1000;
const store = new Map();
/** Last task user created/updated via chat — follow-up "edit title/due" ke liye */
const lastTouchedStore = new Map();

function key(userId) {
  return String(userId);
}

function prune(userId) {
  const e = store.get(key(userId));
  if (!e) return;
  if (Date.now() - e.at > TTL_MS) store.delete(key(userId));
}

function pruneLastTouched(userId) {
  const k = key(userId);
  const row = lastTouchedStore.get(k);
  if (!row) return;
  if (Date.now() - row.at > TTL_MS) lastTouchedStore.delete(k);
}

exports.setChatTaskContext = (userId, taskIds) => {
  const ids = [...new Set((taskIds || []).map(String).filter(Boolean))].slice(0, 30);
  if (!ids.length) return;
  store.set(key(userId), { ids, at: Date.now() });
};

/** Naya task list-context ke सबसे ऊपर — "this/iski" + single id */
exports.prependChatTaskContext = (userId, taskId) => {
  const id = String(taskId || "").trim();
  if (!/^[a-f\d]{24}$/i.test(id)) return;
  prune(userId);
  const k = key(userId);
  const row = store.get(k);
  const prev = row?.ids?.length ? [...row.ids] : [];
  const merged = [id, ...prev.filter((x) => x !== id)].slice(0, 30);
  store.set(k, { ids: merged, at: Date.now() });
};

exports.peekChatTaskContext = (userId) => {
  prune(userId);
  const e = store.get(key(userId));
  return e?.ids?.length ? [...e.ids] : [];
};

const LISTED_TASK_DEMO_RE =
  /\b(is|iski|iske|iska|is\s*ko|us\s*ko|usi|uska|uski|uske|ye|yeh|yehi|yahi|yhi|wo|woh|vah|voh|wahi|wohi|whi|us|un|unhe|unhein|unko|inhe|inhein|inho|inse|unse|this|that|same)\b/i;

const LISTED_TASK_PHRASE_RE =
  /\b(abhi\s+wala|abhi\s+wali|abhi\s+jo|jo\s+abhi|last\s+wala|last\s+wali|latest\s+wala|pehla|pahla|pahela|dusra|doosra|teesra|neeche\s+wala|niche\s+wala|upar\s+wala|naya\s+wala|naya\s+wali)\b/i;

exports.refersToListedTask = (text) => {
  const s = String(text || "");
  return LISTED_TASK_DEMO_RE.test(s) || LISTED_TASK_PHRASE_RE.test(s.toLowerCase());
};

/**
 * Seedha follow-up: title/due/description/file change — last chat action wali task.
 * Hindi / Hinglish / English imperatives + common typos.
 */
exports.refersToImplicitFollowupEdit = (text, rawText = null) => {
  const lower = String(text || rawText || "").toLowerCase().trim();
  if (lower.length > 220) return false;

  const editCue =
    /\b(update|change|edit|set|modify|rename|extend|adjust|fix|correct|reschedule|postpone|prepone|shift|move|replace|swap)\b/i.test(
      lower
    ) ||
    /\b(badal|badlo|bdal|bdalo|bdl|badalna|badlena|theek|thik|sahi|sahee)\b/i.test(lower) ||
    /\b(badal\s*(do|de|na|dena|dijiye|dijie)|badlo|kr\s*do|kar\s*do|kardo|krdo|kar\s*de|karwa|lagao|lgao|lgado|rakho|rakhna|krna|karna|karni|chahiye|kr\s*dijiye|likh\s*do|likhdo)\b/i.test(
      lower
    ) ||
    /\b(make\s+it|turn\s+it|keep\s+it|switch\s+it)\b/i.test(lower);

  const fieldCue =
    /\b(title|name|nam|naam|heading|shirshak|sheershak|due|deadline|last\s*date|do\s*date|tarikh|tareek|tareekh|tarik|date|time|samay|samay\s*samapti|extension)\b/i.test(
      lower
    ) ||
    /\b(description|discription|desc|details|detail|vivran|notes?|remark|remarks|comment|comments|about|baare|bare\s*me|matter)\b/i.test(
      lower
    ) ||
    /\b(file|attachment|attach|document|doc|pdf|photo|image|screenshot|upload|chipka|laga|lagana)\b/i.test(
      lower
    );

  const hiScript = /[\u0900-\u097F]{2,}/.test(lower);
  const hiEdit = /(बदल|अपडेट|रखो|करो|दो|दें|कीजिए|लिखो|लगाओ|बढ़ा|आगे|सेट)/.test(lower);
  const hiField = /(शीर्षक|नाम|डेडलाइन|ड्यू|तारीख|दिनांक|विवरण|वर्णन|फाइल|अटैचमेंट)/.test(
    lower
  );
  const okRoman = editCue && fieldCue;
  const okDevanagari = hiScript && hiEdit && hiField;
  if (!okRoman && !okDevanagari) return false;

  const hasBroadScope =
    /\b(all|every|each|bulk|saare|saari|sab|sabhi|pure|poori|pura|har\s+ek|har\s+tasks?|inko|inho|ye\s+sab|in\s+sab)\s+tasks?\b/i.test(
      lower
    ) ||
    /\b(all|every)\s+tasks?\b/i.test(lower) ||
    /(सभी|हर\s+एक|पूरे\s+टास्क|सारे\s+टास्क)/.test(lower);

  if (hasBroadScope) return false;

  const namesOtherTask =
    /\bjis(?:ki|ka|ke|ko)\s+(?:due|title|naam|nam|task)\b/i.test(lower) ||
    /\bjin(?:ki|ka|ke)\s+tasks?\b/i.test(lower) ||
    /\b(task|tasks)\s+(named|called)\b/i.test(lower) ||
    /\b(jiski|jiska|jiske)\s+(due|title)\b/i.test(lower) ||
    /जिसकी|जिसका|जिनकी/.test(lower);

  if (namesOtherTask) return false;
  return true;
};

exports.setLastTouchedTaskId = (userId, taskId) => {
  const id = String(taskId || "").trim();
  if (!/^[a-f\d]{24}$/i.test(id)) return;
  lastTouchedStore.set(key(userId), { id, at: Date.now() });
};

exports.peekLastTouchedTaskId = (userId) => {
  pruneLastTouched(userId);
  return lastTouchedStore.get(key(userId))?.id || null;
};

/** Logout / session reset */
exports.clearChatTaskMemory = (userId) => {
  const k = key(userId);
  store.delete(k);
  lastTouchedStore.delete(k);
};
