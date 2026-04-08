function validateToolCall(aiResponse) {
  if (!aiResponse) return false;

  const { tool, input } = aiResponse;

  if (!tool || typeof tool !== "string") {
    return false;
  }

  if (typeof input !== "object") {
    return false;
  }

  return true;
}

module.exports = { validateToolCall };