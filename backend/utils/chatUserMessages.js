const { pickByLanguage } = require("./chatLanguage");

function aiBusyMessage(lang = "hinglish") {
  return pickByLanguage(lang, {
    en:
      "AI service is busy right now, but I can still help. Try a simple command: \"show tasks\", \"pending tasks\", or \"due tasks\".",
    hi:
      "AI सेवा अभी व्यस्त है, लेकिन मैं मदद कर सकता हूँ। सरल कमांड आज़माएँ: \"tasks dikhao\", \"pending tasks\", या \"due tasks\"।",
    hinglish:
      "AI service abhi thoda busy hai, lekin main help kar raha hoon. " +
      "Aap simple command try karo: \"tasks dikhao\", \"pending tasks\", \"due tasks\", ya \"task create karo\".",
  });
}

function unclearTaskMessage(lang = "hinglish") {
  return pickByLanguage(lang, {
    en:
      "I could not clearly understand the exact intent. Please send in this format: \"<which task> + <what action>\". " +
      "Example: \"update title of task due on 1 Apr to fix bugs\".",
    hi:
      "मैं आपका सटीक इरादा स्पष्ट रूप से समझ नहीं पाया। कृपया इस फ़ॉर्मेट में भेजें: \"<कौन-सा task> + <क्या action>\"। " +
      "उदाहरण: \"jiski due 1 Apr hai uska title fix bugs kar do\"।",
    hinglish:
      "Mujhe request ka exact intent clear nahi hua. " +
      "Aap is format me bhejo: \"<kaunsi task> + <kya action>\". " +
      "Example: \"jiski due 1 Apr hai uska title update karo ki fix bugs\".",
  });
}

function nonTaskScopeMessage(lang = "hinglish") {
  return pickByLanguage(lang, {
    en: "I am the WorkSync tasks/dashboard assistant. Please ask a task-related command and I will help right away.",
    hi: "मैं WorkSync tasks/dashboard assistant हूँ। कृपया task से जुड़ा command पूछें, मैं तुरंत मदद करूँगा।",
    hinglish: "Main WorkSync tasks/dashboard assistant hoon. Task-related command do, main turant help karunga.",
  });
}

function safeErrorMessage(lang = "hinglish") {
  return pickByLanguage(lang, {
    en:
      "An unexpected issue occurred, but your request is safe. Please try again. If it repeats, start with a short command like \"show tasks\".",
    hi:
      "एक अनपेक्षित समस्या आई, लेकिन आपकी request सुरक्षित है। कृपया दोबारा कोशिश करें। अगर समस्या दोहराए, तो \"tasks dikhao\" जैसे छोटे command से शुरू करें।",
    hinglish:
      "Unexpected issue aayi, lekin request safe hai. " +
      "Please dobara try karo. Agar repeat ho, short command bhejo: \"tasks dikhao\" se start karein.",
  });
}

module.exports = {
  aiBusyMessage,
  unclearTaskMessage,
  nonTaskScopeMessage,
  safeErrorMessage,
};
