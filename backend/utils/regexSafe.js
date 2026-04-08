/**
 * Escape user-controlled strings for use inside MongoDB $regex (literal match).
 */
function escapeRegex(str) {
  return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAX_REGEX_SEARCH_LEN = 200;

function escapeRegexTruncated(str, maxLen = MAX_REGEX_SEARCH_LEN) {
  const s = String(str ?? "").trim().slice(0, maxLen);
  return escapeRegex(s);
}

module.exports = {
  escapeRegex,
  escapeRegexTruncated,
  MAX_REGEX_SEARCH_LEN,
};
