<template>
  <div class="d-flex flex-column flex-grow-1 w-100 min-w-0">
    <Teleport to="body">
    <!-- Create Task Modal — on body so layout/transform/overflow cannot break fixed positioning -->
    <div class="modal fade task-ws-modal" id="createTaskModal" tabindex="-1" aria-labelledby="createTaskModalLabel"
      ref="createTaskModal" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
          <div class="modal-header task-modal-header px-3 py-3">
            <h5 class="modal-title text-primary mb-0" id="createTaskModalLabel">
              <i class="bi bi-card-checklist me-2"></i>
              {{ editingTask ? "Edit Task" : "Create and assign a task" }}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body task-modal-body px-3 py-3">
            <form id="taskCreateEditForm" @submit.prevent="submitCreateTaskForm" enctype="multipart/form-data">
              <!-- Title -->
              <div class="form-floating mb-3">
                <input v-model="title" type="text" class="form-control" id="floatingTitle" placeholder="Task Title"
                  required />
                <label for="floatingTitle">Task Title</label>
              </div>

              <!-- Description -->
              <div class="form-floating mb-3">
                <textarea v-model="description" class="form-control" placeholder="Task Description" id="floatingDesc"
                  style="height: 100px" required></textarea>
                <label for="floatingDesc">Description</label>
              </div>

              <!-- File Upload -->
              <div class="mb-3">
                <label for="fileUpload" class="form-label fw-semibold">Upload File (PDF/Image)</label>
                <input type="file" class="form-control" id="fileUpload" ref="fileInput" name="file"
                  accept=".pdf,image/*" @change="handleFileChange" />
                <!-- Show file name if selected -->
                <div v-if="file?.name" class="text-success small mt-1">Selected: {{ file.name }}</div>
              </div>

              <!-- Show file preview if editing -->
              <div v-if="editingTask?.fileUrl" class="mb-3">
                <label class="form-label fw-semibold small text-muted">Current attachment</label>
                <div class="d-flex align-items-center gap-2">
                  <template v-if="isImage(editingTask.fileUrl)">
                    <img
                      :src="getFullFileUrl(editingTask.fileUrl)"
                      alt=""
                      class="rounded border"
                      style="width: 48px; height: 48px; object-fit: cover"
                      :title="editingTask.fileUrl.split('/').pop()"
                    />
                  </template>
                  <a
                    v-else
                    :href="getFullFileUrl(editingTask.fileUrl)"
                    target="_blank"
                    class="btn btn-sm btn-outline-primary"
                    :title="editingTask.fileUrl.split('/').pop()"
                  >
                    <i class="bi bi-file-earmark-pdf me-1"></i>View PDF
                  </a>
                </div>
              </div>

              <!-- Due Date -->
              <div class="form-floating mb-3">
                <input v-model="dueDate" type="datetime-local" :min="isMinDateDisabled ? null : minDate" :max="maxDate"
                  class="form-control" id="floatingDueDate" required />
                <label for="floatingDueDate">Due Date</label>
              </div>

              <!-- Status Dropdown (only in edit mode) -->
              <div v-if="editingTask" class="form-floating mb-3">
                <select v-model="status" class="form-select" id="floatingStatus" required>
                  <option value="pending">Pending</option>
                  <option v-if="status === 'in_progress'" value="in_progress">In Progress</option>
                  <option v-if="status === 'submitted'" value="submitted">Submitted</option>
                  <option v-if="status === 'due'" value="due">Expired</option>
                  <option v-if="status === 'rejected'" value="rejected">Rejected</option>
                  <option value="verified">Done</option>
                </select>
                <label for="floatingStatus">Task Status</label>
              </div>

              <div class="mb-2">
                <div class="form-label fw-semibold mb-2">Assign to</div>
                <p v-if="users.length === 0" class="text-danger small mb-0">
                  No users loaded. Check connection and try again.
                </p>
                <div v-else class="task-assign-checkboxes" role="group" aria-label="Assign to users">
                  <label v-for="u in users" :key="String(u._id)" class="task-assign-row">
                    <input v-model="assignedSelectedIds" type="checkbox" class="form-check-input flex-shrink-0"
                      :value="String(u._id)" />
                    <span class="task-assign-name">{{ assignOptionLabel(u) }}</span>
                    <span v-if="u.role" class="task-assign-role text-muted small">{{ u.role }}</span>
                  </label>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer px-3 pb-3 pt-2 gap-2">
            <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary px-4" @click="submitCreateTaskForm">
              <i :class="editingTask ? 'bi bi-pencil-square' : 'bi bi-plus-circle'" class="me-2"></i>
              {{ editingTask ? "Update task" : "Create task" }}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Teleport>

    <Teleport to="body">
    <!-- VERIFY SUBMISSION MODAL -->
    <div class="modal fade task-ws-modal" id="verifySubmissionModal" tabindex="-1" ref="verifySubmissionModal" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 pb-0 px-3 pt-3">
            <h5 class="modal-title text-primary">
              <i class="bi bi-clipboard-check me-2"></i> Review Submission
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-3 pt-2">
            <div v-if="selectedTask">
              <div class="mb-2"><b>Title:</b> {{ selectedTask.title }}</div>
              <div class="mb-2"><b>Description:</b> {{ selectedTask.description }}</div>
              <div class="mb-2"><b>Submitted Marks:</b> {{ selectedTask.submittedMarks ?? 'N/A' }}</div>
              <div class="mb-3">
                <b>Submitted File:</b>
                <div class="mt-2">
                  <div v-if="selectedTask.submissionFileUrl"
                    class="file-card p-2 rounded-3 border d-inline-flex align-items-center gap-3 bg-white shadow-sm">
                    <template v-if="isImage(selectedTask.submissionFileUrl)">
                      <a :href="getFullFileUrl(selectedTask.submissionFileUrl)" target="_blank"
                        :title="selectedTask.submissionFileUrl.split('/').pop()"
                        class="d-flex align-items-center text-decoration-none">
                        <img :src="getFullFileUrl(selectedTask.submissionFileUrl)" alt="Image"
                          class="img-thumbnail shadow-sm attachment-img"
                          style="width:42px; height:42px; object-fit:cover;" />
                        <span class="file-label ms-2 text-primary">{{ selectedTask.submissionFileUrl.split('/').pop()
                        }}</span>
                      </a>
                    </template>
                    <template v-else>
                      <a :href="getFullFileUrl(selectedTask.submissionFileUrl)" target="_blank"
                        class="d-flex align-items-center text-decoration-none attachment-pdf-link"
                        :title="selectedTask.submissionFileUrl.split('/').pop()">
                        <i class="bi bi-file-earmark-pdf fs-2 text-danger"></i>
                        <span class="file-label ms-2 text-danger">{{ selectedTask.submissionFileUrl.split('/').pop()
                        }}</span>
                        <span class="badge bg-soft bg-danger bg-opacity-25 text-danger ms-2">PDF</span>
                      </a>
                    </template>
                  </div>
                  <div v-else class="no-file d-flex align-items-center gap-2 p-2 rounded-3 bg-light"
                    style="min-width:120px;">
                    <i class="bi bi-file-earmark-x fs-4 text-muted"></i>
                    <span class="small text-muted">No File</span>
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Remark (required if rejecting):</label>
                <textarea v-model="adminRemark" class="form-control" :disabled="verifying"
                  placeholder="Type any remarks for user here..."></textarea>
              </div>
            </div>
          </div>

          <div class="modal-footer px-3 pb-3 pt-2 gap-2">
            <button class="btn btn-success" :disabled="verifying" @click="handleVerifySubmission('verified')">
              <span v-if="verifying" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-check-circle"></i> Verify
            </button>
            <button class="btn btn-danger" :disabled="verifying" @click="handleVerifySubmission('rejected')">
              <i class="bi bi-x-circle"></i> Reject
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
            <i class="bi bi-kanban" aria-hidden="true"></i>
            Tasks
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
            <button type="button" class="ws-btn-tool ws-btn-tool--primary" @click="openCreateModal">
              <i class="bi bi-plus-lg" aria-hidden="true"></i>
              New task
            </button>
          </div>
        </div>

        <div class="task-filter-bar">
          <div class="task-filter-field">
            <label for="taskFilterSearch">Search</label>
            <input
              id="taskFilterSearch"
              v-model="filters.search"
              type="text"
              class="form-control"
              placeholder="Title or description…"
              autocomplete="off"
            />
          </div>
          <div class="task-filter-field">
            <label for="taskFilterStatus">Status</label>
            <select id="taskFilterStatus" v-model="filters.status" class="form-select">
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
            <label for="taskFilterDates">Due range</label>
            <input
              id="taskFilterDates"
              ref="dateRangeInput"
              v-model="filters.dateRange"
              type="text"
              class="form-control"
              placeholder="Pick range"
              readonly
              @focus="showDateRangePicker"
            />
          </div>
          <div class="task-filter-field">
            <label>Assignees</label>
            <multiselect
              v-model="filters.assignedTo"
              :options="users"
              :multiple="true"
              :close-on-select="false"
              placeholder="Anyone"
              label="name"
              track-by="_id"
              class="w-100"
            />
          </div>
          <div class="task-filter-field task-filter-field--reset">
            <label for="taskFilterResetBtn">Reset</label>
            <button
              id="taskFilterResetBtn"
              type="button"
              class="ws-btn-tool ws-btn-tool--reset task-filter-reset-btn"
              title="Clear search, status, dates, and assignees"
              @click="resetTaskFilters"
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
                <th style="width: 16%">Title</th>
                <th style="width: 26%">Description</th>
                <th style="width: 12%">Due</th>
                <th style="width: 18%">Assigned</th>
                <th style="width: 10%">Status</th>
                <th style="width: 8%">File</th>
                <th style="width: 10%" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasks" :key="task._id">
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
                    <span class="task-cell-due" :title="task.dueDate ? new Date(task.dueDate).toLocaleString() : ''">
                      {{ formatDate(task.dueDate) }}
                    </span>
                  </div>
                </td>
                <td class="assigned-to-cell">
                  <div class="task-cell-inner task-cell-inner--assign">
                    <div class="w-100">
                      <div class="d-flex flex-wrap align-items-center">
                        <template v-if="Array.isArray(task.assignedTo)">
                          <span
                            v-for="(user, idx) in task.assignedTo.slice(0, 3)"
                            :key="user._id || idx"
                            class="assign-pill"
                          >
                            {{ user.name || "User" }}
                          </span>
                          <span
                            v-if="task.assignedTo.length > 3 && !expandedRows.includes(task._id)"
                            class="assign-pill assign-more"
                            role="button"
                            tabindex="0"
                            @click="toggleRow(task._id)"
                            @keydown.enter="toggleRow(task._id)"
                          >
                            +{{ task.assignedTo.length - 3 }}
                          </span>
                        </template>
                        <span v-else class="assign-pill">{{ task.assignedTo?.name || "—" }}</span>
                      </div>
                      <div
                        v-if="Array.isArray(task.assignedTo) && task.assignedTo.length > 3 && expandedRows.includes(task._id)"
                        class="mt-1 d-flex flex-wrap align-items-center"
                      >
                        <span
                          v-for="(user, idx) in task.assignedTo.slice(3)"
                          :key="user._id || idx"
                          class="assign-pill"
                        >
                          {{ user.name || "User" }}
                        </span>
                        <span
                          class="assign-pill assign-more"
                          role="button"
                          tabindex="0"
                          @click="toggleRow(task._id)"
                          @keydown.enter="toggleRow(task._id)"
                        >
                          Less
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="task-cell-inner">
                    <span class="ws-badge" :class="taskStatusBadgeClass(task.status)">
                      {{ taskStatusLabel(task.status) }}
                    </span>
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
                          <img
                            :src="getFullFileUrl(task.fileUrl)"
                            alt=""
                            class="attachment-thumb"
                          />
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
                      <button
                        v-if="task.status === 'submitted'"
                        type="button"
                        class="task-review-link"
                        title="Review submission"
                        @click="openVerifyModal(task)"
                      >
                        <i class="bi bi-eye"></i>
                        Review
                      </button>
                      <button
                        type="button"
                        class="task-action-btn"
                        :title="task.status === 'cancelled' ? 'Cannot edit cancelled task' : 'Edit'"
                        :disabled="task.status === 'cancelled'"
                        @click="handleTaskEdit(task)"
                      >
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        type="button"
                        class="task-action-btn task-action-btn--danger"
                        :title="task.status === 'cancelled' ? 'Already cancelled' : 'Cancel task'"
                        :disabled="task.status === 'cancelled' || task.status === 'verified' || task.status === 'due'"
                        @click="handleTaskCancel(task)"
                      >
                        <i class="bi bi-x-lg"></i>
                      </button>
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
          <select v-model="perPage" class="form-select form-select-sm w-auto" @change="handlePerPageChange">
            <option :value="10">10 / page</option>
            <option :value="20">20 / page</option>
            <option :value="50">50 / page</option>
            <option :value="100">100 / page</option>
            <option :value="500">500 / page</option>
          </select>
          <BasePagination :currentPage="currentPage" :totalPages="totalPages" @page-change="changePage" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, getCurrentInstance, nextTick, computed, watch } from "vue";
