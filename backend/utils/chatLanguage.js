function detectChatLanguage(text) {
  const s = String(text || "").trim();
  if (!s) return "en";

  const totalChars = s.length;
  const devanagariChars = (s.match(/[\u0900-\u097F]/g) || []).length;
  const latinChars = (s.match(/[a-z]/gi) || []).length;
  const devanagariRatio = totalChars ? devanagariChars / totalChars : 0;

  // Strong Hindi signal: mostly Devanagari script.
  if (devanagariRatio >= 0.25 && devanagariChars >= 2) return "hi";

  const lower = s.toLowerCase();
  const tokens = lower.split(/[^a-z\u0900-\u097f]+/i).filter(Boolean);
  if (!tokens.length) return "en";

  // Roman-Hindi (Hinglish) cues.
  const hinglishLexicon = new Set([
    "kya", "kaise", "kese", "mera", "meri", "mere", "tum", "aap", "hai", "hain", "kar",
    "karo", "kr", "dikhao", "batao", "btao", "kitne", "kaun", "kyun", "banao", "banado", "ek",
    "naya", "kal", "aaj", "abhi", "mujhe", "dekho", "lao", "hua", "hui", "kab", "kaha", "kidhar",
    "kisko", "namaste", "pranam", "nhi", "nahi", "haan", "acha", "accha", "theek", "thik",
    "apna", "apni", "ka", "ki", "ke", "pas", "paas", "sab", "saare", "jiska", "jiski", "jinki",
    "nam", "naam", "badal", "badlo", "wahi", "yahi", "tarikh", "tareek", "vivran", "kaam", "kam",
    "banaya", "banayi", "chipka", "lagao", "assign", "isko", "usko", "pehle", "phir",
  ]);

  // Common English conversational cues.
  const englishLexicon = new Set([
    "the", "is", "are", "what", "why", "how", "when", "where", "who", "can", "could",
    "should", "would", "please", "show", "list", "update", "create", "task", "tasks",
    "status", "today", "tomorrow", "yesterday", "my", "your", "you", "me", "we", "they",
  ]);

  let hinglishScore = 0;
  let englishScore = 0;
  for (const t of tokens) {
    if (hinglishLexicon.has(t)) hinglishScore += 1;
    if (englishLexicon.has(t)) englishScore += 1;
  }

  // Mixed script/text tends to be Hinglish in this product context.
  if (devanagariChars > 0 && latinChars > 0) return "hinglish";

  // Roman text with strong Hindi cues.
  if (latinChars > 0 && hinglishScore >= 1 && englishScore >= 1) return "hinglish";
  if (latinChars > 0 && hinglishScore >= 2) return "hinglish";

  // Short and noisy chat usually works better with Hinglish copy.
  if (tokens.length <= 3 && hinglishScore >= 1) return "hinglish";

  return "en";
}

function pickByLanguage(lang, copy) {
  if (lang === "hi" && copy.hi) return copy.hi;
  if (lang === "en" && copy.en) return copy.en;
  return copy.hinglish || copy.en || copy.hi || "";
}

module.exports = {
  detectChatLanguage,
  pickByLanguage,
};
