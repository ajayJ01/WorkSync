/**
 * 🧠 Smart Intent Classification System
 * Production-ready, cost-optimized, self-learning
 */

const axios = require("axios");
const { isAiUnavailable, markAiUnavailable } = require("./aiAvailability");

// 🎯 Intent Categories
const INTENT_CATEGORIES = {
  ACTION: "action",
  ANALYTICAL: "analytical",
  CLARIFICATION: "clarification",
  SMALL_TALK: "small_talk"
};

// 📊 Pattern Cache for Learning
const patternCache = new Map();
const intentHistory = new Map(); // User-specific learning
const CONFIDENCE_THRESHOLDS = {
  PATTERN: 0.9,
  NLP: 0.8,
  LLM: 0.7
};

// 🎯 Quick Pattern Matching (Layer 1 - Fast, No Cost)
function quickPatternMatch(text) {
  const lower = (text || "").toLowerCase().trim();
  
  // High-confidence patterns
  const patterns = {
    // Task identification with quotes - HIGHEST PRIORITY
    taskInQuotes: {
      regex: /(?:task|jiska|jiske|jo|uski|usme|isme)\s+["']([^"']+)["']\s+(?:hai|ko|me|pe)/i,
      intent: INTENT_CATEGORIES.ACTION,
      confidence: 0.95,
      extractTitle: true
    },
    
    // Task identification with "title" - HIGH PRIORITY
    taskWithTitle: {
      regex: /(?:task\s+)?(?:jiska|jiske|jo|uski)\s+title\s+["']?([^"']+)["']?\s+(?:hai|ko|me|pe)/i,
      intent: INTENT_CATEGORIES.ACTION,
      confidence: 0.95,
      extractTitle: true
    },
    
    // Task identification without quotes - MEDIUM PRIORITY
    taskWithoutQuotes: {
      regex: /(?:task|jiska|jiske|jo|uski)\s+(?:title\s+)?([^"'\s]+(?:\s+(?:hai|ko|me|pe))?)/i,
      intent: INTENT_CATEGORIES.ACTION,
      confidence: 0.9,
      extractTitle: true
    },
    
    // Confirmation patterns
    confirm: {
      regex: /^(haan?|haa|ha|yes|y|pakka|theek hai|ok|okay|bilkul|confirm|karo|kar do)$/i,
      intent: INTENT_CATEGORIES.ACTION,
      confidence: 0.95
    },
    
    // Negative patterns
    cancel: {
      regex: /^(nahi|nah|no|n|mat karo|band karo|cancel|rehne do|chodo)$/i,
      intent: INTENT_CATEGORIES.ACTION,
      confidence: 0.95
    },
    
    // Action commands - LOWER PRIORITY
    actionCommands: {
      regex: /\b(karo|krdo|kardo|kar do|kar de|dikhao|dikha|dikha do|show|list|fetch|cancel|start|verify|create|add|banao|export|download|assign|reassign|update|attach|file|upload)\b/i,
      intent: INTENT_CATEGORIES.ACTION,
      confidence: 0.8
    },
    
    // Question patterns
    questions: {
      regex: /\b(kitne|how many|count|total|kya|what|why|when|where|which)\b/i,
      intent: INTENT_CATEGORIES.ANALYTICAL,
      confidence: 0.8
    },
    
    // Small talk
    smallTalk: {
      regex: /^(hi|hii|hello|hey|heyy|hlo|hola|namaste|ram ram)\b/i,
      intent: INTENT_CATEGORIES.SMALL_TALK,
      confidence: 0.9
    }
  };
  
  for (const [patternName, pattern] of Object.entries(patterns)) {
    const match = pattern.regex.exec(lower);
    if (match) {
      let taskTitle = null;
      if (pattern.extractTitle && match[1]) {
        taskTitle = match[1].trim();
      }
      
      learnPattern(lower, pattern.intent);
      
      return {
        intent: pattern.intent,
        confidence: pattern.confidence,
        source: "pattern",
        pattern: patternName,
        taskTitle,
        matchedText: match[0]
      };
    }
  }
  
  return { confidence: 0, source: "pattern" };
}

// 🤖 LLM Classification (Layer 3 - Accurate, Cost)
async function llmClassify(text, context = {}) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return { confidence: 0, source: "llm" };
  }
  
  try {
    const systemPrompt = buildSmartPrompt(context);

    // Use axios (already imported) to avoid fetch option-shape/syntax issues
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        max_tokens: 50,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const result = res.data?.choices?.[0]?.message?.content?.trim();
    const parsed = parseLLMResponse(result);
    
    console.log(`[LLM-INTENT] "${text}" → ${parsed.intent} (${parsed.confidence})`);
    
    return {
      ...parsed,
      source: "llm"
    };
    
  } catch (error) {
    if (error?.response?.status === 429) {
      markAiUnavailable(120 * 1000);
    }
    console.error("LLM classification failed:", error.message);
    return { confidence: 0, source: "llm" };
  }
}

