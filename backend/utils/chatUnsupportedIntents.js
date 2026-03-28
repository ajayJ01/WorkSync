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

  if (/(create|add|banao|banado|bana do|bana de|banaye|bnana|bnado)/i.test(lower)) return true;

  if (/\bnew\b/.test(lower) && /(karo|krdo|kardo|kar do|kar de|karna|ban|do|lo|de|krna)/i.test(lower))
    return true;

  if (/\b(ek|one|1)\b/.test(lower) && /(task|tasks)/i.test(lower) && /(bana|banao|create|add|new)/i.test(lower))
    return true;

  return false;
}

function isSubmitTaskChatIntent(text) {
  const lower = (text || "").toLowerCase();
  if (!hasTaskWord(lower)) return false;
  return /(submit|upload|file|attachment|जमा)/i.test(lower);
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

  if (isSubmitTaskChatIntent(text)) {
    return role === "admin"
      ? "Task submit karna = My Tasks page se karo (notes / file). Chat se abhi submit support nahi hai."
      : "Task submit My Tasks se karo — chat se file upload nahi hota.";
  }

  if (isCreateTaskChatIntent(text)) {
    if (role === "admin") {
      return (
        "Naya task **chat se create nahi hota** — title, description, assignees, due date aur optional file form mein bharna padta hai. " +
        "App mein **Tasks** (All Tasks) wale flow / jahan tum normally task banate ho, wahi use karo. " +
        "Chat mein: tasks dikhao, export, start/cancel/verify, counts — ye sab chal sakta hai."
      );
    }
    return (
      "Naya task assign karna admin ka kaam hai; **chat se task create nahi hota**. " +
      "Apni list ke liye yahan likho: **tasks dikhao** — ya **My Tasks** page kholo."
    );
  }

  return null;
}

module.exports = {
  replyIfUnsupportedChatAction,
  isCreateTaskChatIntent,
  isSubmitTaskChatIntent,
};
