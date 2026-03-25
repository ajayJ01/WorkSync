<template>
    <div class="container-fluid min-vh-100 d-flex flex-column bg-light px-2 py-3">
        <!-- My Task Card -->
        <div class="card shadow-sm rounded-4 border-0 p-3 flex-grow-1 w-100">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 class="text-primary m-0">
                    <i class="bi bi-check2-square me-2"></i>My Tasks
                </h4>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-success btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
                        @click="handleExportExcel">
                        <i class="bi bi-file-earmark-excel"></i>
                        <span>Export Excel</span>
                    </button>

                    <button class="btn btn-outline-danger btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
                        @click="handleExportPDF">
                        <i class="bi bi-file-earmark-pdf"></i>
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            <!-- Filter -->
            <div class="row g-3 align-items-end mb-3">
                <div class="col-md-3">
                    <label class="form-label fw-semibold">Search</label>
                    <input v-model="filters.search" type="text" class="form-control"
                        placeholder="Search title or description..." />
                </div>

                <div class="col-md-2">
                    <label class="form-label fw-semibold">Status</label>
                    <select v-model="filters.status" class="form-select">
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Done</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rejected">Rejected</option>
                        <option value="due">Expired</option>
                    </select>
                </div>

                <div class="col-md-3">
                    <label class="form-label fw-semibold">Due Date Range</label>
                    <input v-model="filters.dateRange" type="text" class="form-control" placeholder="Select date range"
                        @focus="showDateRangePicker" readonly />
                </div>
            </div>

            <!-- Task Table -->
            <div class="table-responsive">
                <table class="table align-middle text-nowrap table-sm">
                    <thead class="table-light">
                        <tr>
                            <th style="width: 4%;">Sr.</th>
                            <th style="width: 17%;">Title</th>
                            <th style="width: 25%;">Description</th>
                            <th style="width: 14%;">Due Date</th>
                            <th style="width: 10%;">Status</th>
                            <th style="width: 12%;">Attachment</th>
                            <th style="width: 9%;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(task, index) in tasks" :key="task._id">
                            <td>{{ (currentPage - 1) * perPage + index + 1 }}</td>
                            <td class="text-truncate" :title="task.title">{{ task.title }}</td>
                            <td class="text-truncate" :title="task.description">{{ task.description }}</td>
                            <td>{{ formatDate(task.dueDate) }}</td>
                            <td>
                                <span :class="[
                                    'badge d-inline-flex align-items-center gap-1 rounded-pill fw-semibold small',
                                    task.status === 'pending' ? 'bg-warning text-dark' :
                                        task.status === 'in_progress' ? 'bg-primary text-white' :
                                            task.status === 'submitted' ? 'bg-submitted' :
                                                task.status === 'verified' ? 'bg-success text-white' :
                                                    task.status === 'cancelled' ? 'bg-danger text-white' :
                                                        task.status === 'due' ? 'bg-dark text-white' :
                                                            task.status === 'rejected' ? 'bg-danger bg-opacity-10 text-danger border border-danger' :
                                                                'bg-secondary text-white'
                                ]" :title="task.status === 'rejected' ? ('Reject Feedback : ' + (task.remark || 'No feedback provided')) : null"
                                    style="cursor: default;">
                                    <i :class="{
                                        'bi-hourglass-split': task.status === 'pending',
                                        'bi-arrow-repeat': task.status === 'in_progress',
                                        'bi-upload': task.status === 'submitted',
                                        'bi-check-circle': task.status === 'verified',
                                        'bi-x-circle': task.status === 'cancelled',
                                        'bi-clock-exclamation': task.status === 'due',
                                        'bi-x-octagon': task.status === 'rejected',
                                        'bi-question-circle': !task.status
                                    }"></i>
                                    {{
                                        {
                                            pending: 'Pending',
                                            in_progress: 'Progress',
                                            submitted: 'Submitted',
                                            verified: 'Verified',
                                            cancelled: 'Cancelled',
                                    due: 'Expired',
                                    rejected: 'Rejected'
                                    }[task.status] || 'Unknown'
                                    }}
                                    <i v-if="task.status === 'rejected' && task.remark"
                                        class="bi bi-info-circle ms-1"></i>
                                </span>
                            </td>
                            <td>
                                <div v-if="task.fileUrl">
                                    <template v-if="/\.(jpe?g|png|webp)$/i.test(task.fileUrl)">
                                        <a :href="getFullFileUrl(task.fileUrl)" target="_blank"
                                            :title="task.fileUrl.split('/').pop()">
                                            <img :src="getFullFileUrl(task.fileUrl)" alt="Attachment"
                                                class="attachment-preview" />
                                        </a>
                                    </template>
                                    <template v-else>
                                        <a :href="getFullFileUrl(task.fileUrl)" target="_blank" class="attachment-pdf"
                                            :title="task.fileUrl.split('/').pop()">
                                            <i class="bi bi-file-earmark-pdf me-1"></i>
                                            View PDF
                                        </a>
                                    </template>
                                </div>
                                <div v-else class="text-muted small">No File</div>
                            </td>
                            <td>
                                <div class="d-flex gap-2 flex-wrap">
                                    <!-- Rejected: Resubmit only -->
                                    <template v-if="task.status === 'rejected'">
                                        <button class="btn btn-sm btn-outline-primary" @click="openCompleteModal(task)"
                                            title="Resubmit after admin feedback">
                                            <i class="bi bi-arrow-repeat"></i>
                                            <span class="ms-1 d-none d-md-inline">Resubmit</span>
                                        </button>
                                    </template>
                                    <!-- Pending -->
                                    <template v-else-if="task.status === 'pending'">
                                        <button class="btn btn-sm btn-outline-primary" @click="markTaskStarted(task)"
                                            title="Start this task">
                                            <i class="bi bi-play-fill"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-success" @click="openCompleteModal(task)"
                                            title="Mark as completed">
                                            <i class="bi bi-check-lg"></i>
                                        </button>
                                    </template>
                                    <!-- In Progress -->
                                    <template v-else-if="task.status === 'in_progress'">
                                        <button class="btn btn-sm btn-outline-warning" disabled
                                            title="In progress Task">
                                            <i class="bi bi-hourglass-split"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-success" @click="openCompleteModal(task)"
                                            title="Submit completed task">
                                            <i class="bi bi-check-lg"></i>
                                        </button>
                                    </template>
                                    <!-- Submitted -->
                                    <template v-else-if="task.status === 'submitted'">
                                        <button class="btn btn-sm btn-outline-secondary" disabled
                                            title="Waiting for admin verification">
                                            <i class="bi bi-upload"></i>
                                        </button>
                                    </template>
                                    <!-- Verified -->
                                    <template v-else-if="task.status === 'verified'">
                                        <button class="btn btn-sm btn-success" disabled
                                            title="Task is verified and done">
                                            <i class="bi bi-patch-check"></i>
                                        </button>
                                    </template>
                                    <!-- Cancelled / Due / Unknown -->
                                    <template v-else>
                                        <button class="btn btn-sm btn-outline-dark" disabled
                                            title="Task is no longer available">
                                            <i class="bi bi-x-circle"></i>
                                        </button>
                                    </template>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="tasks.length === 0">
                            <td colspan="7" class="text-center text-muted py-4">No tasks found.</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <select v-model="perPage" class="form-select form-select-sm w-auto" @change="fetchTasks">
                    <option :value="10">10 per page</option>
                    <option :value="20">20 per page</option>
                    <option :value="50">50 per page</option>
                </select>
                <BasePagination :currentPage="currentPage" :totalPages="totalPages" @page-change="changePage" />
            </div>
        </div>

        <!-- Complete Task Modal -->
        <div class="modal fade" ref="completeModal" tabindex="-1" aria-labelledby="completeModalLabel"
            aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content rounded-4 shadow-sm">
                    <div class="modal-header">
                        <h5 class="modal-title" id="completeModalLabel">Complete Task</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div>
                            <label class="form-label fw-semibold">Completion Notes</label>
                            <textarea class="form-control" ref="notesRef" rows="3"
                                placeholder="Enter any notes about task completion..."></textarea>
                        </div>
                        <div class="mb-3 mt-3">
                            <label for="completionFile" class="form-label fw-semibold">Upload Attachment
                                (PDF/Image)</label>
                            <input type="file" class="form-control" id="completionFile" ref="completionFileInput"
                                name="file" accept=".pdf,image/*" @change="handleFileUpload" />
                            <!-- Show selected file name -->
                            <div v-if="completionFile?.name" class="text-success small mt-1">Selected: {{
                                completionFile.name }}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-success" @click="submitCompletion">Submit</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from "vue";
