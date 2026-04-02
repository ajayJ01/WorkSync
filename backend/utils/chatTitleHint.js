const { normalizeChatText } = require("./textNormalizer");

/**
 * Core extraction on one string (no extra normalize — caller passes raw or normalized).
 */
function extractTitleHintFromString(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";

  const quoted =
    raw.match(/\btitle\b[^"'`]*["'`](.+?)["'`]/i) ||
    raw.match(/\bjiska\s+title\b[^"'`]*["'`](.+?)["'`]/i) ||
    raw.match(/\bjinke\s+title\b[^"'`]*["'`](.+?)["'`]/i) ||
    raw.match(/\b(?:description|discription)\b[^"'`]*["'`](.+?)["'`]/i) ||
    raw.match(/\bjiska\s+(?:description|discription)\b[^"'`]*["'`](.+?)["'`]/i);
  if (quoted?.[1]) return quoted[1].replace(/\s+/g, " ").trim();

  const m =
    raw.match(/\bjiska\s+(?:title|description|discription)\s+(.+?)\s+hai\b/i) ||
    raw.match(/\b(?:title|description|discription)\s+(.+?)\s+hai\b/i) ||
    raw.match(/\b(?:title|description|discription)\s+(.+?)\s+(?:usme|usko|isme|isko|update|change|badal|kr|kro|karo)\b/i) ||
    raw.match(/\btasks?\s+jiska\s+title\s+(.+?)\s+hai\b/i) ||
    raw.match(/\btask\s+(.+?)\s+(?:ko|ka|ki)\b/i);
  const title = m?.[1]?.trim() || "";
  return title.replace(/^["'`]|["'`]$/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Typo-normalizer "fist"→"first" etc. DB mein purana title reh sakta hai — raw + normalized dono se hint nikalo.
 * @param {string} normalizedText - chat pipeline se (e.g. normalizeUserText)
 * @param {string} [rawText] - user ka asli message (optional)
 */
function extractTitleHintVariants(normalizedText, rawText = null) {
  const norm = String(normalizedText || "").trim();
  const raw = rawText != null && String(rawText).trim() !== "" ? String(rawText).trim() : norm;
  const out = [];
  const seen = new Set();
  for (const src of [raw, norm, normalizeChatText(raw), normalizeChatText(norm)]) {
    const h = extractTitleHintFromString(String(src || "").trim());
    if (!h) continue;
    const key = h.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function extractTitleHint(text, rawText = null) {
  const v = extractTitleHintVariants(text, rawText);
  return v[0] || "";
}

module.exports = {
  extractTitleHint,
  extractTitleHintVariants,
};
