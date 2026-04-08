const { PERMISSIONS, DANGEROUS_TOOLS } = require("../constants/permissions");

// ✅ Role-based permission check
function isAllowed(user, tool) {
  const role = user?.role || "user";
  return PERMISSIONS[role]?.includes(tool);
}

// ⚠️ Dangerous actions — confirmation required
function requiresConfirmation(tool) {
  return DANGEROUS_TOOLS.includes(tool);
}

// ❌ Totally blocked — never allowed
function isForbiddenIntent(text) {
  const banned = [
    "delete database",
    "drop database",
    "remove all data",
    "wipe data",
  ];
  const lower = text.toLowerCase();
  return banned.some((word) => lower.includes(word));
}

module.exports = { isAllowed, requiresConfirmation, isForbiddenIntent };