import { request } from "@/services/apiWrapper";
import Multiselect from "vue-multiselect";
import "vue-multiselect/dist/vue-multiselect.css";
import { hideBootstrapModal, showBootstrapModal } from "@/utils/bootstrapModal.js";
import BasePagination from "@/components/BasePagination.vue";
import Swal from 'sweetalert2';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { useExport } from "@/composables/useExport";
import { validateFile } from "@/utils/validateFile";

defineOptions({ components: { Multiselect } });

const title = ref("");
const description = ref("");
const file = ref(null);
const fileInput = ref(null);
const dueDate = ref("");
const status = ref("pending");
/** Modal only: selected user _id strings (native multi-select) */
const assignedSelectedIds = ref([]);
const users = ref([]);
const tasks = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
const perPage = ref(10);
const createTaskModal = ref(null);
const editingTask = ref(null);
const expandedRows = ref([]);
const selectedTask = ref(null);
const adminRemark = ref("");
const verifySubmissionModal = ref(null);
const verifying = ref(false);
const dateRangeInput = ref(null);

const filters = reactive({
  search: '',
  status: '',
  dateRange: '',
  assignedTo: []
});
let autoRefreshTimer = null;
const onTasksChanged = () => fetchTasks(currentPage.value);

const openVerifyModal = (task) => {
  selectedTask.value = {
    ...task,
    submittedMarks: task.submissionNotes,
    submittedFileUrl: task.submissionFileUrl || null,
  };
  adminRemark.value = task.remark || "";
  showBootstrapModal(verifySubmissionModal);
};

