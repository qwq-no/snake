<script setup>
import { ref } from 'vue';
import { updateDisplayName, updatePassword, logout } from '../utils/api.js';

const newName = ref('');
const newPassword = ref('');
const nameMsg = ref('');
const passwordMsg = ref('');

async function doUpdateName() {
  const name = newName.value.trim();
  if (!name) {
    nameMsg.value = '请输入新名称';
    return;
  }
  try {
    await updateDisplayName(name);
    sessionStorage.setItem('displayName', name);
    nameMsg.value = '名称已更改';
    newName.value = '';
  } catch (e) {
    nameMsg.value = e.message || '更改失败';
  }
}

async function doUpdatePassword() {
  const pw = newPassword.value;
  if (!pw) {
    passwordMsg.value = '请输入新密码';
    return;
  }
  try {
    await updatePassword(pw);
    passwordMsg.value = '密码已更改';
    newPassword.value = '';
  } catch (e) {
    passwordMsg.value = e.message || '更改失败';
  }
}

async function doLogout() {
  await logout();
}
</script>

<template>
  <div class="settings">
    <div class="row">
      <input v-model="newName" placeholder="请输入新名称" />
      <button @click="doUpdateName">更改名称</button>
      <span class="msg">{{ nameMsg }}</span>
    </div>
    <div class="row">
      <input v-model="newPassword" type="password" placeholder="请输入新密码" />
      <button @click="doUpdatePassword">更改密码</button>
      <span class="msg">{{ passwordMsg }}</span>
    </div>
    <div class="logout-row">
      <button class="logout-btn" @click="doLogout">登出</button>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row input {
  flex: 1;
  padding: 11px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  background: #f8fafc;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.row input:focus {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.10);
}
.row input::placeholder {
  color: #94a3b8;
}

.row button {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.20);
  letter-spacing: 0.01em;
}
.row button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.30);
}
.row button:active {
  transform: translateY(0);
}

.msg {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  min-width: 80px;
  font-weight: 500;
}

.logout-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}

.logout-btn {
  padding: 10px 24px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #ef4444;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.logout-btn:hover {
  background: #fef2f2;
  border-color: #fecaca;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.10);
  transform: translateY(-1px);
}
.logout-btn:active {
  transform: translateY(0);
}
</style>