// 📝 Smart Prompt Builder
function buildSmartPrompt(context) {
  const { userHistory, recentTasks, userRole, lastAction, lastTaskId } = context;
  
  return `You are an advanced intent classifier for WorkSync task management. 

CONTEXT:
- User Role: ${userRole || "unknown"}
- Recent Actions: ${userHistory?.lastActions?.slice(-5).join(", ") || "none"}
- Last Action: ${lastAction || "none"}
- Last Task ID: ${lastTaskId || "none"}
- Active Tasks: ${recentTasks?.length || 0}

CLASSIFY into ONE of these intents:
1. "action" - User wants to DO/EXECUTE something
2. "analytical" - User wants to KNOW/SEE information only  
3. "clarification" - User needs more info/unclear request
4. "small_talk" - Greeting/conversation

RESPONSE FORMAT (JSON):
{
  "intent": "action|analytical|clarification|small_talk",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "taskId": "task_id_if_referenced"
}

CRITICAL CONTEXT RULES:
- If user says "isko", "usko", "is task", "jo abhi start kiya" → REFERENCE to last task
- If user says "me", "meri", "mere" → REFERENCE to user's own tasks
- If user says "complete mark krdo", "verify karo", "submit karo" → ACTION on referenced task
- If user says "start krdo", "assign karo" → ACTION on referenced task
- Context persistence: Remember last mentioned task ID across conversation

EXAMPLES:
- "isko complete mark krdo" → {"intent": "action", "taskId": "last_task_id"}
- "jo abhi start kiya usko complete karo" → {"intent": "action", "taskId": "last_task_id"}
- "mere pending tasks start karo" → {"intent": "action", "scope": "user_pending"}

RULES:
- "haan", "yes", "confirm", "pakka", "theek hai" → action (0.95+ confidence)
- "cancel X", "start X", "verify X" → action (0.95+ confidence)
- "how many", "kitne", "count" → analytical (0.95+ confidence)
- "show X", "list X", "dikhao X" → action (0.90+ confidence)
- Context matters: recent task actions bias toward action
- Be confident (0.7+) when clear, lower (0.5-0.7) when ambiguous`;
}

// 🔍 LLM Response Parser
function parseLLMResponse(response) {
  try {
    const parsed = JSON.parse(response);
    return {
      intent: parsed.intent || INTENT_CATEGORIES.ACTION,
      confidence: parseFloat(parsed.confidence) || 0.5,
      reasoning: parsed.reasoning || ""
    };
  } catch {
    // Fallback parsing
    const intent = response.toLowerCase().includes("action") ? INTENT_CATEGORIES.ACTION : INTENT_CATEGORIES.ANALYTICAL;
    return {
      intent,
      confidence: 0.6,
      reasoning: "fallback parsing"
    };
  }
}

// 🎓 Pattern Learning System
function learnPattern(text, intent) {
  const pattern = extractKeyPattern(text);
  if (!pattern) return;
  
  const existing = patternCache.get(pattern) || { intent, count: 0, confidence: 0 };
  existing.count += 1;
  existing.confidence = Math.min(0.95, existing.confidence + 0.05);
  existing.lastSeen = Date.now();
  
  patternCache.set(pattern, existing);
  
  // Cleanup old patterns (keep last 1000)
  if (patternCache.size > 1000) {
    const sorted = Array.from(patternCache.entries())
      .sort((a, b) => b[1].lastSeen - a[1].lastSeen);
    patternCache.clear();
    sorted.slice(0, 1000).forEach(([k, v]) => patternCache.set(k, v));
  }
}

// 🔑 Key Pattern Extraction
function extractKeyPattern(text) {
  // Extract meaningful pattern for learning
  const cleaned = text
    .toLowerCase()
    .replace(/\b\d+\b/g, "NUM") // Replace numbers
    .replace(/\b[a-f\d]{24}\b/g, "ID") // Replace ObjectIDs
    .replace(/\b[\w._%+-]+@[\w.-]+\.[a-z]{2,}\b/g, "EMAIL") // Replace emails
    .trim();
  
  // Keep only important words
  const words = cleaned.split(/\s+/).filter(word => 
    word.length > 2 && 
    !["the", "and", "for", "with", "that", "this", "from", "have"].includes(word)
  );
  
  return words.slice(0, 5).join(" "); // First 5 meaningful words
}

