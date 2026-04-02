const data = require("../data/siteKnowledge.json");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function scoreFaq(queryTokens, item) {
  const hay = `${item.q} ${item.a}`;
  const hayTokens = new Set(tokenize(hay));
  let score = 0;
  queryTokens.forEach((t) => {
    if (hayTokens.has(t)) score += 1;
  });
  return score;
}

function isWebsiteInfoQuery(text) {
  const lower = normalize(text);
  return /(about|about us|faq|contact|support|company|website|platform|pricing|plan|policy|privacy|terms|details)/i.test(
    lower
  );
}

function getWebsiteInfoReply(text) {
  const q = normalize(text);
  if (/about|about us|company|platform/.test(q)) {
    return `${data.about}\n\nContact: ${data.contact.email} | ${data.contact.phone}`;
  }

  if (/contact|support/.test(q)) {
    return (
      `Contact details:\n` +
      `• Email: ${data.contact.email}\n` +
      `• Phone: ${data.contact.phone}\n` +
      `• Support Hours: ${data.contact.hours}`
    );
  }

  if (/faq|help|details|policy|privacy|terms/.test(q)) {
    const tokens = tokenize(q);
    const ranked = (data.faq || [])
      .map((f) => ({ ...f, _score: scoreFaq(tokens, f) }))
      .sort((a, b) => b._score - a._score);
    const top = ranked.filter((x) => x._score > 0).slice(0, 3);
    const picks = top.length ? top : ranked.slice(0, 3);
    const lines = picks.map((f, i) => `${i + 1}. ${f.q}\n   ${f.a}`).join("\n");
    return `FAQ quick answers:\n${lines}\n\nAur pucho: "contact details" ya "about us".`;
  }

  return (
    `Main website info me help kar sakta hoon: About, FAQ, Contact, Policies.\n` +
    `Try: "about us", "faq", "contact details".`
  );
}

module.exports = {
  isWebsiteInfoQuery,
  getWebsiteInfoReply,
};
