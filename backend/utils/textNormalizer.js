// Production-friendly text normalizer:
// 1) deterministic phrase replacements
// 2) bounded fuzzy correction for domain-critical keywords

const PHRASE_RULES = [
  [/\bsubmited\b/gi, "submitted"],
  [/\bsubmittted\b/gi, "submitted"],
  [/\bcancled\b/gi, "cancelled"],
  [/\bcancelld\b/gi, "cancelled"],
  [/\brejeted\b/gi, "rejected"],
  [/\brejacted\b/gi, "rejected"],
  [/\bverfied\b/gi, "verified"],
  [/\battanched\b/gi, "attached"],
  [/\baprail\b/gi, "april"],
  [/\btommorow\b/gi, "tomorrow"],
  [/\bhaiu\b/gi, "hai"],
  [/\bjaka\b/gi, "jiska"],
  [/\bjisa\b/gi, "jiska"],
  [/\bjiaka\b/gi, "jiska"],
  [/\bpendig\b/gi, "pending"],
  [/\baprove\b/gi, "approve"],
  [/\bprosesing\b/gi, "processing"],
  [/\bfist\b/gi, "first"],
  [/\bdiscription\b/gi, "description"],
  [/\bdescripton\b/gi, "description"],
];

const DOMAIN_WORDS = [
  "pending",
  "processing",
  "approve",
  "submitted",
  "cancelled",
  "rejected",
  "verified",
  "attached",
  "description",
  "assign",
  "reassign",
  "due",
  "deadline",
  "date",
  "april",
  "tomorrow",
  "jiska",
];

const tokenCache = new Map();
const MAX_CACHE = 2000;

function setCache(key, value) {
  if (tokenCache.size >= MAX_CACHE) {
    const first = tokenCache.keys().next().value;
    tokenCache.delete(first);
  }
  tokenCache.set(key, value);
}

function levenshtein(a, b, maxDistance = 2) {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > maxDistance) return maxDistance + 1;

  const prev = new Array(bl + 1);
  const curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;

  for (let i = 1; i <= al; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    for (let j = 0; j <= bl; j += 1) prev[j] = curr[j];
  }
  return prev[bl];
}

/** In DOMAIN_WORDS se snap hone se bachao — "test"→"task" jaise galat rewrite */
const SKIP_FUZZY_TO_DOMAIN = new Set([
  "test",
  "text",
  "team",
  "time",
  "take",
  "told",
  "best",
  "rest",
  "host",
  "post",
  "fast",
  "last",
  "past",
]);

function maybeCorrectToken(token) {
  const lower = token.toLowerCase();
  if (tokenCache.has(lower)) return tokenCache.get(lower);
  if (lower.length < 4 || /[^a-z]/i.test(lower)) {
    setCache(lower, token);
    return token;
  }
  if (SKIP_FUZZY_TO_DOMAIN.has(lower)) {
    setCache(lower, token);
    return token;
  }

  let best = null;
  let bestDist = 3;
  for (const w of DOMAIN_WORDS) {
    if (w[0] !== lower[0]) continue;
    const dist = levenshtein(lower, w, 2);
    if (dist < bestDist) {
      bestDist = dist;
      best = w;
      if (dist === 1) break;
    }
  }

  const out = best && bestDist <= 2 ? best : token;
  setCache(lower, out);
  return out;
}

function normalizeChatText(input) {
  let s = String(input || "");
  for (const [re, v] of PHRASE_RULES) s = s.replace(re, v);

  const pieces = s.split(/(\W+)/);
  for (let i = 0; i < pieces.length; i += 1) {
    if (/^[a-z]+$/i.test(pieces[i])) {
      pieces[i] = maybeCorrectToken(pieces[i]);
    }
  }
  return pieces.join("");
}

module.exports = {
  normalizeChatText,
};

