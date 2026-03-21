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

<script>
export default {
  name: 'Login',
  data() {
    return {
      form: {
        username: '',
        password: ''
      },
      loading: false,
      error: ''
    };
  },
  methods: {
    async onSubmit() {
      this.error = '';
      this.loading = true;

      try {
        const resp = await fetch('/api/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form),
          credentials: 'include' // 必须：让浏览器接受并保存 HttpOnly Set-Cookie
        });

        // 先处理 HTTP 层
        if (!resp.ok) {
          // 尝试解析后端返回的错误信息
          let errJson = null;
          try { errJson = await resp.json(); } catch (e) {}
          this.error = errJson?.msg || `HTTP ${resp.status}`;
          return;
        }

        // 解析 body（你的 Result<T>）
        let result;
        try {
          result = await resp.json();
        } catch (e) {
          this.error = 'Invalid JSON response from server';
          return;
        }

        // 检查后端 Result.code（你的 Result 成功码是 1）
        if (!result || result.code !== 1) {
          this.error = result?.msg || 'Login failed';
          return;
        }

        // 登录成功：后端已经通过 Set-Cookie 下发 refresh token（HttpOnly）
        // 可选：把返回的用户信息写入 store（如果你使用 Vuex/Pinia）
        if (this.$store && result.data) {
          // 假设你有一个 mutation 或 action 可以设置用户
          // 你需要根据项目实际名称改成合适的方法，如 this.$store.commit('setUser', result.data)
          if (typeof this.$store.commit === 'function') {
            this.$store.commit('setUser', result.data);
          }
        }

        // 导航：优先使用路由 query 中的 redirect（如果有），否则跳到 /home
        const redirect = this.$route?.query?.redirect || '/home';
        // 推荐使用 replace 避免用户按回退返回到登录页
        this.$router.replace(redirect);

      } catch (e) {
        // 网络或不可预期错误
        this.error = e.message || 'Network error';
      } finally {
        this.loading = false;
      }
    },

    goRegister() {
      this.$router.push('/register');
    }
  }
};
</script>

<style scoped>
/* 省略，保留你原来的样式 */
</style>