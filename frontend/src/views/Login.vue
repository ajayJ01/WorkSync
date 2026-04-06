<template>
  <div class="login-page">
    <div class="login-atmosphere" aria-hidden="true">
      <div class="login-mesh" />
      <div class="orb orb--a" />
      <div class="orb orb--b" />
      <div class="orb orb--c" />
      <div class="login-grain" />
    </div>

    <div class="login-frame">
      <aside class="login-showcase">
        <div class="showcase-glow" aria-hidden="true" />
        <div class="showcase-inner">
          <div class="showcase-brand">
            <div class="brand-badge">
              <img src="/logo.png" alt="" class="brand-badge-img" width="34" height="34" />
            </div>
            <span class="brand-title">WorkSync</span>
          </div>
          <p class="showcase-kicker">Team tasks, one calm place.</p>
          <h2 class="showcase-headline">
            Work in sync.<br />
            <span class="showcase-headline-accent">Ship with clarity.</span>
          </h2>
          <p class="showcase-copy">
            A softer dashboard for planning, ownership, and follow-through — built so your eyes stay rested
            and your team stays aligned.
          </p>
          <ul class="showcase-pills" aria-hidden="true">
            <li>Tasks</li>
            <li>Chat</li>
            <li>Insights</li>
          </ul>
        </div>
      </aside>

      <div class="login-surface">
        <div class="login-card">
          <header class="card-head">
            <p class="card-eyebrow">Sign in</p>
            <h1 class="card-title">Welcome back</h1>
            <p class="card-sub">Use your work email to open the dashboard.</p>
          </header>

          <form class="login-form" @submit.prevent="handleLogin" novalidate>
            <div class="field">
              <label class="field-label" for="floatingEmail">Email</label>
              <div class="input-shell">
                <i class="bi bi-envelope input-ico" aria-hidden="true" />
                <input
                  id="floatingEmail"
                  v-model="email"
                  type="email"
                  class="input input--pad-left"
                  placeholder="name@company.com"
                  autocomplete="email"
                  required
                />
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="floatingPassword">Password</label>
              <div class="input-shell">
                <i class="bi bi-lock input-ico" aria-hidden="true" />
                <input
                  id="floatingPassword"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="input input--pad-left input--pad-right"
                  placeholder="Enter password"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  class="peek"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'" aria-hidden="true" />
                </button>
              </div>
            </div>

            <button type="submit" class="btn-primary">
              <span>Continue</span>
              <i class="bi bi-arrow-right btn-ico" aria-hidden="true" />
            </button>
          </form>

          <p class="card-foot">Encrypted session · Quick restore</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance, onMounted, onUnmounted } from 'vue'
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
  document.documentElement.classList.add('login-view-open')
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

  const { reason: _ignore, ...restQuery } = route.query
  router.replace({ path: route.path, query: restQuery })

  document.body.classList.remove('modal-open', 'overflow-hidden')
  document.querySelector('.modal-backdrop')?.remove()
  document.querySelector('.fade.show')?.remove()
})

onUnmounted(() => {
  document.documentElement.classList.remove('login-view-open')
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

<style>
html.login-view-open {
  overflow-x: hidden;
}

html.login-view-open body {
  overflow-x: hidden;
  margin: 0;
}
</style>

<style scoped>
.login-page {
  --ink: #0c1222;
  --ink-soft: #3d4d6b;
  --muted: #5c6b86;
  --line: rgba(12, 18, 34, 0.09);
  --surface: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.78);
  --tint: #f4f6fb;
  --accent: #4f6cf8;
  --accent-2: #7c5cff;
  --accent-soft: rgba(79, 108, 248, 0.14);
  --showcase-bg: #0a0f1c;
  --showcase-fg: #e8edf7;
  --showcase-muted: rgba(232, 237, 247, 0.72);
  --radius-frame: clamp(20px, 4vw, 28px);
  --radius-input: 12px;
  --font: 'DM Sans', system-ui, -apple-system, sans-serif;
  --font-display: 'Outfit', var(--font);

  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: clamp(0.75rem, 2.5vw, 1.25rem);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font);
  color: var(--ink);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  box-sizing: border-box;
}

.login-page *,
.login-page *::before,
.login-page *::after {
  box-sizing: border-box;
}

/* —— Atmosphere (contained, no horizontal scroll) —— */
.login-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(168deg, #eef1f9 0%, #e8ecf6 42%, #f2f0fb 100%);
}

.login-mesh {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background:
    radial-gradient(ellipse 90% 70% at 10% 20%, rgba(124, 92, 255, 0.09), transparent 50%),
    radial-gradient(ellipse 70% 60% at 90% 10%, rgba(79, 108, 248, 0.11), transparent 45%),
    radial-gradient(ellipse 60% 50% at 70% 85%, rgba(56, 189, 248, 0.08), transparent 40%);
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(64px);
  will-change: transform;
}

.orb--a {
  width: min(420px, 90vw);
  height: min(420px, 90vw);
  left: -8%;
  top: -12%;
  background: rgba(124, 92, 255, 0.22);
}

.orb--b {
  width: min(360px, 75vw);
  height: min(360px, 75vw);
  right: -6%;
  bottom: -8%;
  background: rgba(79, 108, 248, 0.2);
}

.orb--c {
  width: min(280px, 60vw);
  height: min(280px, 60vw);
  left: 35%;
  bottom: 15%;
  background: rgba(56, 189, 248, 0.12);
}

