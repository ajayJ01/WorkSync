<template>
  <div
    :class="[
      'msg-row',
      message.role === 'user' ? 'msg-row-user' : 'msg-row-ai',
    ]"
  >
    <div v-if="message.role === 'ai'" class="bubble-avatar" aria-hidden="true">
      <i class="bi bi-stars"></i>
    </div>

    <div class="msg-col" :class="{ 'msg-col-user': message.role === 'user' }">
      <div
        :class="[
          'bubble',
          message.role === 'user' ? 'bubble-user' : 'bubble-ai',
        ]"
      >
        <div class="bubble-text">{{ message.text }}</div>
      </div>

      <div v-if="message.exportChoice" class="export-row">
        <button type="button" class="btn-export excel" @click="$emit('export', 'excel')">
          <i class="bi bi-file-earmark-spreadsheet me-1"></i>Excel
        </button>
        <button type="button" class="btn-export pdf" @click="$emit('export', 'pdf')">
          <i class="bi bi-file-earmark-pdf me-1"></i>PDF
        </button>
      </div>

      <div v-if="message.candidates && message.candidates.length" class="candidates-row">
        <div class="candidate-header text-muted small mb-1">Options:</div>
        <button
          v-for="(c, idx) in message.candidates"
          :key="c.taskId"
          type="button"
          class="btn-candidate"
          @click="$emit('select-candidate', c)"
        >
          {{ idx + 1 }}. {{ c.title }} <span class="text-muted">({{ statusLabel(c.status) }})</span>
        </button>
      </div>

      <div v-if="message.tasks && message.tasks.length" class="task-cards">
        <div
          v-for="task in message.tasks.slice(0, 6)"
          :key="task._id"
          class="task-card"
        >
          <div class="d-flex align-items-start gap-2">
            <span :class="['status-dot mt-1 flex-shrink-0', getStatusColor(task.status)]" />
            <div class="overflow-hidden flex-grow-1 min-w-0">
              <div class="task-title text-truncate" :title="task.title">{{ task.title }}</div>
              <div class="task-desc text-truncate" :title="task.description">
                {{ task.description || "No description" }}
              </div>
              <div class="task-meta">
                <span class="meta-item">
                  <i class="bi bi-calendar3"></i>{{ formatDate(task.dueDate) }}
                </span>
                <span v-if="task.assignedTo?.length" class="meta-item">
                  <i class="bi bi-person"></i>
                  {{
                    Array.isArray(task.assignedTo)
                      ? task.assignedTo.map((u) => u.name || u).slice(0, 2).join(", ")
                      : task.assignedTo?.name || "—"
                  }}
                </span>
                <span :class="['pill', getStatusBadge(task.status)]">
                  {{ statusLabel(task.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="message.tasks.length > 6" class="task-more">
          +{{ message.tasks.length - 6 }} aur — Task List mein dekho
        </div>
      </div>

      <div :class="['msg-time', message.role === 'user' ? 'text-end' : '']">
        {{ message.time }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  message: { type: Object, required: true },
});

defineEmits(["export"]);

const statusLabel = (s) =>
  ({
    pending: "Pending",
    in_progress: "In Progress",
    submitted: "Submitted",
    verified: "Verified",
    cancelled: "Cancelled",
    rejected: "Rejected",
    due: "Expired",
  }[s] || s);

const getStatusColor = (s) =>
  ({
    pending: "dot-warning",
    in_progress: "dot-primary",
    submitted: "dot-purple",
    verified: "dot-success",
    cancelled: "dot-danger",
    rejected: "dot-danger",
    due: "dot-dark",
  }[s] || "dot-secondary");

const getStatusBadge = (s) =>
  ({
    pending: "pill-warn",
    in_progress: "pill-blue",
    submitted: "pill-submitted",
    verified: "pill-ok",
    cancelled: "pill-bad",
    rejected: "pill-reject",
    due: "pill-dark",
  }[s] || "pill-muted");

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}, ${h}:${m} ${ampm}`;
};
</script>

<style scoped>
.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}

.msg-row-user {
  justify-content: flex-end;
}

.msg-row-ai {
  justify-content: flex-start;
}

.bubble-avatar {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e0e7ff, #dbeafe);
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
  align-self: flex-end;
  box-shadow: 0 2px 8px rgb(99 102 241 / 0.12);
}

.msg-col {
  max-width: 88%;
  min-width: 0;
}

.msg-col-user {
  max-width: 82%;
}

.bubble {
  border-radius: 16px;
  font-size: 0.84rem;
  line-height: 1.55;
  word-break: break-word;
  padding: 10px 14px;
}

.bubble-user {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: #fff;
  border-bottom-right-radius: 5px;
  box-shadow: 0 6px 18px rgb(79 70 229 / 0.28);
}

.bubble-ai {
  background: #fff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-bottom-left-radius: 5px;
  box-shadow: 0 4px 14px rgb(15 23 42 / 0.06);
}

.bubble-text {
  white-space: pre-wrap;
}

.msg-time {
  font-size: 0.65rem;
  color: #94a3b8;
  margin-top: 4px;
  padding: 0 4px;
}

.export-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.btn-export {
  border: none;
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  transition:
    transform 0.12s,
    box-shadow 0.12s;
}

.btn-export.excel {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.btn-export.pdf {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.btn-export:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgb(15 23 42 / 0.08);
}

.candidates-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.btn-candidate {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 12px;
  text-align: left;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-candidate:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.task-cards {
  margin-top: 10px;
  padding-left: 2px;
}

.task-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 10px;
  margin-bottom: 8px;
  font-size: 0.78rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.task-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 14px rgb(99 102 241 / 0.08);
}

.task-title {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.8rem;
}

.task-desc {
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 2px;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
  font-size: 0.68rem;
  color: #64748b;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-item i {
  opacity: 0.7;
}

.pill {
  font-size: 0.62rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}

.pill-warn {
  background: #fef3c7;
  color: #92400e;
}
.pill-blue {
  background: #dbeafe;
  color: #1d4ed8;
}
.pill-submitted {
  background: #e0e7ff;
  color: #3730a3;
}
.pill-ok {
  background: #d1fae5;
  color: #047857;
}
.pill-bad {
  background: #fee2e2;
  color: #b91c1c;
}
.pill-reject {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.pill-dark {
  background: #334155;
  color: #f8fafc;
}
.pill-muted {
  background: #f1f5f9;
  color: #475569;
}

.task-more {
  text-align: center;
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-warning {
  background: #f59e0b;
}
.dot-primary {
  background: #6366f1;
}
.dot-purple {
  background: #7c3aed;
}
.dot-success {
  background: #10b981;
}
.dot-danger {
  background: #ef4444;
}
.dot-dark {
  background: #334155;
}
.dot-secondary {
  background: #94a3b8;
}
</style>
