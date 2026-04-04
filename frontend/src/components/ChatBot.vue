<template>
  <div class="chat-widget">
    <transition name="chat-slide">
      <div v-if="isOpen" class="chat-window">
        <div class="chat-header">
          <div class="header-glow" aria-hidden="true" />
          <div class="d-flex align-items-center justify-content-between position-relative px-3 py-3">
            <div class="d-flex align-items-center gap-3">
              <div class="ai-avatar-ring">
                <div class="ai-avatar-inner">
                  <i class="bi bi-stars"></i>
                </div>
              </div>
              <div>
                <div class="header-title">WorkSync AI</div>
                <div class="header-sub d-flex align-items-center gap-2">
                  <span class="pulse-dot" />
                  <span>Ready to help</span>
                </div>
              </div>
            </div>
            <div class="d-flex gap-1">
              <button
                type="button"
                class="header-icon-btn"
                title="Clear chat"
                @click="clearChat"
              >
                <i class="bi bi-trash3"></i>
              </button>
              <button type="button" class="header-icon-btn" title="Close" @click="toggleChat">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="chat-body">
          <div class="chat-messages px-3 py-3" ref="messagesContainer">
            <div v-if="messages.length === 0" class="welcome-screen">
              <div class="welcome-orbit">
                <div class="welcome-icon-wrap">
                  <i class="bi bi-chat-heart-fill"></i>
                </div>
              </div>
              <h6 class="welcome-heading">Hi there</h6>
              <p class="welcome-text">
                Tasks, stats, exports — poochho ya shortcut chip se try karo.
              </p>
              <div class="hint-grid">
                <button
                  v-for="hint in quickHints"
                  :key="hint"
                  type="button"
                  class="hint-chip"
                  @click="useHint(hint)"
                >
                  {{ hint }}
                </button>
              </div>
            </div>

            <ChatMessage
              v-for="msg in messages"
              :key="msg.id"
              :message="msg"
              @export="doExport"
            />

            <div v-if="isLoading" class="typing-row">
              <div class="typing-avatar"><i class="bi bi-stars"></i></div>
              <div class="typing-bubble">
                <span /><span /><span />
              </div>
            </div>
          </div>

          <transition name="fade">
            <div v-if="pendingConfirm" class="confirm-panel">
              <div class="confirm-text">
                <i class="bi bi-shield-exclamation me-2"></i>{{ pendingConfirm.message }}
              </div>
              <div class="confirm-actions">
                <button
                  type="button"
                  class="btn-confirm-yes"
                  :disabled="isLoading"
                  @click="confirmAction"
                >
                  Haan, karo
                </button>
                <button type="button" class="btn-confirm-no" @click="cancelConfirm">Nahi</button>
              </div>
            </div>
          </transition>

          <div class="chat-input-bar">
            <input
              ref="fileInputRef"
              type="file"
              class="d-none"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              @change="onPickFile"
            />
            <input
              v-model="inputText"
              type="text"
              class="chat-field"
              :placeholder="voiceSessionActive ? 'Sun raha hoon… (mic band karne ke liye dubara dabao)' : 'Message…'"
              :disabled="isLoading || !!pendingConfirm || voiceSessionActive"
              maxlength="300"
              @keydown.enter="sendMessage"
            />
            <button
              type="button"
              class="attach-fab"
              :disabled="isLoading || !!pendingConfirm || voiceSessionActive"
              title="Attach file"
              @click="openFilePicker"
            >
              <i class="bi bi-paperclip"></i>
            </button>
            <button
              v-if="speechSupported"
              type="button"
              class="mic-fab"
              :class="{ 'mic-fab--listening': voiceSessionActive }"
              :disabled="!!pendingConfirm || !!selectedFile"
              :title="voiceSessionActive ? 'Mic band karo' : 'Mic on — bolte raho, rukne par bhej dunga'"
              @click="toggleVoice"
            >
              <i :class="voiceSessionActive ? 'bi bi-stop-fill' : 'bi bi-mic-fill'" />
            </button>
            <button
              type="button"
              class="send-fab"
              :disabled="isLoading || voiceSessionActive || (!inputText.trim() && !selectedFile) || !!pendingConfirm"
              title="Send"
              @click="sendMessage"
            >
              <i class="bi bi-arrow-up"></i>
            </button>
          </div>
          <div v-if="selectedFile" class="file-chip-wrap">
            <span class="file-chip">
              <i class="bi bi-file-earmark-text me-1"></i>{{ selectedFile.name }}
            </span>
            <button class="file-chip-remove" type="button" @click="clearSelectedFile">Remove</button>
          </div>
        </div>
      </div>
    </transition>

    <button type="button" class="launcher" @click="toggleChat" aria-label="Open chat">
      <span class="launcher-bg" />
      <transition name="icon-flip" mode="out-in">
        <i v-if="isOpen" key="c" class="bi bi-x-lg launcher-ic"></i>
        <i v-else key="o" class="bi bi-stars launcher-ic"></i>
      </transition>
      <span v-if="unreadCount > 0 && !isOpen" class="launcher-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, getCurrentInstance, onMounted, onUnmounted, watch } from "vue";
