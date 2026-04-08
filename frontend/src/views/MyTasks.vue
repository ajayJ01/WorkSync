<template>
  <div class="d-flex flex-column flex-grow-1 w-100 min-w-0">
    <Teleport to="body">
      <div
        ref="completeModal"
        class="modal fade task-ws-modal"
        tabindex="-1"
        aria-labelledby="completeModalLabel"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content rounded-4">
            <div class="modal-header task-modal-header px-3 py-3">
              <h5 id="completeModalLabel" class="modal-title text-primary mb-0">
                <i class="bi bi-check2-circle me-2"></i>
                Complete task
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body task-modal-body px-3 py-3">
              <div class="form-floating mb-3">
                <textarea
                  id="completionNotes"
                  ref="notesRef"
                  class="form-control"
                  placeholder="Notes"
                  style="height: 100px"
                ></textarea>
                <label for="completionNotes">Completion notes</label>
              </div>
              <div class="mb-0">
                <label for="completionFile" class="form-label fw-semibold small text-muted"
                  >Upload attachment (PDF / image)</label
                >
                <input
                  id="completionFile"
                  ref="completionFileInput"
                  type="file"
                  class="form-control"
                  name="file"
                  accept=".pdf,image/*"
                  @change="handleFileUpload"
                />
                <div v-if="completionData.file?.name" class="text-success small mt-1">
                  Selected: {{ completionData.file.name }}
                </div>
              </div>
            </div>
            <div class="modal-footer px-3 pb-3 pt-2 gap-2">
              <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary px-4" @click="submitCompletion">
                <i class="bi bi-send-fill me-2"></i>
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="task-list-page px-2 px-md-3 py-3 flex-grow-1 w-100">
      <div class="ws-panel task-list-panel">
        <div class="task-toolbar">
          <h2 class="task-toolbar-title">
            <i class="bi bi-check2-square" aria-hidden="true"></i>
            My tasks
          </h2>
          <div class="task-toolbar-actions">
            <button type="button" class="ws-btn-tool ws-btn-tool--excel" @click="handleExportExcel">
              <i class="bi bi-file-earmark-excel" aria-hidden="true"></i>
              Excel
            </button>
            <button type="button" class="ws-btn-tool ws-btn-tool--pdf" @click="handleExportPDF">
              <i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>
              PDF
            </button>
          </div>
        </div>

        <div class="task-filter-bar task-filter-bar--my-tasks">
          <div class="task-filter-field">
            <label for="myTaskFilterSearch">Search</label>
            <input
              id="myTaskFilterSearch"
              v-model="filters.search"
              type="text"
              class="form-control"
              placeholder="Title or description…"
              autocomplete="off"
            />
          </div>
          <div class="task-filter-field">
            <label for="myTaskFilterStatus">Status</label>
            <select id="myTaskFilterStatus" v-model="filters.status" class="form-select">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Done</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              <option value="due">Expired</option>
            </select>
          </div>
          <div class="task-filter-field">
            <label for="myTaskFilterDates">Due range</label>
            <input
              id="myTaskFilterDates"
              ref="dateRangeInput"
              v-model="filters.dateRange"
              type="text"
              class="form-control"
              placeholder="Pick range"
              readonly
              @focus="showDateRangePicker"
            />
          </div>
          <div class="task-filter-field task-filter-field--reset">
            <label for="myTaskFilterResetBtn">Reset</label>
            <button
              id="myTaskFilterResetBtn"
              type="button"
              class="ws-btn-tool ws-btn-tool--reset task-filter-reset-btn"
              title="Clear search, status, and date range"
              @click="resetMyTaskFilters"
            >
              <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
              Reset
            </button>
          </div>
        </div>

        <div class="task-table-wrap table-responsive">
          <table class="table task-table mb-0">
            <thead>
              <tr>
                <th style="width: 4%">#</th>
                <th style="width: 16%">Title</th>
                <th style="width: 24%">Description</th>
                <th style="width: 12%">Due</th>
                <th style="width: 11%">Status</th>
                <th style="width: 10%">File</th>
                <th style="width: 13%" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(task, index) in tasks" :key="task._id">
                <td>
                  <div class="task-cell-inner">
                    <span class="task-cell-due">{{ (currentPage - 1) * perPage + index + 1 }}</span>
                  </div>
                </td>
                <td>
                  <div class="task-cell-inner">
                    <span class="task-cell-title" :title="task.title">{{ task.title }}</span>
                  </div>
                </td>
                <td>
                  <div class="task-cell-inner">
                    <div class="task-cell-desc" :title="task.description">{{ task.description }}</div>
                  </div>
                </td>
                <td>
                  <div class="task-cell-inner">
                    <span
                      class="task-cell-due"
                      :title="task.dueDate ? new Date(task.dueDate).toLocaleString() : ''"
                    >
                      {{ formatDate(task.dueDate) }}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="task-cell-inner">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <span
                        class="ws-badge"
                        :class="taskStatusBadgeClass(task.status)"
                        :title="
                          task.status === 'rejected'
                            ? 'Feedback: ' + (task.remark || 'No feedback provided')
                            : undefined
                        "
                      >
                        {{ taskStatusLabel(task.status) }}
                      </span>
                      <i
                        v-if="task.status === 'rejected' && task.remark"
                        class="bi bi-info-circle text-muted flex-shrink-0"
                        style="font-size: 0.85rem"
                        :title="'Feedback: ' + task.remark"
                        aria-hidden="true"
                      ></i>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="task-cell-inner">
                    <div class="attachment-minimal">
                      <template v-if="task.fileUrl">
                        <a
                          v-if="isImage(task.fileUrl)"
                          :href="getFullFileUrl(task.fileUrl)"
                          target="_blank"
                          rel="noopener"
                          :title="task.fileUrl.split('/').pop()"
                        >
                          <img :src="getFullFileUrl(task.fileUrl)" alt="" class="attachment-thumb" />
                        </a>
                        <a
                          v-else
                          :href="getFullFileUrl(task.fileUrl)"
                          target="_blank"
                          rel="noopener"
                          class="attachment-pdf-mini"
                          :title="task.fileUrl.split('/').pop()"
                        >
                          <i class="bi bi-file-earmark-pdf"></i>
                          PDF
                        </a>
                      </template>
                      <span v-else class="attachment-empty">—</span>
                    </div>
                  </div>
                </td>
                <td class="text-end">
                  <div class="task-cell-inner task-cell-inner--actions">
                    <div class="task-action-group">
                      <template v-if="task.status === 'rejected'">
                        <button
                          type="button"
                          class="task-review-link"
                          title="Resubmit after admin feedback"
                          @click="openCompleteModal(task)"
                        >
                          <i class="bi bi-arrow-repeat"></i>
                          Resubmit
                        </button>
                      </template>
                      <template v-else-if="task.status === 'pending'">
                        <button
                          type="button"
                          class="task-action-btn"
                          title="Start this task"
                          @click="markTaskStarted(task)"
                        >
                          <i class="bi bi-play-fill"></i>
                        </button>
                        <button
                          type="button"
                          class="task-action-btn"
                          title="Mark as completed"
                          @click="openCompleteModal(task)"
                        >
                          <i class="bi bi-check-lg"></i>
                        </button>
                      </template>
                      <template v-else-if="task.status === 'in_progress'">
                        <button type="button" class="task-action-btn" disabled title="In progress">
                          <i class="bi bi-hourglass-split"></i>
                        </button>
                        <button
                          type="button"
                          class="task-action-btn"
                          title="Submit completed task"
                          @click="openCompleteModal(task)"
                        >
                          <i class="bi bi-check-lg"></i>
                        </button>
                      </template>
                      <template v-else-if="task.status === 'submitted'">
                        <button type="button" class="task-action-btn" disabled title="Waiting for admin verification">
                          <i class="bi bi-upload"></i>
                        </button>
                      </template>
                      <template v-else-if="task.status === 'verified'">
                        <button
                          type="button"
                          class="task-action-btn task-action-btn--verified-done"
                          disabled
                          title="Task verified"
                        >
                          <i class="bi bi-patch-check"></i>
                        </button>
                      </template>
                      <template v-else>
                        <button type="button" class="task-action-btn" disabled title="No action available">
                          <i class="bi bi-x-circle"></i>
                        </button>
                      </template>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-if="tasks.length === 0">
                <td colspan="7" class="text-center text-muted py-5">No tasks match your filters.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="task-table-footer">
          <select v-model="perPage" class="form-select form-select-sm w-auto" @change="fetchTasks">
            <option :value="10">10 / page</option>
            <option :value="20">20 / page</option>
            <option :value="50">50 / page</option>
          </select>
          <BasePagination :current-page="currentPage" :total-pages="totalPages" @page-change="changePage" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from "vue";