@media (prefers-reduced-motion: no-preference) {
  .orb--a {
    animation: orb-drift-a 22s ease-in-out infinite;
  }
  .orb--b {
    animation: orb-drift-b 26s ease-in-out infinite;
  }
  .orb--c {
    animation: orb-drift-c 18s ease-in-out infinite;
  }
}

@keyframes orb-drift-a {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(3%, 4%) scale(1.05);
  }
}

@keyframes orb-drift-b {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-4%, -3%) scale(1.06);
  }
}

@keyframes orb-drift-c {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-2%, 3%);
  }
}

.login-grain {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  pointer-events: none;
}

/* —— Frame —— */
.login-frame {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 920px;
  display: grid;
  grid-template-columns: 1fr;
  border-radius: var(--radius-frame);
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.65) inset,
    0 32px 64px -16px rgba(15, 23, 42, 0.14),
    0 12px 28px -8px rgba(15, 23, 42, 0.08);
}

@media (min-width: 900px) {
  .login-frame {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    min-height: min(540px, calc(100dvh - 2.5rem));
  }
}

/* —— Left showcase —— */
.login-showcase {
  position: relative;
  background: linear-gradient(155deg, #0d1528 0%, #121c38 48%, #1a1f4a 100%);
  color: var(--showcase-fg);
  padding: clamp(1.75rem, 4vw, 2.75rem);
  display: flex;
  align-items: center;
  min-height: 200px;
  overflow: hidden;
}

.showcase-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 30%, rgba(124, 92, 255, 0.35), transparent 55%),
    radial-gradient(ellipse 60% 50% at 85% 70%, rgba(56, 189, 248, 0.18), transparent 50%);
  opacity: 0.9;
  pointer-events: none;
}

.showcase-inner {
  position: relative;
  z-index: 1;
  max-width: 22rem;
}

.showcase-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1.25rem;
}

.brand-badge {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.brand-badge-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.brand-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.35rem;
  letter-spacing: -0.03em;
}

.showcase-kicker {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(196, 210, 255, 0.85);
}

.showcase-headline {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.65rem, 3.2vw, 2.125rem);
  line-height: 1.15;
  letter-spacing: -0.035em;
  margin: 0 0 1rem;
}

.showcase-headline-accent {
  background: linear-gradient(105deg, #a5b4fc 0%, #7dd3fc 45%, #c4b5fd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.showcase-copy {
  margin: 0 0 1.35rem;
  font-size: 1.02rem;
  line-height: 1.65;
  color: var(--showcase-muted);
  max-width: 20rem;
}

.showcase-pills {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.showcase-pills li {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(232, 237, 247, 0.88);
}

/* —— Form surface —— */
.login-surface {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 255, 0.96) 100%);
}

@supports (backdrop-filter: blur(12px)) {
  .login-surface {
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(248, 250, 255, 0.88) 100%);
  }
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.card-head {
  margin-bottom: 1.65rem;
}

.card-eyebrow {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.card-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.625rem;
  letter-spacing: -0.035em;
  line-height: 1.2;
  margin: 0 0 0.45rem;
  color: var(--ink);
}

.card-sub {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.55;
  color: var(--muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-soft);
}

.input-shell {
  position: relative;
}

.input-ico {
  position: absolute;
  left: 0.95rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.05rem;
  color: var(--muted);
  pointer-events: none;
  z-index: 1;
  transition: color 0.2s ease;
}

.input {
  width: 100%;
  max-width: 100%;
  font-size: 1.0625rem;
  line-height: 1.45;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-input);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.input--pad-left {
  padding-left: 2.65rem;
}

.input--pad-right {
  padding-right: 2.75rem;
}

.input::placeholder {
  color: #94a3b8;
}

.input:hover {
  border-color: rgba(79, 108, 248, 0.25);
  background: #fff;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
  background: #fff;
}

.field:focus-within .input-ico {
  color: var(--accent);
}

.peek {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 2.4rem;
  height: 2.4rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.peek:hover {
  color: var(--ink);
  background: var(--tint);
}

.btn-primary {
  margin-top: 0.4rem;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: var(--radius-input);
  padding: 0.9rem 1.15rem;
  font-size: 1.02rem;
  font-weight: 600;
  font-family: var(--font);
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  box-shadow:
    0 4px 16px rgba(79, 108, 248, 0.35),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.btn-primary:hover {
  filter: brightness(1.05);
  box-shadow:
    0 8px 28px rgba(79, 108, 248, 0.42),
    0 1px 0 rgba(255, 255, 255, 0.22) inset;
}

.btn-primary:active {
  transform: translateY(1px);
}

.btn-ico {
  font-size: 1.1rem;
  opacity: 0.95;
}

.btn-primary:focus-visible {
  outline: 2px solid var(--accent-2);
  outline-offset: 3px;
}

.card-foot {
  margin: 1.35rem 0 0;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

@media (prefers-reduced-motion: reduce) {
  .orb--a,
  .orb--b,
  .orb--c {
    animation: none;
  }

  .btn-primary:active {
    transform: none;
  }
}

@media (max-width: 899.98px) {
  .login-showcase {
    min-height: auto;
    padding-bottom: 1.5rem;
  }

  .showcase-copy {
    font-size: 0.98rem;
    line-height: 1.6;
  }
}
</style>