import { request } from "@/services/apiWrapper";
import ChatMessage from "@/components/ChatMessage.vue";
import { useExport } from "@/composables/useExport";
import { loadChatMessages, saveChatMessages } from "@/utils/chatStorage";

const inst = getCurrentInstance();
const toast = inst?.appContext?.config?.globalProperties?.$toast;

let msgIdSeq = Date.now();
function newMsgId() {
  return `m_${msgIdSeq++}`;
}

const isOpen = ref(false);
const inputText = ref("");
const messages = ref([]);
const isLoading = ref(false);
const messagesContainer = ref(null);
const pendingConfirm = ref(null);
const unreadCount = ref(0);
const lastUserText = ref("");
const pendingExport = ref(null);
const selectedFile = ref(null);
const fileInputRef = ref(null);
/** Last AI task list — backend "iski ..." resolve karne ke liye */
const lastContextTaskIds = ref([]);

/** Chrome/Edge: Web Speech API — HTTPS ya localhost par mic permission */
const speechSupported = computed(
  () =>
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
);

/** Mic session: on until user clicks mic again (continuous listen + send on each pause) */
const voiceSessionActive = ref(false);
let voiceRecognition = null;

const quickHints = [
  "Kitne users hain? 👥",
  "Tasks dikhao 📋",
  "Pending tasks kitne hain? ⏳",
  "Aaj ka overview do 📊",
];

onMounted(() => {
  messages.value = loadChatMessages();
});

watch(
  messages,
  (val) => {
    saveChatMessages(val);
  },
  { deep: true }
);

const toggleChat = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) unreadCount.value = 0;
  scrollToBottom();
};

