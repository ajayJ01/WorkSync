function detectChatLanguage(text) {
  const s = String(text || "");
  if (/[\u0900-\u097F]/.test(s)) return "hi";

  const lower = s.toLowerCase();
  const hasEnglishLetters = /[a-z]/i.test(lower);
  const hinglishHints =
    /\b(kya|kaise|kese|mera|meri|tum|aap|hai|hain|kar|karo|kr|dikhao|batao|kitne|kaun|kyun|banao|banado|ek|naya|kal|aaj|mujhe|dekho|lao|hua|hui|kab|kaha|kidhar|kisko|namaste|pranam)\b/i.test(
      lower
    );

  if (hasEnglishLetters && hinglishHints) return "hinglish";
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
