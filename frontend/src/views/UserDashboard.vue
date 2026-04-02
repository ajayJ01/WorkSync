<template>
    <div class="container-fluid min-vh-100 d-flex flex-column bg-light dashboard-shell">
        <!-- Sticky Header -->
        <div class="header-sticky d-flex justify-content-between align-items-center p-3 bg-white shadow-sm">
            <div class="d-flex align-items-center">
                <button class="hamburger-menu d-md-none me-3" @click="toggleSidebar">
                    <i class="bi bi-list"></i>
                </button>
                <h4 class="mb-0 text-dark fw-semibold d-flex align-items-center">
                    <img src="/logo.png" alt="WorkSync Logo" class="header-logo" /> WorkSync
                </h4>
            </div>
            <span class="text-dark fw-semibold">👋 Hello, {{ userName }}</span>
        </div>

        <div class="row flex-grow-1">
            <!-- Sidebar -->
            <div ref="sidebar" class="col-md-3 col-lg-2 bg-white p-4 shadow-sm sidebar-sticky">
                <div class="d-flex flex-column h-100">
                    <div>
                        <ul class="nav flex-column gap-2 mt-1">
                            <li class="nav-item">
                                <RouterLink to="/dashboard" class="mt-5 nav-link nav-modern"
                                    active-class="active-modern">
                                    <i class="bi bi-speedometer2 me-2"></i>Dashboard
                                </RouterLink>
                            </li>
                            <li class="nav-item">
                                <RouterLink to="/my-tasks" class="nav-link nav-modern" active-class="active-modern">
                                    <i class="bi bi-list-task me-2"></i>My Tasks
                                </RouterLink>
                            </li>
                        </ul>
                    </div>
                    <div class="mt-auto pt-3 border-top">
                        <button @click="logout"
                            class="btn btn-light border w-100 text-danger fw-semibold d-flex align-items-center justify-content-center gap-2">
                            <i class="bi bi-box-arrow-right"></i> Logout
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main content -->
            <div class="col d-flex flex-column flex-grow-1 main-content">
                <div v-if="isDashboardRoute" class="dashboard-wrap p-3 p-md-4">
                    <div class="dashboard-hero mb-3">
                        <div>
                            <h5 class="mb-1 fw-semibold">My Dashboard Overview</h5>
                            <small class="hero-subtitle">Track your work health in real-time</small>
                        </div>
                        <small class="hero-refresh">Last refresh: {{ lastRefreshLabel }}</small>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-6 col-lg-3" v-for="card in summaryCards" :key="card.label">
                            <div class="metric-card h-100">
                                <div class="metric-label">{{ card.label }}</div>
                                <div class="metric-value">{{ card.value }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-12 col-xl-8">
                            <div class="panel-card h-100">
                                <div class="panel-title mb-2">Focus Insights</div>
                                <div class="row g-2">
                                    <div class="col-6 col-md-3">
                                        <div class="insight-card danger">
                                            <div class="insight-label">Overdue</div>
                                            <div class="insight-value">{{ priorityInsights.overdue }}</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="insight-card warning">
                                            <div class="insight-label">Due Today</div>
                                            <div class="insight-value">{{ priorityInsights.dueToday }}</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="insight-card info">
                                            <div class="insight-label">Next 3 Days</div>
                                            <div class="insight-value">{{ priorityInsights.next3Days }}</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="insight-card success">
                                            <div class="insight-label">Completion %</div>
                                            <div class="insight-value">{{ completionRate }}%</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <div class="d-flex justify-content-between small text-muted mb-1">
                                        <span>My Completion Health</span>
                                        <span>{{ completionRate }}%</span>
                                    </div>
                                    <div class="progress modern-progress">
                                        <div class="progress-bar bg-success" role="progressbar"
                                            :style="{ width: `${completionRate}%` }"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-xl-4">
                            <div class="panel-card h-100">
                                <div class="panel-title mb-2">Quick Actions</div>
                                <div class="d-grid gap-2">
                                    <RouterLink to="/my-tasks" class="btn btn-primary btn-modern">Open My Tasks</RouterLink>
                                </div>
                                <div class="small text-muted mt-3">
                                    Tip: Start pending tasks early and submit work before due date.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row g-3">
                        <div class="col-12 col-xl-7">
                            <div class="panel-card h-100">
                                <div class="panel-title mb-2">My Status Breakdown</div>
                                <div class="row g-2">
                                    <div class="col-6 col-md-4" v-for="item in statusBreakdown" :key="item.key">
                                        <div class="status-chip">
                                            <span>{{ item.label }}</span>
                                            <strong>{{ item.value }}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-xl-5">
                            <div class="panel-card h-100">
                                <div class="panel-title mb-2">My Recent Tasks</div>
                                <div v-if="recentTasks.length === 0" class="text-muted small">No tasks found.</div>
                                <div v-else class="list-group list-group-flush">
                                    <div class="list-group-item px-0 py-2 border-0" v-for="t in recentTasks" :key="t._id">
                                        <div class="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <div class="fw-semibold text-truncate">{{ t.title }}</div>
                                                <div class="text-muted small">{{ formatDueDate(t.dueDate) }}</div>
                                            </div>
                                            <span class="badge rounded-pill" :class="statusBadgeClass(t.status)">{{ t.status }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <router-view v-else class="flex-grow-1" />
            </div>
        </div>

        <!-- Backdrop for mobile sidebar -->
        <div v-if="isSidebarOpen" class="sidebar-backdrop d-md-none" @click="toggleSidebar"></div>
    </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "@/composables/useToast";
import { clearChatStorageForCurrentUser } from "@/utils/chatStorage";
import api from "@/services/api";

const toast = useToast();
const userName = ref("");
const router = useRouter();
const route = useRoute();
const sidebar = ref(null);
const isSidebarOpen = ref(false);
const dashboardStats = ref({
    totalTasks: 0,
    pending: 0,
    in_progress: 0,
    submitted: 0,
    verified: 0,
    rejected: 0,
    cancelled: 0,
    due: 0,
});
const allTasks = ref([]);
const recentTasks = ref([]);
const lastRefreshAt = ref(null);
let refreshTimer = null;
const isDashboardRoute = computed(() => route.path === "/dashboard");

const summaryCards = computed(() => [
    { label: "Total Tasks", value: dashboardStats.value.totalTasks },
    { label: "Pending", value: dashboardStats.value.pending },
    { label: "In Progress", value: dashboardStats.value.in_progress },
    { label: "Due/Expired", value: dashboardStats.value.due },
]);

const completionRate = computed(() => {
    const total = dashboardStats.value.totalTasks || 0;
    if (!total) return 0;
    const done = (dashboardStats.value.verified || 0) + (dashboardStats.value.cancelled || 0);
    return Math.round((done / total) * 100);
});

const priorityInsights = computed(() => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    const next3 = new Date(endToday);
    next3.setDate(next3.getDate() + 3);

    const activeStatuses = new Set(["pending", "in_progress", "submitted", "due"]);
    let overdue = 0;
    let dueToday = 0;
    let next3Days = 0;

    allTasks.value.forEach((t) => {
        if (!activeStatuses.has(t?.status)) return;
        const d = t?.dueDate ? new Date(t.dueDate) : null;
        if (!d || isNaN(d.getTime())) return;
        if (d < startToday) overdue += 1;
        if (d >= startToday && d <= endToday) dueToday += 1;
        if (d > endToday && d <= next3) next3Days += 1;
    });

    return { overdue, dueToday, next3Days };
});

const statusBreakdown = computed(() => [
    { key: "pending", label: "Pending", value: dashboardStats.value.pending },
    { key: "in_progress", label: "In Progress", value: dashboardStats.value.in_progress },
    { key: "submitted", label: "Submitted", value: dashboardStats.value.submitted },
    { key: "verified", label: "Verified", value: dashboardStats.value.verified },
    { key: "rejected", label: "Rejected", value: dashboardStats.value.rejected },
    { key: "cancelled", label: "Cancelled", value: dashboardStats.value.cancelled },
    { key: "due", label: "Due", value: dashboardStats.value.due },
]);

const lastRefreshLabel = computed(() =>
    lastRefreshAt.value ? new Date(lastRefreshAt.value).toLocaleTimeString() : "-"
);

const formatDueDate = (date) => {
    if (!date) return "No due date";
    return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const statusBadgeClass = (status) => {
    if (status === "pending") return "text-bg-warning";
    if (status === "in_progress") return "text-bg-primary";
    if (status === "submitted") return "text-bg-info";
    if (status === "verified") return "text-bg-success";
    if (status === "rejected") return "text-bg-danger";
    if (status === "cancelled") return "text-bg-secondary";
    if (status === "due") return "text-bg-dark";
    return "text-bg-light";
};

const fetchDashboardData = async () => {
    if (!isDashboardRoute.value) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
        const res = await api.get("/my-tasks", {
            params: { page: 1, limit: 200 },
            headers: { Authorization: `Bearer ${token}` },
        });
        const tasks = res?.data?.data?.tasks || [];
        const stats = {
            totalTasks: tasks.length,
            pending: 0,
            in_progress: 0,
            submitted: 0,
            verified: 0,
            rejected: 0,
            cancelled: 0,
            due: 0,
        };
        tasks.forEach((t) => {
            const s = t?.status;
            if (s && stats[s] != null) stats[s] += 1;
        });
        dashboardStats.value = stats;
        allTasks.value = tasks;
        recentTasks.value = [...tasks]
            .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
            .slice(0, 6);
        lastRefreshAt.value = Date.now();
    } catch (err) {
        console.error("User dashboard fetch error:", err);
    }
};

const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
    if (isSidebarOpen.value) {
        sidebar.value.classList.add("active");
    } else {
        sidebar.value.classList.remove("active");
    }
};