const clearChat = () => {
  if (voiceSessionActive.value) stopVoiceSession();
  messages.value = [];
  pendingConfirm.value = null;
  pendingExport.value = null;
  lastContextTaskIds.value = [];
  saveChatMessages([]);
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const onPickFile = (e) => {
  const f = e?.target?.files?.[0] || null;
  selectedFile.value = f;
};

const clearSelectedFile = () => {
  selectedFile.value = null;
  if (fileInputRef.value) fileInputRef.value.value = "";
};

const useHint = (hint) => {
  inputText.value = hint.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim();
  sendMessage();
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const addMessage = (role, text, extra = {}) => {
  messages.value.push({
    id: newMsgId(),
    role,
    text,
    time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    ...extra,
  });
  if (role === "ai" && !isOpen.value) unreadCount.value++;
  scrollToBottom();
};

const sendMessage = async () => {
  const text = inputText.value.trim();
  if ((!text && !selectedFile.value) || isLoading.value) return;

  if (pendingConfirm.value) {
    const isYes = /^(haan?|haa|ha|yes|y|pakka|theek hai|ok|okay|bilkul|confirm|karo|kar do)$/i.test(text);
    const isNo = /^(nahi|nah|no|n|mat karo|band karo|cancel|rehne do|chodo)$/i.test(text);

    if (isYes) {
      inputText.value = "";
      addMessage("user", text);
      confirmAction();
      return;
    }
    if (isNo) {
      inputText.value = "";
      addMessage("user", text);
      cancelConfirm();
      return;
    }
    return;
  }

  lastUserText.value = text;
  inputText.value = "";
  addMessage("user", text || "📎 File attached", selectedFile.value ? { attachedFileName: selectedFile.value.name } : {});
  isLoading.value = true;

  let payload = {
    text,
    contextTaskIds: lastContextTaskIds.value,
  };
  if (selectedFile.value) {
    const fd = new FormData();
    fd.append("text", text);
    fd.append("contextTaskIds", JSON.stringify(lastContextTaskIds.value));
    fd.append("file", selectedFile.value);
    payload = fd;
  }

  const [data, error] = await request("post", "/ai/command", payload);
  clearSelectedFile();
  isLoading.value = false;

  if (error) {
    addMessage("ai", error.message || "Kuch gadbad ho gayi 😅 Dobara try karo.");
    return;
  }

  if (data?.confirm) {
    pendingConfirm.value = {
      tool: data.tool,
      input: data.input,
      message: data.message,
    };
    addMessage("ai", `⚠️ ${data.message}`);
    return;
  }

  handleResponse(data);
};

function stopVoiceSession() {
  voiceSessionActive.value = false;
  const rec = voiceRecognition;
  voiceRecognition = null;
  try {
    rec?.stop();
  } catch {
    /* ignore */
  }
}

function attachVoiceRecognitionHandlers(rec) {
  rec.onresult = (event) => {
    if (voiceRecognition !== rec) return;
    /* AI jawab aa raha ho to naya final ignore — warna overlap / double-send */
    if (isLoading.value) return;

    let newFinal = "";
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) newFinal += r[0]?.transcript || "";
      else interim += r[0]?.transcript || "";
    }
    const interimTrim = interim.trim();
    const finalTrim = newFinal.trim().slice(0, 300);
    if (interimTrim || finalTrim) {
      inputText.value = `${finalTrim}${finalTrim && interimTrim ? " " : ""}${interimTrim}`.slice(0, 300);
    }
    if (!finalTrim) return;
    inputText.value = finalTrim;
    sendMessage();
  };

  rec.onerror = (e) => {
    if (voiceRecognition !== rec) return;
    if (e.error === "aborted" || e.error === "no-speech") return;
    stopVoiceSession();
    let msg = "Voice input fail ho gaya.";
    if (e.error === "not-allowed") {
      msg = "Mic allow karo — browser site settings se.";
    }
    toast?.error?.(msg);
  };

  rec.onend = () => {
    /* Purane session ka delayed onend nayi listening null na kare */
    if (voiceRecognition !== rec) return;
    voiceRecognition = null;
    if (!voiceSessionActive.value) return;
    if (isLoading.value || pendingConfirm.value) return;
    nextTick(() => tryStartVoiceRecognition());
  };
}

