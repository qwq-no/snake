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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../utils/auth.js'

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
  margin: 24px auto;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 6px;
}
.field {
  margin-bottom: 12px;
}
.field label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}
.field input {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
}
.actions {
  margin-top: 16px;
}
button {
  padding: 8px 16px;
}
.error {
  margin-top: 12px;
  color: #b00020;
}
.goLogin {
  margin-top: 12px;
}
</style>