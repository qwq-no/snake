<template>
  <button @click="createRoom">创建房间</button>
  <button @click="joinRoom">加入房间</button>
  <button @click="back">返回主页</button>
</template>

<script setup>
import router from "../router/index.js";
function createRoom() {}
function joinRoom() {}
function back() {router.push(-1)}
</script>

<style scoped>

</style>