function tryStartVoiceRecognition() {
  if (
    !speechSupported.value ||
    !voiceSessionActive.value ||
    isLoading.value ||
    pendingConfirm.value ||
    selectedFile.value ||
    voiceRecognition
  ) {
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-IN";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  voiceRecognition = rec;
  attachVoiceRecognitionHandlers(rec);
  try {
    rec.start();
  } catch {
    voiceRecognition = null;
    toast?.error?.("Voice start nahi ho saka.");
  }
}

function startVoiceSession() {
  if (!speechSupported.value || pendingConfirm.value || selectedFile.value) return;
  voiceSessionActive.value = true;
  tryStartVoiceRecognition();
}

function toggleVoice() {
  if (voiceSessionActive.value) stopVoiceSession();
  else startVoiceSession();
}

watch(isLoading, (loading, wasLoading) => {
  if (wasLoading && !loading && voiceSessionActive.value && !pendingConfirm.value) {
    nextTick(() => {
      /* Session ab bhi chalu ho to zyada tar zaroorat nahi; browser ne band kiya ho to dubara start */
      if (!voiceRecognition) tryStartVoiceRecognition();
    });
  }
});

watch(pendingConfirm, (p) => {
  if (p && voiceSessionActive.value) stopVoiceSession();
});

watch(isOpen, (open) => {
  if (!open && voiceSessionActive.value) stopVoiceSession();
});

onUnmounted(() => {
  if (voiceSessionActive.value) stopVoiceSession();
});

const handleResponse = (data) => {
  if (!data?.success) {
    addMessage("ai", data?.message || "Samajh nahi aaya 😅");
    return;
  }

  const responseData = data?.data;
  const type = data?.type;

  if (type === "analyst") {
    addMessage("ai", data.message);
    return;
  }

  if (responseData?.cancelledCount != null) {
    const n = responseData.cancelledCount;
    const msg = `🚫 ${n} pending task${n !== 1 ? "s" : ""} cancel ho gaye.`;
    addMessage("ai", msg);
    toast?.success(msg.replace(/[^\w\s!]/g, "").trim());
    window.dispatchEvent(new CustomEvent("tasks:changed", { detail: { source: "chat", kind: "cancelPending" } }));
    return;
  }

  if (responseData?.startedCount != null) {
    const n = responseData.startedCount;
    const msg = `▶️ ${n} pending task${n !== 1 ? "s" : ""} start ho gaye — ab in par kaam karo.`;
    addMessage("ai", msg);
    toast?.success(msg.replace(/[^\w\s!]/g, "").trim());
    window.dispatchEvent(new CustomEvent("tasks:changed", { detail: { source: "chat", kind: "startPending" } }));
    return;
  }

  if (responseData?.tasks) {
    const count = responseData.tasks.length;
    const isExport = /export|download|excel|pdf|nikaalo/i.test(lastUserText.value);

    if (isExport && count > 0) {
      lastContextTaskIds.value = responseData.tasks.map((t) => t._id).filter(Boolean);
      const wantsPDF = /pdf/i.test(lastUserText.value);
      const wantsExcel = /excel|xlsx/i.test(lastUserText.value);

      const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString("default", { month: "short" });
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        const formattedHour = hours % 12 || 12;
        return `${day} ${month}, ${formattedHour}:${minutes} ${ampm}`;
      };

      const { exportToExcel, exportToPDF } = useExport(
        responseData.tasks,
        formatDate,
        1,
        responseData.tasks.length
      );

      if (wantsPDF) {
        exportToPDF();
        addMessage("ai", `📄 PDF export ho rahi hai — ${count} task${count > 1 ? "s" : ""}! ✅`);
      } else if (wantsExcel) {
        exportToExcel();
        addMessage("ai", `📊 Excel export ho rahi hai — ${count} task${count > 1 ? "s" : ""}! ✅`);
      } else {
        pendingExport.value = { tasks: responseData.tasks, formatDate, count };
        addMessage("ai", `📁 ${count} task${count > 1 ? "s" : ""} ready hain export ke liye! Konsa format chahiye?`, {
          exportChoice: true,
        });
      }
      return;
    }

    if (count === 0) {
      addMessage("ai", "Koi task nahi mila 🤷");
      lastContextTaskIds.value = [];
    } else {
      lastContextTaskIds.value = responseData.tasks.map((t) => t._id).filter(Boolean);
      addMessage("ai", `📋 ${count} task${count > 1 ? "s" : ""} mili hain:`, {
        tasks: responseData.tasks,
      });
    }
    return;
  }

  if (responseData?._id) {
    lastContextTaskIds.value = [responseData._id].filter(Boolean);
    const msgMap = {
      in_progress: "▶️ Task start ho gaya! Kaam shuru karo 💪",
      cancelled: "🚫 Task cancel ho gaya.",
      verified: "✅ Task verify ho gaya! Badiya kaam!",
      deleted: "🗑️ Task delete ho gaya.",
    };
    const msg = msgMap[responseData.status] || `✅ ${data.message || "Ho gaya!"}`;
    addMessage("ai", msg);
    toast?.success(msg.replace(/[^\w\s!]/g, "").trim());
    window.dispatchEvent(new CustomEvent("tasks:changed", { detail: { source: "chat", taskId: responseData._id } }));
    return;
  }

  addMessage("ai", data.message || "✅ Ho gaya!");
};

