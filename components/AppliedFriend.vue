<template>
  <div class="applied-friend">
    <button @click="loadRequests">加载申请列表</button>

    <ul>
      <li v-for="item in requests" :key="item.requestId">
        <span>{{ item.fromUserName }} ({{ item.fromUserCode }})</span>
        <button @click="acceptRequest(item.requestId)">接受</button>
        <button @click="rejectRequest(item.requestId)">拒绝</button>
      </li>
    </ul>

    <p>{{ message }}</p>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue';
import {getFriendRequestList, handleFriendRequest} from '../utils/api.js';

const requests = ref([]);
const message = ref('');

onMounted(() => {
  loadRequests();
});
async function loadRequests() {
  try {
    requests.value = await getFriendRequestList();
  } catch (e) {
    message.value = e.message || '加载失败';
  }
}

async function acceptRequest(requestId) {
  try {
    await handleFriendRequest(requestId, 'accept');
    message.value = '已接受好友申请';
    await loadRequests();
  } catch (e) {
    message.value = e.message || '处理失败';
  }
}

async function rejectRequest(requestId) {
  try {
    await handleFriendRequest(requestId, 'reject');
    message.value = '已拒绝好友申请';
    await loadRequests();
  } catch (e) {
    message.value = e.message || '处理失败';
  }
}
</script>