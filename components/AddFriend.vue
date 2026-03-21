<template>
  <button @click="back">返回主页</button>
</template>

<script setup>
import router from "../router/index.js";

function back(){router.go(-1)}
</script>

<style scoped>

</style>