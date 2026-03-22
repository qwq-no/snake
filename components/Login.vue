<template>
  <div class="login">
    <h2>Login</h2>
    <form @submit.prevent="onSubmit">
      <div class="field">
        <label>Username</label>
        <input v-model="form.username" type="text" />
      </div>

      <div class="field">
        <label>Password</label>
        <input v-model="form.password" type="password" />
      </div>

      <div class="actions">
        <button type="submit" :disabled="loading">
          {{ loading ? 'Login...' : 'Login' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <button class="register" @click="goRegister">register</button>
  </div>
</template>

<script setup>
import { login } from '../utils/auth.js';
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// 1) 状态：ref 就是“可响应变量”
const form = ref({
  username: '',
  password: ''
})
const loading = ref(false)
const error = ref('')

// 2) 路由对象（用于跳转）
const router = useRouter()
const route = useRoute()

// 3) 提交函数
async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    // 调后端登录（你封装的 api）
    await login(form.value)

    // 登录成功后跳转
    const redirect = route.query.redirect || '/home'
    await router.replace(redirect)
  } catch (e) {
    error.value = e.message || 'Login failed'
  } finally {
    loading.value = false
  }
}

// 4) 去注册页
function goRegister() {
  router.push('/register')
}
</script>