onMounted(() => {
    const loggedIn = localStorage.getItem("loggedInSuccessMsg");
    const name = localStorage.getItem("userName");
    if (name) userName.value = name;

    if (loggedIn) {
        toast.success(loggedIn);
        localStorage.removeItem("loggedInSuccessMsg");
    }
    fetchDashboardData();
    refreshTimer = setInterval(() => {
        if (!document.hidden) fetchDashboardData();
    }, 15000);
    window.addEventListener("tasks:changed", fetchDashboardData);
});

onUnmounted(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    window.removeEventListener("tasks:changed", fetchDashboardData);
});

const logout = async () => {
    try {
        const token = localStorage.getItem("token");
        
        await api.post("/logout", {}, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    } catch (err) {
        console.error("Logout API error:", err);
    } finally {
        clearChatStorageForCurrentUser();
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("userName");
        localStorage.setItem("logout", "Logged Out Successfully");
        router.push("/login");
    }
};
</script>

<style scoped>
.header-sticky {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 12px 18px;
    border-bottom: 1px solid rgba(14, 116, 144, 0.12);
    box-shadow: 0 10px 30px rgba(2, 132, 199, 0.08);
}

.header-logo {
    width: 35px;
    height: 35px;
    margin-right: 8px;
    object-fit: contain;
    border-radius: 50%;
    background-color: #f1f5f9;
    padding: 2px;
}

@media (max-width: 767px) {
    .header-logo {
        width: 24px;
        height: 24px;
        margin-right: 6px;
    }
}

.hamburger-menu {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #333;
    cursor: pointer;
    padding: 0;
}

.hamburger-menu:focus {
    outline: none;
}

.sidebar-sticky {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    height: 100vh;
    z-index: 900;
    transition: transform 0.3s ease;
    border-right: 1px solid #e7edf6;
    background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
}

.main-content {
    margin-top: 60px;
    margin-left: 0;
    background: transparent;
}

@media (min-width: 768px) {
    .sidebar-sticky {
        width: 25%;
        transform: translateX(0);
    }

    .main-content {
        margin-left: 25%;
    }
}

@media (min-width: 992px) {
    .sidebar-sticky {
        width: 16.67%;
    }

    .main-content {
        margin-left: 16.67%;
    }
}

.sidebar-sticky .d-flex {
    min-height: 100%;
}

.sidebar-sticky {
    border-radius: 0;
    background-color: #fff;
}

.nav-modern {
    display: flex;
    align-items: center;
    padding: 11px 14px;
    border-radius: 12px;
    color: #1f2937;
    font-weight: 600;
    transition: background 0.25s ease, color 0.25s ease, transform 0.2s ease;
    border: 1px solid transparent;
}

.nav-modern:hover {
    background: linear-gradient(90deg, #eef7ff 0%, #e8f5ff 100%);
    color: #0b6dd8;
    border-color: #dbeafe;
    transform: translateX(2px);
}

.active-modern {
    background: linear-gradient(90deg, #e2f2ff 0%, #d8efff 100%);
    color: #0b6dd8 !important;
    font-weight: 600;
    border: 1px solid #bfdbfe;
    box-shadow: 0 8px 22px rgba(14, 116, 144, 0.14);
}

@media (max-width: 767px) {
    .sidebar-sticky {
        width: 200px;
        transform: translateX(-100%);
    }

    .sidebar-sticky.active {
        transform: translateX(0);
    }

    .main-content {
        margin-left: 0;
        margin-top: 60px;
    }
}

.sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 800;
}

.metric-card {
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    border: 1px solid #e7edf6;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.09);
}

.metric-label {
    color: #667085;
    font-size: 0.85rem;
    letter-spacing: 0.2px;
}

.metric-value {
    font-weight: 700;
    font-size: 1.55rem;
    color: #0f172a;
}

.panel-card {
    background: #ffffff;
    border: 1px solid #e7edf6;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}

.panel-title {
    font-weight: 700;
    color: #0f172a;
    font-size: 1rem;
}

.status-chip {
    border: 1px solid #e6edf7;
    border-radius: 12px;
    padding: 8px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fbff;
    color: #334155;
}

.status-chip strong {
    color: #0f172a;
}

.insight-card {
    border-radius: 12px;
    padding: 10px 12px;
    border: 1px solid #e8edf5;
    background: #f8fbff;
}

.insight-label {
    font-size: 0.78rem;
    color: #64748b;
}

.insight-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: #0f172a;
}

.insight-card.danger {
    background: #fff1f2;
    border-color: #ffd9de;
}

.insight-card.warning {
    background: #fff8eb;
    border-color: #ffe7b8;
}

.insight-card.info {
    background: #eff8ff;
    border-color: #d9ecff;
}

.insight-card.success {
    background: #ecfdf3;
    border-color: #c9f2db;
}

.modern-progress {
    height: 8px;
    border-radius: 999px;
    background: #e8eef6;
}

.btn-modern {
    border-radius: 10px;
    font-weight: 600;
}

.dashboard-wrap {
    background:
        radial-gradient(1200px 300px at 10% -20%, rgba(59, 130, 246, 0.12), transparent),
        radial-gradient(1200px 260px at 90% -25%, rgba(14, 165, 233, 0.1), transparent);
    min-height: calc(100vh - 80px);
    padding-bottom: 18px;
}

.dashboard-hero {
    border: 1px solid #e6edf7;
    border-radius: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #f2f8ff 100%);
    box-shadow: 0 12px 30px rgba(2, 132, 199, 0.12);
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.hero-subtitle {
    color: #64748b;
}

.hero-refresh {
    color: #64748b;
    font-size: 0.82rem;
    font-weight: 600;
}

:deep(.list-group-item) {
    border-bottom: 1px dashed #e5e7eb !important;
}

:deep(.list-group-item:last-child) {
    border-bottom: none !important;
}

@media (max-width: 767px) {
    .dashboard-hero {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }
}

.dashboard-shell {
    background:
        linear-gradient(180deg, #f7fbff 0%, #f8fafc 42%, #f8fbff 100%);
}

.btn.btn-light.border.w-100.text-danger {
    border-radius: 12px !important;
    border-color: #f3d5d5 !important;
    background: #fff5f5 !important;
    transition: all 0.2s ease;
}

.btn.btn-light.border.w-100.text-danger:hover {
    background: #ffe7e7 !important;
    transform: translateY(-1px);
}
</style>
