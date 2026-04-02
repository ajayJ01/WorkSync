let unavailableUntil = 0;

function markAiUnavailable(ms = 90 * 1000) {
  unavailableUntil = Math.max(unavailableUntil, Date.now() + Math.max(ms, 1000));
}

function isAiUnavailable() {
  return Date.now() < unavailableUntil;
}

function getUnavailableMsLeft() {
  return Math.max(unavailableUntil - Date.now(), 0);
}

module.exports = {
  markAiUnavailable,
  isAiUnavailable,
  getUnavailableMsLeft,
};
