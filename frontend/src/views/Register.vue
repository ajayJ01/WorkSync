<template>
  <div class="d-flex flex-column flex-grow-1 w-100 min-w-0">
    <div class="task-list-page px-2 px-md-3 py-3 flex-grow-1 w-100">
      <div class="ws-panel task-list-panel ws-register-panel">
        <div class="ws-hero ws-register-hero">
          <div class="d-flex align-items-start gap-3 flex-wrap">
            <div class="ws-register-avatar-ring" aria-hidden="true">
              <div class="ws-register-avatar-inner">
                <i class="bi bi-person-plus"></i>
              </div>
            </div>
            <div class="min-w-0 flex-grow-1">
              <p class="ws-hero-kicker">Team</p>
              <h2 class="ws-hero-title">Create user</h2>
              <p class="ws-hero-sub">
                Register someone with a role so they can sign in and work on tasks in WorkSync.
              </p>
            </div>
          </div>
        </div>

        <form class="ws-register-form" @submit.prevent="handleRegister">
          <div class="form-floating mb-3">
            <input
              id="floatingName"
              v-model="name"
              type="text"
              class="form-control"
              placeholder="John Doe"
              autocomplete="name"
              required
            />
            <label for="floatingName">Full name</label>
          </div>

          <div class="form-floating mb-3">
            <input
              id="floatingEmail"
              v-model="email"
              type="email"
              class="form-control"
              placeholder="name@example.com"
              autocomplete="email"
              required
            />
            <label for="floatingEmail">Email address</label>
          </div>

          <div class="form-floating mb-3">
            <input
              id="floatingPassword"
              v-model="password"
              type="password"
              class="form-control"
              placeholder="Password"
              autocomplete="new-password"
              required
            />
            <label for="floatingPassword">Password</label>
          </div>

          <div class="form-floating mb-4">
            <select id="floatingRole" v-model="role" class="form-select" required>
              <option disabled value="">Select a role</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <label for="floatingRole">Role</label>
          </div>

          <button type="submit" class="ws-btn-gradient ws-register-submit w-100">
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            Register user
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance } from "vue";
import { request } from "@/services/apiWrapper";

const { appContext } = getCurrentInstance();
const toast = appContext.config.globalProperties.$toast;

const name = ref("");
const email = ref("");
const password = ref("");
const role = ref("");

const handleRegister = async () => {
  try {
    const [data, error] = await request("post", "/register", {
      name: name.value,
      email: email.value,
      password: password.value,
      role: role.value,
    });

    if (error) {
      if (Object.keys(error.errors).length > 0) {
        for (const [field, msg] of Object.entries(error.errors)) {
          toast.error(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${msg}`);
        }
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(data.message || "Registered successfully!");
      name.value = "";
      email.value = "";
      password.value = "";
      role.value = "";
    }
  } catch (_err) {
    toast.error("Unexpected error occurred. Please try again later.");
  }
};
</script>
