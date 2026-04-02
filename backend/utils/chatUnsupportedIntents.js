/**
 * Ye actions chat flow mein implement nahi hain (multipart / form).
 * Inhe yahan pakad ke STATIC jawab do — warna analyst LLM galat "type karo X" salah deta hai.
 */

function hasTaskWord(text) {
  return /(task|tasks|kaam|assignment)/i.test(text || "");
}

/** "new task" + imperative, ya create/add/banao … */
function isCreateTaskChatIntent(text) {
  const lower = (text || "").toLowerCase();
  if (!hasTaskWord(lower)) return false;

  if (/\b(create|add|banao|banado|bana do|bana de|banaye|bnana|bnado)\b/i.test(lower)) return true;

  if (/\bnew\b/.test(lower) && /(karo|krdo|kardo|kar do|kar de|karna|ban|do|lo|de|krna)/i.test(lower))
    return true;

  if (/\b(ek|one|1)\b/.test(lower) && /\b(task|tasks)\b/i.test(lower) && /\b(bana|banao|create|add|new)\b/i.test(lower))
    return true;

  return false;
}

function isSubmitTaskChatIntent(text) {
  const lower = (text || "").toLowerCase();
  if (!hasTaskWord(lower)) return false;
  // "create task ... attached file" ko submit intent mat samjho
  const createLike = /\b(create|add|new task|naya task|banao|banado|bana do|ek task)\b/i.test(lower);
  if (createLike) return false;

  // Submit intent tabhi jab submit/update/upload verb ho + file cue ho
  const submitVerb = /(submit|जमा|update file|replace file|upload|re-upload|resubmit)/i.test(lower);
  const fileCue = /(file|attachment|attach|document|pdf|image|screenshot)/i.test(lower);
  return submitVerb && fileCue;
}

/** "pending complete" — app mein = start + baad mein submit (verify admin) */
function isMarkCompletePendingIntent(text) {
  const lower = (text || "").toLowerCase();
  if (!hasTaskWord(lower)) return false;
  if (!/(pending|pend)/i.test(lower)) return false;
  return /(complete|completed|done|finish|mark|पूर्ण|खत्म|pura|poora)/i.test(lower);
}

/** Started / in-progress ko "complete" — actually Submit (+ admin verify) */
function isCompleteStartedOrInProgressIntent(text) {
  const lower = (text || "").toLowerCase();
  if (!hasTaskWord(lower)) return false;
  const wantsDone =
    /(complete|completed|done|finish|mark|पूर्ण|खत्म|pura|poora|band karo|close)/i.test(lower);
  const wasStarted =
    /(started|start ho|already start|in progress|in_progress|progress|chalu|chaloo|shuru|running|begin)/i.test(
      lower
    );
  return wantsDone && wasStarted;
}

/** Generic "task status done/complete" catch-all */
function isGenericMarkDoneIntent(text) {
  const lower = (text || "").toLowerCase();
  if (!hasTaskWord(lower)) return false;
  const wantsDone =
    /(complete|completed|done|finish|mark|status\s+done|status\s+complete|band karo|close)/i.test(lower);
  if (!wantsDone) return false;
  return /(status|task|uska|isko|jiska|jiski)/i.test(lower);
}

function replyIfUnsupportedChatAction(text, role) {
  if (isCompleteStartedOrInProgressIntent(text)) {
    return (
      "Start / in-progress task yahan se \"complete\" mark nahi hota. " +
      "My Tasks → task kholo → Submit (notes ya file). " +
      "Phir status Submitted; admin verify karega to Verified."
    );
  }

  if (isMarkCompletePendingIntent(text)) {
    return (
      "Pending task ko complete banana do-step hai: (1) Pehle task start karo — chat mein likho " +
      "\"pending tasks start karo\" (confirm) ya My Tasks se Start. " +
      "(2) Kaam khatm hone ke baad My Tasks se Submit karo (notes/file). " +
      "Admin verify karega; seedha \"complete\" chat se mark nahi hota."
    );
  }

  if (isGenericMarkDoneIntent(text)) {
    return (
      "Task ko direct \"done/complete\" chat se mark nahi hota. " +
      "Flow: Start task -> My Tasks se Submit (notes/file) -> Admin verify karega to Verified."
    );
  }

  if (isSubmitTaskChatIntent(text)) {
    return role === "admin"
      ? "Task submit karna = My Tasks page se karo (notes / file). Chat se abhi submit support nahi hai."
      : "Task submit My Tasks se karo — chat se file upload nahi hota.";
  }

  if (isCreateTaskChatIntent(text)) {
    return role === "admin"
      ? "Quick task chat se ban sakta hai. Example: \"kal report bhejni hai task banao\"."
      : "Task create karna admin-only hai. Aap admin se task assign karwa sakte ho.";
  }

  return null;
}

module.exports = {
  replyIfUnsupportedChatAction,
  isCreateTaskChatIntent,
  isSubmitTaskChatIntent,
};