const handleVerifySubmission = async (status) => {
  if (verifying.value) return;

  if (status === 'rejected' && !adminRemark.value.trim()) {
    toast.error("Please add a remark when rejecting.");
    return;
  }
  verifying.value = true;
  const [_data, error] = await request("put", `/tasks/${selectedTask.value._id}/admin-task-verify`, {
    status,
    remark: status === 'rejected' ? adminRemark.value.trim() : "",
  });
  verifying.value = false;
  if (error) {
    toast.error(error.message || "Could not update task status!");
  } else {
    toast.success(
      status === "verified"
        ? "Task marked as completed."
        : "Task rejected with remark."
    );
    hideBootstrapModal(verifySubmissionModal);
    await fetchTasks(currentPage.value);
  }
  selectedTask.value = null;
  adminRemark.value = "";
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

const resetTaskFilters = () => {
  filters.search = "";
  filters.status = "";
  filters.dateRange = "";
  filters.assignedTo = [];
  const el = dateRangeInput.value;
  if (el?._flatpickr) {
    el._flatpickr.clear();
  }
  currentPage.value = 1;
};

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

const isMinDateDisabled = computed(() => {
  return status.value === 'verified';
});

const { appContext } = getCurrentInstance();
const toast = appContext.config.globalProperties.$toast;

const today = new Date();
const minAllowedDate = new Date(today.getTime() + 60 * 60 * 1000); // 1hr ahead
const sixMonthsLater = new Date();
sixMonthsLater.setMonth(today.getMonth() + 6);

const formatToDateTimeLocal = (input) => {
  const date = new Date(input);

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.warn("Invalid date passed to formatToDateTimeLocal:", input);
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

const handleFileChange = (event) => {
  const selected = event.target.files[0];
  if (!selected) return;

  file.value = selected;
  const { valid, message } = validateFile(selected);
  if (!valid) {
    toast.error(message);
    return;
  }
};

const openCreateModal = async () => {
  resetForm();
  editingTask.value = null;
  await fetchAssignableUsers();
  await nextTick();
  showBootstrapModal(createTaskModal);
};

const minDate = formatToDateTimeLocal(minAllowedDate);
const maxDate = formatToDateTimeLocal(sixMonthsLater);

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

const handleExportExcel = () => {
  const { exportToExcel } = useExport(tasks.value, formatDate, currentPage.value, perPage.value);
  exportToExcel();
};

const handleExportPDF = () => {
  const { exportToPDF } = useExport(tasks.value, formatDate, currentPage.value, perPage.value);
  exportToPDF();
};

const customLabel = (user) => (user?.name ? `${user.name} (${user.email})` : "Unknown");

const assignOptionLabel = (user) => customLabel(user);

const fetchAssignableUsers = async () => {
  const [payload, err] = await request("get", "/users");
  if (!err && Array.isArray(payload?.data)) {
    users.value = payload.data;
  }
};

const fetchTasks = async (page = 1) => {
  const raw = {
    page,
    limit: perPage.value,
    search: filters.search?.trim(),
    status: filters.status,
    from: filters.dateRange?.split(" to ")[0],
    to: filters.dateRange?.split(" to ")[1],
    assignedTo: filters.assignedTo.length
      ? filters.assignedTo.map(u => u._id).join(",")
      : null
  };

  const params = Object.fromEntries(
    Object.entries(raw).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ""
    )
  );

  const query = new URLSearchParams(params).toString();
  const [data, error] = await request("get", `/tasks?${query}`);

  if (error) {
    toast.error(error.message || "Failed to load tasks");
  } else {
    tasks.value = data.data.tasks || [];
    totalPages.value = data.data.totalPages || 1;
    currentPage.value = data.data.currentPage || page;
  }
};

const handleTaskCancel = async (task) => {
  const result = await Swal.fire({
    title: 'Cancel this task?',
    text: `"${task.title}" will be marked as cancelled.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Yes, cancel it!',
    cancelButtonText: 'No, keep it',
    reverseButtons: true,
  });

  if (result.isConfirmed) {
    const [data, error] = await request("put", `/tasks/${task._id}/cancel`);

    if (error) {
      toast.error(error.message || "Failed to cancel task.");
    } else {
      toast.success(data.message || "Task cancelled successfully.");
      fetchTasks(currentPage.value);
    }
  }
};

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    currentPage.value = page;
    fetchTasks(page);
  }
};

const handlePerPageChange = () => {
  fetchTasks();
};

const resetForm = () => {
  title.value = "";
  description.value = "";
  file.value = null;
  fileInput.value.value = "";
  dueDate.value = "";
  assignedSelectedIds.value = [];
  status.value = "pending";
  editingTask.value = null;
};

const toggleRow = (taskId) => {
  if (expandedRows.value.includes(taskId)) {
    expandedRows.value = expandedRows.value.filter(id => id !== taskId);
  } else {
    expandedRows.value.push(taskId);
  }
};

const submitCreateTaskForm = async () => {
  if (!users.value.length) {
    await fetchAssignableUsers();
  }
  if (!users.value.length) {
    toast.error("No users to assign. Refresh the page.");
    return;
  }
  if (!assignedSelectedIds.value.length) {
    toast.error("Select at least one person under Assign to.");
    return;
  }
  const form = document.getElementById("taskCreateEditForm");
  if (!form) return;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  await handleTaskSubmit();
};

const handleTaskSubmit = async () => {
  const isEdit = !!editingTask.value;

  const selectedDate = new Date(dueDate.value);
  const now = new Date();
  const minAllowedDate = new Date(now.getTime() + 5 * 60 * 1000);

  const originalTask = isEdit
    ? tasks.value.find(task => task._id === editingTask.value._id)
    : null;

  // Validation: Only for reverting from verified to pending
  if (originalTask && originalTask.status !== 'pending' && status.value === 'pending') {
    if (selectedDate < minAllowedDate) {
      toast.error("Due date & time must be at least 5 minutes in the future.");
      return;
    }
  }

  if (file.value) {
    const result = validateFile(file.value);
    if (!result.valid) {
      toast.error(result.message);
      return;
    }
  }

  const formData = new FormData();
  formData.append('title', title.value.trim());
  formData.append('description', description.value.trim());
  formData.append('dueDate', selectedDate.toISOString());

  if (!assignedSelectedIds.value.length) {
    toast.error("At least one assignee must be selected.");
    return;
  }

  assignedSelectedIds.value.forEach((id) => {
    formData.append("assignedTo", id);
  });

  if (isEdit) {
    formData.append('status', status.value);
  }

  if (file.value) {
    formData.append('file', file.value);
  }

  const url = isEdit
    ? `/tasks/${editingTask.value._id}/update`
    : "/tasks/create";

  const method = isEdit ? "put" : "post";

  const [data, error] = await request(method, url, formData);

  if (error) {
    if (error.errors) {
      Object.entries(error.errors).forEach(([field, msg]) => {
        toast.error(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${msg}`);
      });
    } else {
      toast.error(error.message || (isEdit ? "Task update failed" : "Task creation failed"));
    }
  } else {
    toast.success(data.message || (isEdit ? "Task updated successfully!" : "Task created successfully!"));
    await nextTick();
    hideBootstrapModal(createTaskModal);
    fetchTasks(currentPage.value);
    resetForm();
  }
};