import { request } from "@/services/apiWrapper";
import { useExport } from "@/composables/useExport";
import BasePagination from "@/components/BasePagination.vue";
import { useToast } from "@/composables/useToast";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { hideBootstrapModal, showBootstrapModal } from "@/utils/bootstrapModal.js";
import { validateFile } from "@/utils/validateFile";
const completionFile = ref(null);
const completionFileInput = ref(null);

const toast = useToast();
const tasks = ref([]);
const currentPage = ref(1);
const perPage = ref(10);
const totalPages = ref(1);
const selectedTask = ref(null);
const notesRef = ref(null);
const completeModal = ref(null);

const completionData = ref({
    notes: '',
    file: null
});

const filters = reactive({
    search: '',
    status: '',
    dateRange: '',
});

const openCompleteModal = (task) => {
    selectedTask.value = task;
    completionData.notes = '';
    completionData.file = null;
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
    completionData.value.notes = notesRef.value?.value?.trim() || '';

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

        // Reset form
        completionData.value = { notes: '', file: null };
        if (notesRef.value) notesRef.value.value = '';
        if (completionFileInput.value) completionFileInput.value.value = '';
    }
};

const showDateRangePicker = () => {
    const today = new Date();
    const tenYearsLater = new Date();
    tenYearsLater.setFullYear(today.getFullYear() + 10);
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(today.getFullYear() - 10);

    flatpickr(document.querySelector('input[placeholder="Select date range"]'), {
        mode: "range",
        dateFormat: "Y-m-d",
        maxDate: tenYearsLater,
        minDate: tenYearsAgo,
        onClose: (selectedDates) => {
            if (selectedDates.length === 2) {
                filters.dateRange = `${selectedDates[0].toISOString().slice(0, 10)} to ${selectedDates[1].toISOString().slice(0, 10)}`;
            }
        }
    }).open();
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
        Object.entries(raw).filter(
            ([_, v]) => v !== undefined && v !== null && v !== ""
        )
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
});

watch(filters, fetchTasks, { deep: true });
</script>

<style scoped>
.text-truncate {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.attachment-preview {
    max-width: 48px;
    max-height: 48px;
    border-radius: 6px;
    object-fit: cover;
    border: 1px solid #dee2e6;
    cursor: pointer;
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.attachment-preview:hover {
    transform: scale(1.2);
    z-index: 10;
    position: relative;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
}

.attachment-pdf {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    font-size: 0.75rem;
    color: #0d6efd;
    background-color: #eef6ff;
    border-radius: 6px;
    text-decoration: none;
    border: 1px solid #cce5ff;
    transition: background 0.2s ease-in-out;
}

.attachment-pdf:hover {
    background-color: #d4ebff;
    text-decoration: none;
}

.bg-submitted {
    background-color: #e0e7ff !important;
    color: #1d4ed8 !important;
}
</style>
