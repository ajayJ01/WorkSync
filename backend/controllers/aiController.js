const { runAgent } = require("../utils/aiAgent");
const { quickIntent } = require("../utils/quickIntent");
const { executeTool } = require("../utils/toolExecutor");
const { isAllowed, requiresConfirmation, isForbiddenIntent } = require("../utils/guard");
const { askAnalyst } = require("../utils/aiAnalyst");
const { replyIfUnsupportedChatAction } = require("../utils/chatUnsupportedIntents");
const { setChatTaskContext } = require("../utils/chatTaskContext");
const {
  mergeAiToolInput,
  finalizeUpdateDueDateInput,
  tryCoerceDateOnlyToDueDateUpdate,
} = require("../utils/parseDueDate");
const axios = require("axios");

// ─────────────────────────────────────────────
// Intent classify — action ya analytical?
// ─────────────────────────────────────────────
function classifyIntentHeuristic(text) {
  const lower = (text || "").toLowerCase();
  if (/\b(how many|kitne|कितने)\b/i.test(lower)) return true;
  if (/\b(overview|summary|statistics|stats|snapshot|progress)\b/i.test(lower)) return true;
  if (/\b(show|dikhao|dikha|dikha do|list|fetch|export|download|cancel|start|verify|approve|karo|kar do)\b/i.test(lower))
    return false;
  return false;
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
    /(verify|approve|pass|start|shuru|begin|chalu|export|download)/i.test(lower);

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

async function classifyIntent(text) {
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
    console.error("classifyIntent error:", err.message);
    return false; // safer — action side pe bhejo
  }
}

// ─────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────
exports.handleAI = async (req, reply) => {
  try {
    const { text, pendingTool, pendingInput, contextTaskIds } = req.body;
    const user = req.user;

    if (Array.isArray(contextTaskIds) && contextTaskIds.length) {
      setChatTaskContext(user.id, contextTaskIds);
    }

    if (!text?.trim()) {
      return reply.send({ success: false, message: "Kuch toh type karo! 😊" });
    }

    // 🚫 Hard block
    if (isForbiddenIntent(text)) {
      return reply.send({ success: false, message: "⛔ Ye action allowed nahi hai." });
    }

    // ─── PATH 1: Pending confirmation — "haan/nahi" handle karo ───
    // Frontend pending confirm bhej raha hai — seedha execute karo
    if (pendingTool) {
      if (!isAllowed(user, pendingTool)) {
        return reply.send({ success: false, message: "Permission nahi hai 🔒" });
      }
      return await executeTool(pendingTool, pendingInput || {}, req, reply);
    }

    // ─── PATH 2: Classify ───
    let isAnalytical = await classifyIntent(text);
    if (mustUseActionPath(text)) isAnalytical = false;

    if (isAnalytical) {
      const answer = await askAnalyst(text, user.role, user.id);
      return reply.send({ success: true, type: "analyst", message: answer });
    }

    // ─── PATH 3: Action → Tool ───
    let aiRes = quickIntent(text);
    let source = "quick";

    if (!aiRes) {
      aiRes = await runAgent(text);
      source = "ai";
    }

    console.log(`[AI] source=${source} tool=${aiRes?.tool} input=`, aiRes?.input);

    if (!aiRes || aiRes.tool === "unknown") {
      const coerced = await tryCoerceDateOnlyToDueDateUpdate(text, user.id);
      if (coerced) {
        aiRes = coerced;
        source = coerced.source || "coerce-date";
      }
    }

    if (!aiRes || !aiRes.tool || aiRes.tool === "unknown") {
      const blocked = replyIfUnsupportedChatAction(text, user.role);
      if (blocked) {
        return reply.send({ success: true, type: "analyst", message: blocked });
      }
      const answer = await askAnalyst(text, user.role, user.id);
      return reply.send({ success: true, type: "analyst", message: answer });
    }

    if (aiRes.tool === "createTask" || aiRes.tool === "submitTask") {
      const msg =
        replyIfUnsupportedChatAction(text, user.role) ||
        (aiRes.tool === "submitTask"
          ? "Task submit chat se nahi — My Tasks page use karo."
          : "Naya task chat se nahi — app mein task form se banao.");
      return reply.send({ success: true, type: "analyst", message: msg });
    }

    aiRes.input = mergeAiToolInput(text, user.id, aiRes.tool, aiRes.input);

    if (aiRes.tool === "updateTaskDueDate") {
      aiRes.input = await finalizeUpdateDueDateInput(text, user.id, aiRes.input);
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
          message: "Nayi due date likho — jaise 2026-04-20, 20/4/2026, ya 30 March 2026.",
        });
      }
    }

    // 🔐 Permission check
    if (!isAllowed(user, aiRes.tool)) {
      return reply.send({
        success: false,
        message: `Tumhare paas "${aiRes.tool}" ka permission nahi hai 🔒`,
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
    return reply.send({ success: false, message: "Kuch gadbad ho gayi 😅 Dobara try karo." });
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