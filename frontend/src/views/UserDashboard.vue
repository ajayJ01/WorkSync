<template>
    <div class="container-fluid min-vh-100 d-flex flex-column bg-light">
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
                <router-view class="flex-grow-1" />
            </div>
        </div>

        <!-- Backdrop for mobile sidebar -->
        <div v-if="isSidebarOpen" class="sidebar-backdrop d-md-none" @click="toggleSidebar"></div>
    </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { ref, onMounted } from "vue";
import { useToast } from "@/composables/useToast";
import { clearChatStorageForCurrentUser } from "@/utils/chatStorage";

const toast = useToast();
const userName = ref("");
const router = useRouter();
const sidebar = ref(null);
const isSidebarOpen = ref(false);

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
});

const logout = async () => {
    try {
        const token = localStorage.getItem("token");
        
        await axios.post("/logout", {}, {
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
    background-color: #fff;
    padding: 10px 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
}

.main-content {
    margin-top: 60px;
    margin-left: 0;
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
    padding: 10px 14px;
    border-radius: 8px;
    color: #333;
    font-weight: 500;
    transition: background 0.3s ease, color 0.3s ease;
}

.nav-modern:hover {
    background-color: #f1f5f9;
    color: #0d6efd;
}

.active-modern {
    background-color: #e0f0ff;
    color: #0d6efd !important;
    font-weight: 600;
    border-left: 4px solid #0d6efd;
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
</style>
