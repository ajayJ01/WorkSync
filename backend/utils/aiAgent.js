const axios = require("axios");

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

  const prompt = `
You are a task management AI assistant. You understand English and Hinglish (Hindi+English mix).

Your job: Convert user input into a JSON tool call.

ALLOWED TOOLS and when to use them:
- getTasks       → user wants to see/fetch/list tasks (e.g. "tasks dikhao", "show my tasks", "list karo")
- startTask      → user wants to start a task (e.g. "task start karo", "begin task")
- cancelTask     → user wants to cancel ONE task by ID (e.g. mentions MongoDB id)
- cancelPendingTasks → cancel ALL pending tasks visible to user (e.g. "pending tasks cancel karo", "saare pending band karo", "inko cancel karo")
- startPendingTasks → start ALL pending tasks visible to user (e.g. "pending tasks start karo", "saare pending shuru karo")
- updateTaskDueDate → change due date for ONE task; input must include taskId and dueDate as ISO string YYYY-MM-DD or parseable date
- extendPendingDueDate → add N days to due date when exactly ONE pending task exists for user; input: {"days":1}
- verifyTask     → admin wants to verify/approve a task (e.g. "task verify karo", "approve karo")
- exportTasks    → user wants to export tasks (e.g. "export karo", "download tasks")
- unknown        → input is unclear, abusive, or not related to tasks

IMPORTANT RULES:
- If user wants to CREATE / ADD a new task or SUBMIT a task → return {"tool":"unknown","input":{}} (never return createTask or submitTask as tool names)
- If user mentions a task number or ID, extract it as taskId in input
- If input is unclear or abusive → always return unknown tool
- Return ONLY raw JSON, no explanation, no markdown

OUTPUT FORMAT:
{"tool":"<toolName>","input":{"taskId":"<id_if_mentioned>"}}

If no taskId mentioned:
{"tool":"<toolName>","input":{}}

EXAMPLES:
Input: "tasks dikhao" → {"tool":"getTasks","input":{}}
Input: "task 507f1f77bcf86cd799439011 cancel karo" → {"tool":"cancelTask","input":{"taskId":"507f1f77bcf86cd799439011"}}
Input: "start karo task abc123" → {"tool":"startTask","input":{"taskId":"abc123"}}
Input: "saale tasks fetch karo" → {"tool":"getTasks","input":{}}
Input: "pending tasks cancel karo" → {"tool":"cancelPendingTasks","input":{}}
Input: "inko cancel krdo" → {"tool":"cancelPendingTasks","input":{}}
Input: "pending tasks start karo" → {"tool":"startPendingTasks","input":{}}
Input: "pending task ki due 2 din badhao" → {"tool":"extendPendingDueDate","input":{"days":2}}
Input: "due date 2026-05-01 ko set karo task abc..." → {"tool":"updateTaskDueDate","input":{"taskId":"<24hex>","dueDate":"2026-05-01"}}
Input: "fuck" → {"tool":"unknown","input":{}}
Input: "random bakwaas" → {"tool":"unknown","input":{}}

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

    return parsed;
  } catch (err) {
    console.error("❌ AI ERROR:", err.message);
    return null;
  }
}

module.exports = { runAgent };