<template>
  <div class="container-fluid min-vh-100 d-flex flex-column ws-app-shell">
    <div class="ws-header d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center gap-2">
        <button class="hamburger-menu d-md-none btn btn-link text-decoration-none p-1" type="button" @click="toggleSidebar">
          <i class="bi bi-list fs-4"></i>
        </button>
        <div class="ws-header-brand">
          <div class="ws-header-logo-wrap">
            <img src="/logo.png" alt="" class="header-logo" width="26" height="26" />
          </div>
          <h1 class="ws-header-title">WorkSync</h1>
        </div>
      </div>
      <div class="ws-header-user">
        <span class="ws-user-avatar" aria-hidden="true">{{ userInitials }}</span>
        <div class="ws-user-text">
          <span class="ws-user-hi">Hello</span>
          <span class="ws-user-name">{{ userName || 'Member' }}</span>
        </div>
      </div>
    </div>

    <div class="row flex-grow-1">
      <div ref="sidebar" class="col-md-3 col-lg-2 p-3 p-md-4 sidebar-sticky">
        <div class="d-flex flex-column h-100">
          <div>
            <p class="ws-sidebar-label">Navigate</p>
            <ul class="nav flex-column gap-1 mt-0">
              <li class="nav-item">
                <RouterLink to="/dashboard" class="nav-link nav-modern" active-class="active-modern">
                  <i class="bi bi-speedometer2 me-2"></i>Dashboard
                </RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink to="/my-tasks" class="nav-link nav-modern" active-class="active-modern">
                  <i class="bi bi-list-task me-2"></i>My tasks
                </RouterLink>
              </li>
            </ul>
          </div>
          <div class="mt-auto pt-3 border-top">
            <button
              type="button"
              class="btn w-100 d-flex align-items-center justify-content-center gap-2 ws-logout-btn"
              @click="logout"
            >
              <i class="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </div>
      </div>

      <div class="col d-flex flex-column flex-grow-1 main-content">
        <div v-if="isDashboardRoute" class="dashboard-wrap p-3 p-md-4">
          <div class="ws-hero mb-3 mb-md-4">
            <div>
              <p class="ws-hero-kicker">Overview</p>
              <h2 class="ws-hero-title">My dashboard</h2>
              <p class="ws-hero-sub">Track your work health in real time</p>
            </div>
            <div class="ws-hero-meta">
              <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
              <span>Last refresh: {{ lastRefreshLabel }}</span>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6 col-lg-3" v-for="card in summaryCards" :key="card.label">
              <div class="ws-metric">
                <div class="ws-metric-top">
                  <span
                    class="ws-metric-icon"
                    :class="{
                      'ws-metric-icon--violet': card.tone === 'violet',
                      'ws-metric-icon--amber': card.tone === 'amber',
                      'ws-metric-icon--rose': card.tone === 'rose',
                      'ws-metric-icon--teal': card.tone === 'teal',
                    }"
                  >
                    <i :class="['bi', card.icon]" aria-hidden="true"></i>
                  </span>
                  <span class="ws-metric-label">{{ card.label }}</span>
                </div>
                <div class="ws-metric-value">{{ card.value }}</div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-12 col-xl-8">
              <div class="ws-panel h-100">
                <h3 class="ws-panel-title">Focus insights</h3>
                <div class="row g-2">
                  <div class="col-6 col-md-3">
                    <div class="ws-insight ws-insight--danger">
                      <div class="ws-insight-head">
                        <span class="ws-insight-label">Overdue</span>
                        <i class="bi bi-exclamation-octagon" aria-hidden="true"></i>
                      </div>
                      <div class="ws-insight-value">{{ priorityInsights.overdue }}</div>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="ws-insight ws-insight--warning">
                      <div class="ws-insight-head">
                        <span class="ws-insight-label">Due today</span>
                        <i class="bi bi-sun" aria-hidden="true"></i>
                      </div>
                      <div class="ws-insight-value">{{ priorityInsights.dueToday }}</div>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="ws-insight ws-insight--info">
                      <div class="ws-insight-head">
                        <span class="ws-insight-label">Next 3 days</span>
                        <i class="bi bi-calendar3" aria-hidden="true"></i>
                      </div>
                      <div class="ws-insight-value">{{ priorityInsights.next3Days }}</div>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="ws-insight ws-insight--success">
                      <div class="ws-insight-head">
                        <span class="ws-insight-label">Completion</span>
                        <i class="bi bi-patch-check" aria-hidden="true"></i>
                      </div>
                      <div class="ws-insight-value">{{ completionRate }}%</div>
                    </div>
                  </div>
                </div>
                <div class="mt-3 pt-1">
                  <div class="ws-progress-labels">
                    <span>My completion health</span>
                    <span>{{ completionRate }}%</span>
                  </div>
                  <div class="ws-progress-track" role="progressbar" :aria-valuenow="completionRate" aria-valuemin="0" aria-valuemax="100">
                    <div class="ws-progress-fill" :style="{ width: `${completionRate}%` }"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-12 col-xl-4">
              <div class="ws-panel h-100">
                <h3 class="ws-panel-title">Quick actions</h3>
                <div class="d-grid gap-2">
                  <RouterLink to="/my-tasks" class="ws-btn-gradient w-100 text-center">
                    <i class="bi bi-list-check" aria-hidden="true"></i>
                    Open my tasks
                  </RouterLink>
                </div>
                <p class="ws-tip mb-0">
                  Tip: start pending tasks early and submit work before the due date.
                </p>
              </div>
            </div>
          </div>

          <div class="row g-3">
            <div class="col-12 col-xl-7">
              <div class="ws-panel h-100">
                <h3 class="ws-panel-title">My status breakdown</h3>
                <div class="row g-2">
                  <div class="col-6 col-md-4" v-for="item in statusBreakdown" :key="item.key">
                    <div class="ws-status-chip">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-12 col-xl-5">
              <div class="ws-panel h-100">
                <h3 class="ws-panel-title">My recent tasks</h3>
                <div v-if="recentTasks.length === 0" class="text-muted small">No tasks found.</div>
                <div v-else class="ws-task-list">
                  <div class="ws-task-item" v-for="t in recentTasks" :key="t._id">
                    <div class="min-w-0 flex-grow-1">
                      <div class="ws-task-title">{{ t.title }}</div>
                      <div class="ws-task-meta">{{ formatDueDate(t.dueDate) }}</div>
                    </div>
                    <span class="ws-badge" :class="statusBadgeClass(t.status)">{{ formatStatusLabel(t.status) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <router-view v-else class="flex-grow-1" />
      </div>
    </div>

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

const userInitials = computed(() => {
    const n = userName.value?.trim() || "?";
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
});

const summaryCards = computed(() => [
    { label: "Total tasks", value: dashboardStats.value.totalTasks, icon: "bi-kanban", tone: "default" },
    { label: "Pending", value: dashboardStats.value.pending, icon: "bi-hourglass-split", tone: "amber" },
    { label: "In progress", value: dashboardStats.value.in_progress, icon: "bi-lightning-charge", tone: "violet" },
    { label: "Due / expired", value: dashboardStats.value.due, icon: "bi-calendar2-event", tone: "rose" },
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
    { key: "in_progress", label: "In progress", value: dashboardStats.value.in_progress },
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

const formatStatusLabel = (status) => {
    if (status === "in_progress") return "In progress";
    return status?.replace(/_/g, " ") || "";
};

const statusBadgeClass = (status) => {
    const map = {
        pending: "ws-badge--pending",
        in_progress: "ws-badge--in_progress",
        submitted: "ws-badge--submitted",
        verified: "ws-badge--verified",
        rejected: "ws-badge--rejected",
        cancelled: "ws-badge--cancelled",
        due: "ws-badge--due",
    };
    return map[status] || "ws-badge--cancelled";
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
