const axios = require("axios");
const Task = require("../models/Task");
const User = require("../models/User");
const { replyIfUnsupportedChatAction } = require("./chatUnsupportedIntents");
const { setFocusedAssignee } = require("./chatEntityContext");
const { isAiUnavailable, markAiUnavailable } = require("./aiAvailability");
const { aiBusyMessage, safeErrorMessage } = require("./chatUserMessages");
const { detectChatLanguage, pickByLanguage } = require("./chatLanguage");
const { escapeRegex } = require("./regexSafe");

const chatHistories = {};

async function fetchCurrentLoggedInUser(userId) {
  const u = await User.findById(userId).select("name email role").lean();
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
  };
}

// ─────────────────────────────────────────────
// DB se actual data fetch karne wale functions
// ─────────────────────────────────────────────
async function fetchDBContext(role, userId) {
  try {
    const currentLoggedInUser = await fetchCurrentLoggedInUser(userId);
    if (!currentLoggedInUser) return null;

    if (role === "admin") {
      const [
        totalUsers, totalAdmins, totalTasks,
        pendingTasks, inProgressTasks, submittedTasks,
        verifiedTasks, cancelledTasks, rejectedTasks,
        dueTasks, recentTasks, recentUsers,
      ] = await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "admin" }),
        Task.countDocuments(),
        Task.countDocuments({ status: "pending" }),
        Task.countDocuments({ status: "in_progress" }),
        Task.countDocuments({ status: "submitted" }),
        Task.countDocuments({ status: "verified" }),
        Task.countDocuments({ status: "cancelled" }),
        Task.countDocuments({ status: "rejected" }),
        Task.countDocuments({ status: "due" }),
        Task.find().sort({ createdAt: -1 }).limit(5)
          .populate("assignedTo", "name")
          .populate("createdBy", "name")
          .lean(),
        User.find().sort({ _id: -1 }).limit(5)
          .select("name email role")
          .lean(),
      ]);

      return {
        currentLoggedInUser,
        users: { total: totalUsers, admins: totalAdmins },
        tasks: {
          total: totalTasks,
          pending: pendingTasks,
          in_progress: inProgressTasks,
          submitted: submittedTasks,
          verified: verifiedTasks,
          cancelled: cancelledTasks,
          rejected: rejectedTasks,
          due: dueTasks,
        },
        recentTasks: recentTasks.map(t => ({
          title: t.title,
          status: t.status,
          assignedTo: t.assignedTo?.map(u => u.name).join(", ") || "—",
          createdBy: t.createdBy?.name || "—",
          dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—",
        })),
        recentUsers: recentUsers.map(u => ({
          name: u.name,
          email: u.email,
          role: u.role,
        })),
      };
    } else {
      const [
        myTotal, myPending, myInProgress,
        mySubmitted, myVerified, myRejected, myTasks,
      ] = await Promise.all([
        Task.countDocuments({ assignedTo: userId }),
        Task.countDocuments({ assignedTo: userId, status: "pending" }),
        Task.countDocuments({ assignedTo: userId, status: "in_progress" }),
        Task.countDocuments({ assignedTo: userId, status: "submitted" }),
        Task.countDocuments({ assignedTo: userId, status: "verified" }),
        Task.countDocuments({ assignedTo: userId, status: "rejected" }),
        Task.find({ assignedTo: userId }).sort({ createdAt: -1 }).limit(5)
          .select("title status dueDate")
          .lean(),
      ]);

      return {
        currentLoggedInUser,
        myTasks: {
          total: myTotal,
          pending: myPending,
          in_progress: myInProgress,
          submitted: mySubmitted,
          verified: myVerified,
          rejected: myRejected,
        },
        recentTasks: myTasks.map(t => ({
          title: t.title,
          status: t.status,
          dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—",
        })),
      };
    }
  } catch (err) {
    console.error("fetchDBContext error:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// AI ko data + question deke answer generate karo
// ─────────────────────────────────────────────
async function askAnalyst(userInput, role, userId) {
  const lang = detectChatLanguage(userInput);
  if (/(kya kya|kya kar sakte|kya kr skte|what can you do|what you can do|what can u do|capabilit|help menu|commands?)/i.test(String(userInput || "").toLowerCase())) {
    return pickByLanguage(lang, {
      en:
        "I can help with WorkSync tasks: list/filter, quick create, title/due/file updates, assign, start/cancel pending, and task/user insights.",
      hi:
        "मैं WorkSync tasks में मदद कर सकता हूँ: list/filter, quick create, title/due/file update, assign, pending start/cancel, और task/user insights.",
      hinglish:
        "Main WorkSync me ye sab kar sakta hoon: tasks list/filter, quick create, title/due/file update, assign, pending start/cancel, aur task/user insights.",
    });
  }
  const unsupported = replyIfUnsupportedChatAction(userInput, role);
  if (unsupported) return unsupported;

  const lowerInput = String(userInput || "").toLowerCase();
  const asksAnyUserTaskCount =
    /(kitne|how many|count|total)/i.test(lowerInput) &&
    /(task|tasks|assigned tasks|kaam)/i.test(lowerInput) &&
    /(k\s*pass|k\s*paas|ke\s*pass|ke\s*paas|ka|ki)/i.test(lowerInput);

  // Non-admin should not get misleading "your tasks" when asking someone else's counts.
  if (role !== "admin" && asksAnyUserTaskCount) {
    const me = await fetchCurrentLoggedInUser(userId);
    const meName = String(me?.name || "").toLowerCase().trim();
    const meFirst = meName.split(/\s+/).filter(Boolean)[0] || "";
    const asksSelf =
      /\b(me|my|mera|meri|mujhe|apna|apni|khud|own)\b/i.test(lowerInput) ||
      (meName && lowerInput.includes(meName)) ||
      (meFirst && meFirst.length >= 3 && lowerInput.includes(meFirst)) ||
      (me?.email && lowerInput.includes(String(me.email).toLowerCase()));

    if (asksSelf) {
      const [total, pending, inProgress, submitted, verified, rejected, cancelled, due] =
        await Promise.all([
          Task.countDocuments({ assignedTo: userId }),
          Task.countDocuments({ assignedTo: userId, status: "pending" }),
          Task.countDocuments({ assignedTo: userId, status: "in_progress" }),
          Task.countDocuments({ assignedTo: userId, status: "submitted" }),
          Task.countDocuments({ assignedTo: userId, status: "verified" }),
          Task.countDocuments({ assignedTo: userId, status: "rejected" }),
          Task.countDocuments({ assignedTo: userId, status: "cancelled" }),
          Task.countDocuments({ assignedTo: userId, status: "due" }),
        ]);
      return (
        `Tumhare paas total ${total} assigned tasks hain ` +
        `(pending ${pending}, in progress ${inProgress}, submitted ${submitted}, ` +
        `verified ${verified}, rejected ${rejected}, cancelled ${cancelled}, due ${due}).`
      );
    }

    return pickByLanguage(lang, {
      en: 'User-wise task count is admin-only. Ask from an admin account, or for your own tasks say: "how many tasks do I have".',
      hi: 'User-wise task count admin-only है। Admin account से पूछें, या अपनी tasks के लिए बोलें: "मेरी tasks कितनी हैं".',
      hinglish:
        'Ye user-wise task count admin-only insight hai. Admin account se pucho, ya apni tasks ke liye bolo: "meri tasks kitni hain".',
    });
  }

  // Admin-specific deterministic query: "test user ke pass kitne tasks hai"
  if (role === "admin") {
    const lower = lowerInput;
    const asksUserTaskCount =
      /(kitne|how many|count|total)/i.test(lower) &&
      /(task|tasks|kaam)/i.test(lower) &&
      /(k\s*pass|k\s*paas|ke\s*pass|ke\s*paas|ka|ki)/i.test(lower);
    if (asksUserTaskCount) {
      const m =
        userInput.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i) ||
        userInput.match(/\b(.+?)\s+k\s+p(?:a|aa)ss\b/i) ||
        userInput.match(/\b(.+?)\s+ke\s+p(?:a|aa)ss\b/i) ||
        userInput.match(/\b(.+?)\s+ka\s+task/i) ||
        userInput.match(/\b(.+?)\s+ki\s+task/i);
      let q = String(m?.[1] || "").trim();
      q = q.replace(/\b(user|users|member|members)\b/gi, "").replace(/\s+/g, " ").trim();
      if (/(^|\s)(me|mera|meri|my|mujhe)($|\s)/i.test(String(userInput || ""))) {
        const me = await User.findById(userId).select("_id name email role").lean();
        if (me) q = me.email || me.name;
      }
      if (q) {
        let users = [];
        const wantsRoleUser = /\buser\b/i.test(String(userInput || ""));
        const wantsRoleAdmin = /\badmin\b/i.test(String(userInput || ""));
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
        if (users.length > 1 && (wantsRoleUser || wantsRoleAdmin)) {
          const role = wantsRoleUser ? "user" : "admin";
          const byRole = users.filter((u) => u.role === role);
          if (byRole.length === 1) users = byRole;
          else if (byRole.length > 1) users = byRole;
        }
        if (users.length === 1) {
          const u = users[0];
          setFocusedAssignee(userId, u._id, u.name);
          const [total, pending, inProgress, submitted, verified, rejected, cancelled, due] =
            await Promise.all([
              Task.countDocuments({ assignedTo: u._id }),
              Task.countDocuments({ assignedTo: u._id, status: "pending" }),
              Task.countDocuments({ assignedTo: u._id, status: "in_progress" }),
              Task.countDocuments({ assignedTo: u._id, status: "submitted" }),
              Task.countDocuments({ assignedTo: u._id, status: "verified" }),
              Task.countDocuments({ assignedTo: u._id, status: "rejected" }),
              Task.countDocuments({ assignedTo: u._id, status: "cancelled" }),
              Task.countDocuments({ assignedTo: u._id, status: "due" }),
            ]);
          return (
            `${u.name} ke paas total ${total} tasks hain ` +
            `(pending ${pending}, in progress ${inProgress}, submitted ${submitted}, ` +
            `verified ${verified}, rejected ${rejected}, cancelled ${cancelled}, due ${due}).`
          );
        }
        if (users.length > 1) {
          return `\"${q}\" se ${users.length} users mil rahe hain. Exact email do.`;
        }
        return `User "${q}" nahi mila. Exact name ya email do.`;
      }
      return "Kis user ke tasks chahiye? Example: \"test user ke paas kitne assigned tasks hain\".";
    }
  }

  const dbData = await fetchDBContext(role, userId);

  if (!dbData) {
    return "Database se data fetch nahi ho saka. Thodi der baad try karo.";
  }

  if (!process.env.GROQ_API_KEY?.trim() || isAiUnavailable()) {
    return localAnalystReply(userInput, dbData, role) || aiBusyMessage(lang);
  }

  const systemPrompt = role === "admin"
    ? `You are WorkSync AI, a smart assistant for a task management system.

!! RULE #1 — NEVER FAKE ACTIONS !!
You are an INFORMATION-ONLY assistant. You CANNOT perform any real actions on the database.
NEVER say "kar diya", "cancel ho gaya", "ho gaya", "verified", or imply you did something.

CREATE with files/assignees and SUBMIT with file: keep on app form (Tasks / My Tasks). But quick simple create (without file) can be done in chat.

For actions that WORK in chat (list tasks, counts, export, start/cancel/verify pending batch): you may briefly say user can type commands in chat for those.

NEVER invent a fake chat command like "new task create karo" for creating tasks.

!! RULE #2 — LANGUAGE !!
Detect the language of the user's latest message and reply in THAT EXACT language.
- English message → English reply ONLY
- Hindi message → Hindi reply ONLY  
- Hinglish message → Hinglish reply ONLY
- NEVER default to Hinglish or Hindi
- NEVER mix languages unless user mixes them first

You have access to LIVE database stats. Answer based ONLY on this data.
Never make up numbers.

!! RULE #3 — WHO IS CHATTING (CRITICAL) !!
The ONLY person you are talking to is in JSON key "currentLoggedInUser" (their real name, email, role from DB).
For ANY question like "mera role", "my role", "main kaun", "who am I", "meri email" — answer ONLY from currentLoggedInUser.
NEVER guess role from "recentUsers" or other users in the payload — that list is OTHER people, not the chatter.

YOUR CAPABILITIES (tell users about these if asked):
- Tasks dikhana (fetch/list)
- Quick task create (without file), self-assigned by default
- Tasks start/cancel/verify karna  
- Due date chat se: "pending ki due 1 din badhao" (jab ek hi pending ho), ya nayi date "30 March 2026" jab context clear ho — manually app ki zarurat kam hoti hai
- Tasks export karna (Excel ya PDF) — user ko type karna hoga "export tasks" ya "tasks export karo"
- Stats batana — kitne users, tasks, pending, verified etc.
- Koi bhi DB related question answer karna

NEVER tell the user to "only use the app manually" for due date if they can use the chat commands above.

If user asks to mark a STARTED / IN-PROGRESS task as completed: say clearly they must use My Tasks → Submit (not cancel/start); then admin verifies. Do NOT invent cancel/start confusion.

LIVE DATA:
${JSON.stringify(dbData, null, 2)}

Other Rules:
- Be conversational and friendly
- Use emojis naturally
- Keep answers concise
- Never say "I don't know" if data is available`

    : `You are WorkSync AI, a smart assistant for a task management system.

!! RULE #1 — NEVER FAKE ACTIONS !!
You are an INFORMATION-ONLY assistant. You CANNOT perform any real actions on the database.
NEVER say "kar diya", "cancel ho gaya", "ho gaya", "verified", or imply you did something.

CREATE with files/assignees or SUBMIT with files: app flow use karo. Quick simple create (without file) chat se ho sakta hai.

For list/export/start/cancel that work in chat, you may mention typing in chat.

!! RULE #2 — LANGUAGE !!
Detect the language of the user's latest message and reply in THAT EXACT language.
- English message → English reply ONLY
- Hindi message → Hindi reply ONLY
- Hinglish message → Hinglish reply ONLY
- NEVER default to Hinglish or Hindi
- NEVER mix languages unless user mixes them first

You can ONLY answer questions about the current user's own tasks.
Never reveal other users' data.

!! RULE #3 — WHO IS CHATTING (CRITICAL) !!
The person chatting is in "currentLoggedInUser" (name, email, role). For "mera role", "my role", "main kaun", "meri email" — use ONLY that object.

YOUR CAPABILITIES (tell users about these if asked):
- Apni tasks dikhana
- Quick task create (without file)
- Task start/cancel karna
- Due date: "pending ki due 1 din badhao" ya nayi date (jab ek hi pending ho / context clear ho)
- Tasks export karna (Excel ya PDF) — type karo "export tasks" ya "tasks export karo"
- Apni task stats batana — kitne pending, verified etc.

Do not insist on manual app-only steps for due date when chat commands can work.

USER'S LIVE DATA:
${JSON.stringify(dbData, null, 2)}

Other Rules:
- Be conversational and friendly
- Use emojis naturally
- Only answer about user's own tasks
- If asked about other users/system data, politely decline
- Never say you CAN'T export — instead guide them to type: export tasks or tasks export karo`;

  // ── Chat history maintain karo ──
  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
  }

  chatHistories[userId].push({ role: "user", content: userInput });

  // Last 20 messages hi rakho
  if (chatHistories[userId].length > 20) {
    chatHistories[userId] = chatHistories[userId].slice(-20);
  }

  console.log(`[HISTORY] userId=${userId} messages=${chatHistories[userId].length}`);
  console.log("[HISTORY] full:", JSON.stringify(chatHistories[userId], null, 2));

  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistories[userId], // puri history bhejo
        ],
        temperature: 0.35,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const answer = res.data.choices[0]?.message?.content?.trim()
      || "Kuch hua, dobara try karo 😅";

    // AI ka jawab bhi history mein save karo
    chatHistories[userId].push({ role: "assistant", content: answer });

    return answer;
  } catch (err) {
    if (err?.response?.status === 429) {
      markAiUnavailable(120 * 1000);
      return localAnalystReply(userInput, dbData, role) || aiBusyMessage(lang);
    }
    console.error("askAnalyst error:", err.message);
    return safeErrorMessage(lang);
  }
}