const handleTaskEdit = async (task) => {
  await fetchAssignableUsers();
  editingTask.value = task;
  title.value = task.title;
  description.value = task.description;
  dueDate.value = formatToDateTimeLocal(task.dueDate);
  if (Array.isArray(task.assignedTo)) {
    assignedSelectedIds.value = task.assignedTo.map((u) => String(u._id));
  } else if (task.assignedTo?._id) {
    assignedSelectedIds.value = [String(task.assignedTo._id)];
  } else {
    assignedSelectedIds.value = [];
  }
  status.value = task.status || "pending";
  await nextTick();
  showBootstrapModal(createTaskModal);
};

const getFullFileUrl = (fileUrl) => {
  if (!fileUrl) return '';
  // Agar already full URL hai (S3) toh seedha return karo
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  // Purani files ke liye (EC2 pe stored)
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/';
  return `${base.replace(/\/$/, '')}${fileUrl}`;
};

const isImage = (filePath) => {
  return /\.(jpg|jpeg|png|webp)$/i.test(filePath);
}

onMounted(async () => {
  await fetchTasks();
  await fetchAssignableUsers();

  const modalEl = createTaskModal.value;
  if (modalEl) {
    modalEl.addEventListener("hidden.bs.modal", () => {
      resetForm();
      editingTask.value = null;
    });
  }

  window.addEventListener("tasks:changed", onTasksChanged);

  autoRefreshTimer = setInterval(() => {
    // Real-time feel for cross-user updates without manual refresh
    if (!document.hidden) fetchTasks(currentPage.value);
  }, 12000);

});

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  window.removeEventListener("tasks:changed", onTasksChanged);
});

watch(
  () => ({
    ...filters,
    perPage: perPage.value,
    page: currentPage.value
  }),
  () => {
    fetchTasks(currentPage.value);
  },
  { deep: true }
);

</script>

<style scoped>
/* Verify modal — teleported outside .ws-app-shell */
.file-card {
  transition: box-shadow 0.13s;
  min-width: 140px;
  padding: 6px 10px;
}

.file-card:hover {
  box-shadow: 0 2px 14px 2px rgba(38, 38, 38, 0.08);
}

.attachment-img {
  width: 42px;
  height: 42px;
  object-fit: cover;
  border: 1.5px solid #eee;
  border-radius: 0.3rem;
  background: #f7fafc;
}

.attachment-pdf-link:hover .file-label {
  text-decoration: underline;
}

.file-label {
  font-size: 0.93em;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  display: inline-block;
  vertical-align: middle;
}

.no-file {
  font-size: 0.92em;
  border: 1px dashed #dee2e6;
  background: #f9fafb;
}

.bg-soft {
  background: #fbe9eb !important;
}
</style>