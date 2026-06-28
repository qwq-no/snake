<template>
  <div class="register">
    <h2>Register</h2>
    <form @submit.prevent="onSubmit">
      <div class="field">
        <label>Username</label>
        <input v-model="form.username" type="text" />
      </div>

      <div class="field">
        <label>Email</label>
        <input v-model="form.email" type="email" />
      </div>

      <div class="field">
        <label>Password</label>
        <input v-model="form.password" type="password" />
      </div>

      <div class="field">
        <label>Display name</label>
        <input v-model="form.displayName" type="text" />
      </div>

      <div class="actions">
        <button type="submit" :disabled="loading">
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <button class="goLogin" @click="goLogin">Login</button>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {register} from '../utils/api.js'

const router = useRouter()

const form = ref({
  username: '',
  email: '',
  password: '',
  displayName: ''
})

const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    await register(form.value)
    await router.push('/login')
  } catch (e) {
    error.value = e.message || 'Register failed'
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push('/login')
}
</script>

<style scoped>
.register {
  max-width: 420px;
  margin: 48px auto;
  padding: 32px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  box-shadow: 0 2px 40px rgba(0, 0, 0, 0.05), 0 1px 4px rgba(0, 0, 0, 0.03);
  animation: fadeSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.register h2 {
  margin: 0 0 28px;
  font-size: 26px;
  font-weight: 700;
  text-align: center;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.field {
  margin-bottom: 18px;
}
.field label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 13px;
  color: #475569;
  letter-spacing: 0.01em;
}
.field input {
  width: 100%;
  padding: 11px 14px;
  box-sizing: border-box;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  background: #f8fafc;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.field input:focus {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.10);
}
.field input::placeholder {
  color: #94a3b8;
}

.actions {
  margin-top: 24px;
}
.actions button {
  width: 100%;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);
  letter-spacing: 0.02em;
}
.actions button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}
.actions button:active:not(:disabled) {
  transform: translateY(0);
}
.actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #fecaca;
  text-align: center;
}

.goLogin {
  display: block;
  width: 100%;
  margin-top: 14px;
  padding: 10px 16px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.goLogin:hover {
  background: #f8fafc;
  border-color: #6366f1;
  color: #6366f1;
}
</style>