// ─────────────────────────────────────────────
// Logout pe history clear karo
// ─────────────────────────────────────────────
function clearChatHistory(userId) {
  delete chatHistories[userId];
}

function localAnalystReply(userInput, dbData, role) {
  const lower = (userInput || "").toLowerCase();
  const me = dbData.currentLoggedInUser;

  if (
    me &&
    /(mera|meri|my|apna|apni|main)\s+(role|email|naam|name|account)|\bwho am i\b|main kaun|mera role|my role|i am who|which role/i.test(
      lower
    )
  ) {
    return `Tum ${me.name} ho — email ${me.email}, role "${me.role}".`;
  }

  if (role === "admin") {
    const { users, tasks } = dbData;
    if (
      /(user|users|member|admin|लोग|यूजर)/i.test(lower) &&
      /(kitne|how many|count|total|कितने)/i.test(lower)
    ) {
      return `Abhi ${users.total} normal users aur ${users.admins} admin(s) hain.`;
    }
    if (/(task|tasks|काम)/i.test(lower) && /(kitne|how many|count|total|कितने|pending|verify|status)/i.test(lower)) {
      return (
        `Task counts: total ${tasks.total}, pending ${tasks.pending}, in progress ${tasks.in_progress}, ` +
        `submitted ${tasks.submitted}, verified ${tasks.verified}, cancelled ${tasks.cancelled}, ` +
        `rejected ${tasks.rejected}, due ${tasks.due}.`
      );
    }
    if (/(overview|summary|aaj|dashboard|snapshot)/i.test(lower)) {
      return (
        `Overview: ${users.total} users, ${tasks.total} tasks ` +
        `(${tasks.pending} pending, ${tasks.submitted} submitted). ` +
        `Full list ke liye chat mein likho: "tasks dikhao".`
      );
    }
    return (
      `Main WorkSync assistant hoon. Tasks/Users related query poochho — jaise ` +
      `"tasks dikhao", "pending tasks kitne", "test user ke tasks".`
    );
  }

  const m = dbData.myTasks;
  if (/(kitne|how many|count|total|कितने|pending|status)/i.test(lower)) {
    return (
      `Teri tasks: total ${m.total} — pending ${m.pending}, in progress ${m.in_progress}, ` +
      `submitted ${m.submitted}, verified ${m.verified}, rejected ${m.rejected}.`
    );
  }
  return (
    `Main WorkSync tasks assistant hoon. Tum tasks related command do — ` +
    `"meri tasks dikhao", "pending tasks", "due tasks", ya "task create karo".`
  );
}

module.exports = { askAnalyst, clearChatHistory, localAnalystReply };