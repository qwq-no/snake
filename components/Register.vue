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

<script>
export default {
  name: 'Register',
  data() {
    return {
      form: {
        username: '',
        email: '',
        password: '',
        displayName: ''
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
        const resp = await fetch('/api/user/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form)
        });

        if (resp.status === 201 || resp.status === 204 || resp.status === 200) {
          this.$router.push('/login');
          return;
        }

        let msg = '';
        try {
          const data = await resp.json();
          msg = data?.msg || data?.message || '';
        } catch (_) {
          msg = await resp.text();
        }
        this.error = msg || `Registration failed (status ${resp.status})`;
      } catch (e) {
        this.error = e.message || 'Network error';
      } finally {
        this.loading = false;
      }
    },
    goLogin() {
      this.$router.push('/login');
    }
  }
};
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
</style>