// 🧠 Local NLP Classification (Layer 2 - Medium, No Cost)
// Note: This exists because `classifyWithContext()` calls it.
async function localNLPClassify(text) {
  try {
    const lower = (text || "").toLowerCase();

    if (/\b(how many|kitne|count|total)\b/.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.ANALYTICAL,
        confidence: 0.75,
        source: "nlp",
        details: { method: "keyword_match" },
      };
    }

    if (/\b(show|dikhao|list|fetch|cancel|start|verify|create|export|assign|banao|karo|kar do)\b/.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.ACTION,
        confidence: 0.75,
        source: "nlp",
        details: { method: "keyword_match" },
      };
    }

    return { confidence: 0, source: "nlp" };
  } catch (error) {
    console.warn("Local NLP failed:", error.message);
    return { confidence: 0, source: "nlp" };
  }
}

// 🎯 Context-Aware Classification
async function classifyWithContext(text, userId, context = {}) {
  // Get user's learning history
  const userPatterns = intentHistory.get(userId) || {};
  const taskContext = getLastTaskContext(userId);
  
  // Enhanced context with task tracking
  const enhancedContext = {
    ...context,
    lastAction: taskContext.lastAction,
    lastTaskId: taskContext.lastTaskId,
    recentActions: taskContext.recentActions,
    userHistory: userPatterns
  };
  
  // Layer 1: Quick patterns
  const patternResult = quickPatternMatch(text);
  if (patternResult.confidence >= CONFIDENCE_THRESHOLDS.PATTERN) {
    updateUserHistory(userId, text, patternResult.intent);
    return patternResult;
  }
  
  // Layer 2: Local NLP
  const nlpResult = await localNLPClassify(text);
  if (nlpResult.confidence >= CONFIDENCE_THRESHOLDS.NLP) {
    updateUserHistory(userId, text, nlpResult.intent);
    return nlpResult;
  }
  
  // Layer 3: LLM (with enhanced context)
  const llmResult = await llmClassify(text, enhancedContext);
  if (llmResult.confidence >= CONFIDENCE_THRESHOLDS.LLM) {
    updateUserHistory(userId, text, llmResult.intent);
    return llmResult;
  }
  
  // Fallback: Use highest confidence
  const results = [patternResult, nlpResult, llmResult].filter(r => r.confidence > 0);
  const best = results.length > 0 ? results.reduce((a, b) => a.confidence > b.confidence ? a : b) : {
    intent: INTENT_CATEGORIES.ACTION,
    confidence: 0.5,
    source: "fallback"
  };
  
  updateUserHistory(userId, text, best.intent);
  return best;
}

// 📊 User History Tracking
function updateUserHistory(userId, text, intent) {
  const history = intentHistory.get(userId) || { intents: [], lastActions: [], lastTaskId: null, lastAction: null };
  history.intents.push({ intent, text, timestamp: Date.now() });
  history.lastActions.push(intent);
  
  // Extract task ID from text if present
  const taskIdMatch = text.match(/\b([a-f\d]{24})\b/i);
  if (taskIdMatch) {
    history.lastTaskId = taskIdMatch[1];
  }
  
  // Track last action type
  history.lastAction = intent;
  
  // Keep only last 50 entries
  if (history.intents.length > 50) {
    history.intents = history.intents.slice(-50);
  }
  if (history.lastActions.length > 10) {
    history.lastActions = history.lastActions.slice(-10);
  }
  
  intentHistory.set(userId, history);
}

// 🎯 Get Last Task Context
function getLastTaskContext(userId) {
  const history = intentHistory.get(userId);
  return {
    lastTaskId: history?.lastTaskId || null,
    lastAction: history?.lastAction || null,
    recentActions: history?.lastActions?.slice(-5) || []
  };
}

// 📈 Analytics & Monitoring
function getClassificationStats() {
  const totalPatterns = patternCache.size;
  const totalUsers = intentHistory.size;
  const avgConfidence = Array.from(patternCache.values())
    .reduce((sum, p) => sum + p.confidence, 0) / totalPatterns || 0;
  
  return {
    totalPatterns,
    totalUsers,
    avgConfidence: avgConfidence.toFixed(2),
    cacheSize: patternCache.size
  };
}

// 🔄 Cleanup Old Data
function cleanup() {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  // Clean old patterns
  for (const [key, pattern] of patternCache.entries()) {
    if (now - pattern.lastSeen > oneWeek) {
      patternCache.delete(key);
    }
  }
  
  // Clean old user histories
  for (const [userId, history] of intentHistory.entries()) {
    history.intents = history.intents.filter(entry => now - entry.timestamp < oneWeek);
    if (history.intents.length === 0) {
      intentHistory.delete(userId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanup, 60 * 60 * 1000);

module.exports = {
  classifyWithContext,
  quickPatternMatch,
  localNLPClassify,
  llmClassify,
  learnPattern,
  getClassificationStats,
  getLastTaskContext,
  INTENT_CATEGORIES,
  CONFIDENCE_THRESHOLDS,
  patternCache,
  intentHistory
};