import { request } from "@/services/apiWrapper";
import { useExport } from "@/composables/useExport";
import BasePagination from "@/components/BasePagination.vue";
import { useToast } from "@/composables/useToast";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { hideBootstrapModal, showBootstrapModal } from "@/utils/bootstrapModal.js";
import { validateFile } from "@/utils/validateFile";

const toast = useToast();
const tasks = ref([]);
const currentPage = ref(1);
const perPage = ref(10);
const totalPages = ref(1);
const selectedTask = ref(null);
const notesRef = ref(null);
const completeModal = ref(null);
const completionFileInput = ref(null);
const dateRangeInput = ref(null);

const completionData = ref({
  notes: "",
  file: null,
});

const filters = reactive({
  search: "",
  status: "",
  dateRange: "",
});

let autoRefreshTimer = null;
const onTasksChanged = () => fetchTasks();

const taskStatusBadgeClass = (status) => {
  const map = {
    pending: "ws-badge--pending",
    in_progress: "ws-badge--in_progress",
    submitted: "ws-badge--submitted",
    verified: "ws-badge--verified",
    cancelled: "ws-badge--cancelled",
    due: "ws-badge--due",
    rejected: "ws-badge--rejected",
  };
  return map[status] || "ws-badge--cancelled";
};

const taskStatusLabel = (status) =>
  ({
    pending: "Pending",
    in_progress: "Progress",
    submitted: "Submitted",
    verified: "Done",
    cancelled: "Cancelled",
    due: "Expired",
    rejected: "Rejected",
  }[status] || "—");