const confirmAction = async () => {
  if (!pendingConfirm.value || isLoading.value) return;
  const { tool, input } = pendingConfirm.value;
  pendingConfirm.value = null;
  isLoading.value = true;

  const [data, error] = await request("post", "/ai/confirm", { tool, input });
  isLoading.value = false;

  if (error) {
    addMessage("ai", error.message || "Action fail ho gaya 😅");
    return;
  }
  handleResponse(data);
};

const cancelConfirm = () => {
  pendingConfirm.value = null;
  addMessage(
    "ai",
    "Theek hai — confirm wala action nahi hua (maine kuch cancel / start / bulk change apply nahi kiya). Koi aur command?"
  );
};

const doExport = (format) => {
  if (!pendingExport.value) return;
  const { tasks, formatDate, count } = pendingExport.value;
  const { exportToExcel, exportToPDF } = useExport(tasks, formatDate, 1, count);

  if (format === "pdf") {
    exportToPDF();
    addMessage("ai", `📄 PDF export ho rahi hai — ${count} task${count > 1 ? "s" : ""}! ✅`);
  } else {
    exportToExcel();
    addMessage("ai", `📊 Excel export ho rahi hai — ${count} task${count > 1 ? "s" : ""}! ✅`);
  }
  pendingExport.value = null;
};
</script>

<style scoped>
.chat-widget {
  position: fixed;
  bottom: 22px;
  right: 22px;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.chat-window {
  width: min(380px, calc(100vw - 28px));
  height: min(560px, calc(100vh - 96px));
  display: flex;
  flex-direction: column;
  background: #fafbfc;
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 4px 6px -1px rgb(15 23 42 / 0.08),
    0 24px 48px -12px rgb(15 23 42 / 0.18);
  border: 1px solid rgb(226 232 240 / 0.9);
}

.chat-header {
  position: relative;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #0c4a6e 100%);
  color: #fff;
  flex-shrink: 0;
}

.header-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 60% at 20% 0%, rgb(56 189 248 / 0.35), transparent 55%);
  pointer-events: none;
}

.header-title {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
}

.header-sub {
  font-size: 0.72rem;
  color: rgb(255 255 255 / 0.72);
  margin-top: 2px;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 3px rgb(74 222 128 / 0.35);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}

.ai-avatar-ring {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  padding: 2px;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.25);
}

.ai-avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: rgb(15 39 68 / 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  color: #e0f2fe;
}

.header-icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.1);
  color: rgb(255 255 255 / 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.header-icon-btn:hover {
  background: rgb(255 255 255 / 0.2);
  color: #fff;
}

.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: linear-gradient(180deg, #f1f5f9 0%, #f8fafc 40%, #fff 100%);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.chat-messages::-webkit-scrollbar {
  width: 5px;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 6px;
}

.welcome-screen {
  text-align: center;
  padding: 1rem 0.5rem 0.5rem;
}

.welcome-orbit {
  width: 72px;
  height: 72px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #38bdf8, #6366f1, #a78bfa);
  padding: 3px;
  box-shadow: 0 12px 32px rgb(99 102 241 / 0.25);
}

.welcome-icon-wrap {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  color: #6366f1;
}

.welcome-heading {
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.35rem;
}

.welcome-text {
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.45;
  max-width: 260px;
  margin-left: auto;
  margin-right: auto;
}

.hint-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.hint-chip {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #334155;
  font-size: 0.72rem;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    transform 0.15s,
    box-shadow 0.15s,
    border-color 0.15s;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

.hint-chip:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgb(59 130 246 / 0.12);
  transform: translateY(-1px);
}

.typing-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 8px;
}

