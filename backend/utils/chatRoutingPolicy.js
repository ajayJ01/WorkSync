const ACTION_VERB_RE =
  /\b(assign|reassign|create|add|banao|banado|start|cancel|verify|update|change|set|upload|attach|export|download)\b/i;

const ALL_USERS_RE = /\b(saare\s*user|sare\s*user|sab\s*user|all\s*users?)\b/i;
const DESCRIPTION_REF_RE = /\bjiska\s+(?:description|discription)\b/i;

function hasActionVerb(text) {
  return ACTION_VERB_RE.test(String(text || ""));
}

function buildSignals(text, extras = {}) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  return {
    raw,
    lower,
    hasAllUsersScope: ALL_USERS_RE.test(lower),
    hasDescriptionRef: DESCRIPTION_REF_RE.test(lower),
    hasActionVerb: hasActionVerb(lower),
    hasTaskWord: /\b(task|tasks|kaam)\b/i.test(lower),
    hasCountWord: /\b(kitne|how many|count|total)\b/i.test(lower),
    ...extras,
  };
}

// Declarative rule set: priority order top -> bottom.
const ROUTING_RULES = [
  {
    id: "count_scope_all_users_followup",
    when: (s) =>
      s.hasAllUsersScope &&
      !s.hasActionVerb &&
      (s.previousPromptType === "count_user_scope" || s.hasCountWord || s.hasTaskWord),
    outcome: {
      route: "analytical",
      analystText: "Saare users ke assigned tasks ka total count batao.",
      reason: "count scope follow-up",
    },
  },
  {
    id: "description_reference_is_action",
    when: (s) =>
      s.hasDescriptionRef &&
      (s.hasTaskWord || s.currentDraftTool === "updateTaskFile" || s.currentDraftTool === "updateTaskTitle"),
    outcome: {
      route: "action",
      reason: "description based task reference",
    },
  },
];

function evaluateRoutingPolicy(text, extras = {}) {
  const signals = buildSignals(text, extras);
  for (const rule of ROUTING_RULES) {
    if (rule.when(signals)) {
      return { matchedRuleId: rule.id, ...rule.outcome };
    }
  }
  return { route: "default", matchedRuleId: null };
}

module.exports = {
  evaluateRoutingPolicy,
};
