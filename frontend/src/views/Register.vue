<template>
  <div class="container-fluid min-vh-100 d-flex justify-content-center align-items-start pt-4 bg-light m-0">
 
    <div class="card shadow-lg rounded-4 border-0">
      <div class="text-center mb-4">
        <i class="bi bi-person-plus-fill fs-2 text-success"></i>
        <p class="text-muted mb-0 small">Register a user with a role to manage tasks</p>
      </div>

      <form @submit.prevent="handleRegister">
        <div class="form-floating mb-3">
          <input v-model="name" type="text" class="form-control" id="floatingName" placeholder="John Doe" required />
          <label for="floatingName">Full Name</label>
        </div>

        <div class="form-floating mb-3">
          <input v-model="email" type="email" class="form-control" id="floatingEmail" placeholder="name@example.com" required />
          <label for="floatingEmail">Email Address</label>
        </div>

        <div class="form-floating mb-3">
          <input v-model="password" type="password" class="form-control" id="floatingPassword" placeholder="Password" required />
          <label for="floatingPassword">Password</label>
        </div>

        <div class="form-floating mb-4">
          <select v-model="role" class="form-select" id="floatingRole" required>
            <option disabled value="">Select a role</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <label for="floatingRole">Role</label>
        </div>

        <button type="submit" class="btn btn-success w-100 py-2 shadow-sm">
          <i class="bi bi-check-circle me-2"></i>Register
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue';
import { request } from '@/services/apiWrapper';

const { appContext } = getCurrentInstance();
const toast = appContext.config.globalProperties.$toast;

const name = ref('');
const email = ref('');
const password = ref('');
const role = ref('');

const handleRegister = async () => {
  try {
    const [data, error] = await request('post', '/register', {
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
      toast.success(data.message || 'Registered successfully!');
    }
  } catch (_err) {
    toast.error('Unexpected error occurred. Please try again later.');
  }
};
</script>

<style scoped>

.card {
  max-width: 450px;
  width: 100%;
  padding: 1.9rem;
  margin: 0 !important;
}

.form-control,
.form-select {
  font-size: 0.9rem;
}

.form-floating > label {
  font-size: 0.9rem;
}

.btn {
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
}

@media (max-width: 576px) {
  .card {
    max-width: 90%;
    padding: 1rem;
  }

  .form-control,
  .form-select,
  .btn {
    font-size: 0.85rem;
  }

  .form-floating > label {
    font-size: 0.85rem;
  }

  .text-center .fs-2 {
    font-size: 1.5rem !important;
  }

  .text-center h5 {
    font-size: 1.25rem;
  }

  .text-center p {
    font-size: 0.8rem;
  }
}
</style>