.typing-avatar {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e0e7ff, #dbeafe);
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.typing-bubble {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px 14px 14px 4px;
  padding: 12px 16px;
  display: flex;
  gap: 5px;
  align-items: center;
  box-shadow: 0 2px 8px rgb(15 23 42 / 0.06);
}

.typing-bubble span {
  width: 6px;
  height: 6px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typing 1.2s infinite;
}
.typing-bubble span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-bubble span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.confirm-panel {
  margin: 0 12px 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fcd34d;
  box-shadow: 0 4px 16px rgb(245 158 11 / 0.12);
  flex-shrink: 0;
}

.confirm-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 10px;
  line-height: 1.4;
}

.confirm-actions {
  display: flex;
  gap: 8px;
}

.btn-confirm-yes {
  flex: 1;
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: #fff;
  box-shadow: 0 4px 12px rgb(220 38 38 / 0.35);
}

.btn-confirm-yes:disabled {
  opacity: 0.6;
}

.btn-confirm-no {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  background: #fff;
  color: #475569;
}

.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 14px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.chat-field {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 0.875rem;
  background: #f8fafc;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s;
}

.chat-field:focus {
  outline: none;
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
}

.chat-field:disabled {
  opacity: 0.65;
}

.send-fab {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  box-shadow: 0 6px 16px rgb(79 70 229 / 0.4);
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.attach-fab {
  width: 42px;
  height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #fff;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.mic-fab {
  width: 42px;
  height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition:
    border-color 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.mic-fab:hover:not(:disabled) {
  border-color: #a5b4fc;
  color: #4f46e5;
}

.mic-fab--listening {
  border-color: #f87171;
  color: #dc2626;
  box-shadow: 0 0 0 3px rgb(248 113 113 / 0.25);
  animation: mic-pulse 1.2s ease-in-out infinite;
}

.mic-fab:disabled {
  opacity: 0.45;
}

@keyframes mic-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgb(248 113 113 / 0.2);
  }
  50% {
    box-shadow: 0 0 0 6px rgb(248 113 113 / 0.12);
  }
}

.file-chip-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 14px 10px;
  font-size: 0.72rem;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  background: #eef2ff;
  color: #3730a3;
  border-radius: 999px;
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip-remove {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.72rem;
}

.send-fab:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 8px 22px rgb(79 70 229 / 0.45);
}

.send-fab:disabled {
  opacity: 0.45;
  box-shadow: none;
}

.launcher {
  position: relative;
  width: 58px;
  height: 58px;
  border: none;
  border-radius: 18px;
  cursor: pointer;
  padding: 0;
  overflow: visible;
}

.launcher-bg {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: linear-gradient(145deg, #4f46e5, #2563eb, #7c3aed);
  box-shadow:
    0 10px 28px rgb(79 70 229 / 0.45),
    0 0 0 1px rgb(255 255 255 / 0.12) inset;
  transition: transform 0.2s ease;
}

.launcher:hover .launcher-bg {
  transform: scale(1.06);
}

.launcher-ic {
  position: relative;
  z-index: 1;
  font-size: 1.35rem;
  color: #fff;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.2));
}

.launcher-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 2;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgb(239 68 68 / 0.5);
}

.chat-slide-enter-active,
.chat-slide-leave-active {
  transition: all 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
}
.chat-slide-enter-from,
.chat-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.94);
}

.icon-flip-enter-active,
.icon-flip-leave-active {
  transition: all 0.18s ease;
}
.icon-flip-enter-from,
.icon-flip-leave-to {
  opacity: 0;
  transform: rotate(-40deg) scale(0.6);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
