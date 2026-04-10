import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'
import { jwtDecode } from 'jwt-decode'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import UserDashboard from '../views/UserDashboard.vue'
import TaskList from '../views/TaskList.vue'
import MyTasks from '../views/MyTasks.vue'
import { clearChatStorageForCurrentUser } from '../utils/chatStorage'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login , meta: { hideChatbot: true } },
  
  {
    path: '/dashboard',
    meta: { requiresAuth: true },
    component: {
      render() {
        const role = localStorage.getItem('role')
        return h(role === 'admin' ? AdminDashboard : UserDashboard)
      },
    },
  },
  {
    path: '/tasks',
    component: AdminDashboard,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [{ path: '', component: TaskList }],
  },
  {
    path: '/my-tasks',
    component: UserDashboard,
    meta: { requiresAuth: true },
    children: [{ path: '', component: MyTasks }],
  },
  {
    path: '/user/create',
    component: AdminDashboard,
    meta: { requiresAuth: true, requiresAdmin: true, meta: { hideChatbot: true } },
    children: [
      {
        path: '',
        component: Register,
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory('/WorkSync/'),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  if (!to.meta.requiresAuth) {
    return next()
  }

  if (!token) {
    return next({ path: '/login', query: { reason: 'no_token' } })
  }

  try {
    const decoded = jwtDecode(token)
    const currentTime = Date.now() / 1000

    if (decoded.exp < currentTime) {
      // Token expired
      clearChatStorageForCurrentUser()
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      return next({ path: '/login', query: { reason: 'expired' } })
    }
  } catch (_error) {
    // Token invalid
    clearChatStorageForCurrentUser()
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    return next({ path: '/login', query: { reason: 'invalid' } })
  }

  // Admin route access control
  if (to.meta.requiresAdmin && role !== 'admin') {
    return next('/dashboard')
  }

  next()
})

export default router