const isImage = (url) => /\.(jpe?g|png|webp)$/i.test(url || "");

const openCompleteModal = (task) => {
  selectedTask.value = task;
  completionData.value = { notes: "", file: null };
  if (notesRef.value) notesRef.value.value = "";
  if (completionFileInput.value) completionFileInput.value.value = "";
  showBootstrapModal(completeModal);
};

const markTaskStarted = async (task) => {
  const [res, err] = await request("post", `/my-tasks/${task._id}/start`);

  if (err) {
    toast.error(err.message || "Failed to start task");
  } else {
    const msg = res?.message?.trim() || "Task marked as started.";
    toast.success(msg);
    fetchTasks();
  }
};

const handleFileUpload = (event) => {
  const selected = event.target.files[0];
  if (!selected) return;

  const { valid, message } = validateFile(selected);
  if (!valid) {
    toast.error(message);
    if (completionFileInput.value) {
      completionFileInput.value.value = "";
    }
    completionData.value.file = null;
    return;
  }

  completionData.value.file = selected;
};

const submitCompletion = async () => {
  completionData.value.notes = notesRef.value?.value?.trim() || "";

  if (!completionData.value.notes) {
    toast.error("Please provide completion notes.");
    return;
  }

  const formData = new FormData();
  formData.append("notes", completionData.value.notes);

  if (completionData.value.file) {
    formData.append("file", completionData.value.file);
  }

  const [res, err] = await request("post", `/my-tasks/${selectedTask.value._id}/submit`, formData);

  if (err) {
    toast.error(err.message || "Failed to submit task completion");
  } else {
    const msg = res?.message?.trim() || "Task marked as completed.";
    toast.success(msg);
    hideBootstrapModal(completeModal);
    fetchTasks();

    completionData.value = { notes: "", file: null };
    if (notesRef.value) notesRef.value.value = "";
    if (completionFileInput.value) completionFileInput.value.value = "";
  }
};

const showDateRangePicker = () => {
  const el = dateRangeInput.value;
  if (!el) return;

  const today = new Date();
  const tenYearsLater = new Date();
  tenYearsLater.setFullYear(today.getFullYear() + 10);
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(today.getFullYear() - 10);

  if (!el._flatpickr) {
    flatpickr(el, {
      mode: "range",
      dateFormat: "Y-m-d",
      maxDate: tenYearsLater,
      minDate: tenYearsAgo,
      onClose: (selectedDates) => {
        if (selectedDates.length === 2) {
          filters.dateRange = `${selectedDates[0].toISOString().slice(0, 10)} to ${selectedDates[1].toISOString().slice(0, 10)}`;
        }
      },
    });
  }
  el._flatpickr.open();
};

const resetMyTaskFilters = () => {
  filters.search = "";
  filters.status = "";
  filters.dateRange = "";
  const el = dateRangeInput.value;
  if (el?._flatpickr) {
    el._flatpickr.clear();
  }
  currentPage.value = 1;
};

const fetchTasks = async () => {
  const raw = {
    page: currentPage.value,
    limit: perPage.value,
    search: filters.search?.trim(),
    status: filters.status,
    from: filters.dateRange?.split(" to ")[0],
    to: filters.dateRange?.split(" to ")[1],
  };

  const params = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

  const query = new URLSearchParams(params).toString();
  const [data, error] = await request("get", `/my-tasks?${query}`);

  if (error) {
    toast.error(error.message || "Failed to load tasks");
  } else {
    tasks.value = data.data.tasks || [];
    totalPages.value = data.data.totalPages || 1;
    currentPage.value = data.data.currentPage || currentPage.value;
  }
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getFullFileUrl = (relativePath) => {
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/";
  return `${base.replace(/\/$/, "")}${relativePath}`;
};

const changePage = (page) => {
  currentPage.value = page;
  fetchTasks();
};

const handleExportExcel = () => {
  const { exportToExcel } = useExport(tasks.value, formatDate, currentPage.value, perPage.value);
  exportToExcel();
};

const handleExportPDF = () => {
  const { exportToPDF } = useExport(tasks.value, formatDate, currentPage.value, perPage.value);
  exportToPDF();
};

onMounted(() => {
  fetchTasks();
  window.addEventListener("tasks:changed", onTasksChanged);
  autoRefreshTimer = setInterval(() => {
    if (!document.hidden) fetchTasks();
  }, 12000);
});

watch(filters, fetchTasks, { deep: true });

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  window.removeEventListener("tasks:changed", onTasksChanged);
});
</script>
