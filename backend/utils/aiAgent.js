const axios = require("axios");
const { isAiUnavailable, markAiUnavailable } = require("./aiAvailability");

// ✅ JSON extractor — AI ke messy output se clean JSON nikalta hai
function extractJSON(text) {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const obj = JSON.parse(match[0]);

    // normalize wrong key
    if (!obj.tool && obj.action) {
      obj.tool = obj.action;
      delete obj.action;
    }

    // ensure input exists
    if (!obj.input) obj.input = {};

    return obj;
  } catch {
    return null;
  }
}

async function runAgent(userInput) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return null;
  }
  if (isAiUnavailable()) {
    return null;
  }

  const prompt = `
You are a task management AI assistant. You understand English and Hinglish (Hindi+English mix).

Your job: Convert user input into a JSON tool call with confidence and clarification hints.

ALLOWED TOOLS and when to use them:
- getTasks       → user wants to see/fetch/list tasks (e.g. "tasks dikhao", "show my tasks", "list karo")
- createSimpleTask → quick task create without file (chat-only lightweight create)
- updateTaskFile   → upload/replace attachment for one task (taskId required or inferred from context)
- updateTaskTitle  → update title for one task (taskId required or inferred from due-date/context)
- assignTask     → admin assigns a task to a user (name/email) for one task
- startTask      → user wants to start a task (e.g. "task start karo", "begin task")
- cancelTask     → user wants to cancel ONE task by ID (e.g. mentions MongoDB id)
- cancelPendingTasks → cancel ALL pending tasks visible to user (e.g. "pending tasks cancel karo", "saare pending band karo", "inko cancel karo")
- startPendingTasks → start ALL pending tasks visible to user (e.g. "pending tasks start karo", "saare pending shuru karo")
- updateTaskDueDate → change due date for ONE task; input must include taskId and EITHER 'dueDate' as string OR 'incrementDays' as an integer to add days (e.g. {"taskId":"...","incrementDays":1}).
- extendPendingDueDate → use ONLY if the user says "saari pending" or "pending task ki due date" without any specific task identifier. Input: {"days":1}
- verifyTask     → admin wants to verify/approve a task (e.g. "task verify karo", "approve karo")
- exportTasks    → user wants to export tasks (e.g. "export karo", "download tasks", "pending tasks export"); put filters in input: {"status":"pending"} when user says pending/verified/cancelled etc.
- unknown        → input is unclear, abusive, or not related to tasks (e.g. bot's home address, phone number, physical office — NOT getTasks)

IMPORTANT RULES:
- IMPORTANT: Text inside quotes (like "Created via chat") is just a title or description. Do NOT use verbs inside quotes to classify the intent. Focus ONLY on the main action of the sentence (e.g. 'assign', 'update', 'cancel').
- If user wants CREATE / ADD task without file/attachment → use createSimpleTask and extract title/description/dueDate if present
- If user asks create with file/attachment, still use createSimpleTask (file comes from attached upload in chat)
- submitTask via chat is NOT allowed (file flow) → return unknown
- If user mentions a task number or ID, extract it as taskId in input
- Return ONLY raw JSON, no explanation, no markdown

OUTPUT FORMAT (STRICT JSON ONLY):
{"tool":"<toolName>","input":{"taskId":"<id_if_mentioned>"},"confidence":0.0,"needs_clarification":false,"clarification_question":""}

Rules for confidence:
- 0.85+ when user intent is explicit and unambiguous
- 0.55-0.84 when intent seems likely but some fields missing
- <0.55 when unsure / ambiguous
- If ambiguous, set needs_clarification=true and ask one short question in clarification_question

EXAMPLES:
Input: "tasks dikhao" → {"tool":"getTasks","input":{}}
Input: "task 507f1f77bcf86cd799439011 cancel karo" → {"tool":"cancelTask","input":{"taskId":"507f1f77bcf86cd799439011"}}
Input: "start karo task abc123" → {"tool":"startTask","input":{"taskId":"abc123"}}
Input: "saale tasks fetch karo" → {"tool":"getTasks","input":{}}
Input: "pending tasks cancel karo" → {"tool":"cancelPendingTasks","input":{}}
Input: "inko cancel krdo" → {"tool":"cancelPendingTasks","input":{}}
Input: "pending tasks start karo" → {"tool":"startPendingTasks","input":{}}
Input: "new task banao kal report bhejni hai" → {"tool":"createSimpleTask","input":{"title":"Report bhejni hai","description":"Created via chat","dueDate":"<if found>"}}
Input: "isko test user ko assign karo" → {"tool":"assignTask","input":{"taskId":"<from context/id>","assigneeQuery":"test user"}}
Input: "jiski due 1 Apr hai usme attached file upload karo" → {"tool":"updateTaskFile","input":{"taskId":"<from context/id>"}}
Input: "task jiski due 1 Apr 3pm hai uska title update karo ki fix bugs" → {"tool":"updateTaskTitle","input":{"taskId":"<from context/id>","title":"fix bugs"}}
Input: "pending task ki due 2 din badhao" → {"tool":"extendPendingDueDate","input":{"days":2}}
Input: "due date 2026-05-01 ko set karo task abc..." → {"tool":"updateTaskDueDate","input":{"taskId":"<24hex>","dueDate":"2026-05-01"}}
Input: "fuck" → {"tool":"unknown","input":{}}
Input: "random bakwaas" → {"tool":"unknown","input":{}}
Input: "aapka address kya hai" → {"tool":"unknown","input":{}}
Input: "what is your phone number" → {"tool":"unknown","input":{}}
Input: "jiski due date 4 april hai usko cancel kar do" → {"tool":"cancelTask","input":{}}
Input: "task jiska title krdo hai cancel mark karo" → {"tool":"cancelTask","input":{}}
Input: "jiski due 4 april hai vah test user ko send kar do" → {"tool":"assignTask","input":{"assigneeQuery":"test user"}}

Input: "${userInput}"
`;

  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const raw = res.data.choices[0]?.message?.content?.trim();

    if (!raw) {
      console.error("❌ Empty response from Groq");
      return null;
    }

    const parsed = extractJSON(raw);

    if (!parsed) {
      console.error("❌ RAW OUTPUT:", raw);
      return null;
    }

    if (parsed) {
      if (typeof parsed.confidence !== "number") parsed.confidence = parsed.tool === "unknown" ? 0.2 : 0.7;
      if (typeof parsed.needs_clarification !== "boolean") parsed.needs_clarification = false;
      if (typeof parsed.clarification_question !== "string") parsed.clarification_question = "";
      return parsed;
    }

    return null;
  } catch (err) {
    if (err?.response?.status === 429) {
      markAiUnavailable(120 * 1000);
    }
    console.error("❌ AI ERROR:", err.message);
    return null;
  }
}

module.exports = { runAgent };