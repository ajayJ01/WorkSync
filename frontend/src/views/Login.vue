<template>
  <div class="login-page min-vh-100 d-flex align-items-center justify-content-center px-3">
    <div class="login-shell row g-0 overflow-hidden">
      <div class="col-lg-5 d-none d-lg-flex login-aside">
        <div class="aside-content">
          <img src="/logo.png" alt="WorkSync Logo" class="aside-logo mb-3" />
          <h3 class="fw-bold mb-2">WorkSync</h3>
          <p class="mb-0">
            Plan better, track faster, and deliver on time with a modern task workflow.
          </p>
        </div>
      </div>

      <div class="col-12 col-lg-7 bg-white">
        <div class="p-4 p-md-5">
          <div class="text-center text-lg-start mb-4">
            <h2 class="mb-1 fw-bold text-dark">Welcome back</h2>
            <p class="text-muted mb-0">Sign in to continue to your dashboard.</p>
          </div>

          <form @submit.prevent="handleLogin">
            <div class="mb-3">
              <label for="floatingEmail" class="form-label fw-semibold text-muted">Email address</label>
              <input
                v-model="email"
                type="email"
                class="form-control form-control-lg modern-input"
                id="floatingEmail"
                placeholder="name@example.com"
                required
              />
            </div>

            <div class="mb-3">
              <label for="floatingPassword" class="form-label fw-semibold text-muted">Password</label>
              <div class="password-wrap">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-control form-control-lg modern-input pe-5"
                  id="floatingPassword"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary w-100 py-2 mt-2 modern-btn">
              <i class="bi bi-box-arrow-in-right me-2"></i>Login
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { request } from '@/services/apiWrapper'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const router = useRouter()
const route = useRoute()

const { appContext } = getCurrentInstance()
const toast = appContext.config.globalProperties.$toast

onMounted(() => {
  const logout = localStorage.getItem('logout')
  if (logout) {
    toast.success(logout)
    localStorage.removeItem('logout')
  }

  const reason = route.query.reason

  if (reason === 'expired') {
    toast.error('Session expired. Please log in again.')
  } else if (reason === 'invalid') {
    toast.error('Invalid session. Please log in again.')
  } else if (reason === 'no_token') {
    toast.error('You must be logged in to access that page.')
  }

  // ✅ Remove `reason` from query params
  const { reason: _ignore, ...restQuery } = route.query
  router.replace({ path: route.path, query: restQuery })

  document.body.classList.remove('modal-open', 'overflow-hidden')
  document.querySelector('.modal-backdrop')?.remove()
  document.querySelector('.fade.show')?.remove()

})


const handleLogin = async () => {
  try {
    const [data, error] = await request('post', '/login', {
      email: email.value,
      password: password.value,
    })

    if (error) {
      if (error.errors && Object.keys(error.errors).length > 0) {
        for (const [field, msg] of Object.entries(error.errors)) {
          toast.error(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${msg}`)
        }
      } else {
        toast.error(error.message)
      }
    } else {
      localStorage.setItem('token', data.data.token)
      localStorage.setItem('userName', data.data.name)
      localStorage.setItem('loggedInSuccessMsg', data.message)
      localStorage.setItem('role', data.data.role)
      router.push('/dashboard')
    }
  } catch (_err) {
    toast.error('Unexpected error occurred. Please try again later.')
  }
}
</script>

<style scoped>
.login-page {
  background:
    radial-gradient(900px 320px at 15% -10%, rgba(37, 99, 235, 0.2), transparent),
    radial-gradient(900px 320px at 85% 110%, rgba(14, 165, 233, 0.18), transparent),
    #f8fbff;
}

.login-shell {
  width: 100%;
  max-width: 980px;
  border-radius: 24px;
  border: 1px solid #e5edf8;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
  background: #fff;
}

.login-aside {
  min-height: 560px;
  background: linear-gradient(160deg, #0f4fda 0%, #0ea5e9 100%);
  color: #fff;
  position: relative;
}

.login-aside::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(380px 180px at 20% 20%, rgba(255, 255, 255, 0.22), transparent);
}

.aside-content {
  position: relative;
  z-index: 1;
  padding: 48px 36px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.aside-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.2);
  padding: 8px;
}

.modern-input {
  border-radius: 12px;
  border: 1px solid #dbe7f7;
  background: #f9fbff;
}

.modern-input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.15);
  background: #fff;
}

.modern-btn {
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.25);
}

.password-wrap {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 1.05rem;
}

.password-toggle:hover {
  color: #0f172a;
}
</style>