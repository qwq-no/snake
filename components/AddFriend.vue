<script setup>
import {ref} from 'vue';
import {submitFriendApply} from '../utils/api.js';

const otherUserCode = ref('');
const message = ref('');

async function applyFriend() {
  try {
    await submitFriendApply(Number(otherUserCode.value));
    message.value = '好友申请已发送';
  } catch (e) {
    message.value = e.message || '申请失败';
  }
}
</script>

<template>
  <div class="add-friend">
    <input v-model="otherUserCode" placeholder="userCode" />
    <button @click="applyFriend">发送好友申请</button>
    <p>{{ message }}</p>
  </div>
</template>