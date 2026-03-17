<script setup>
import { ref } from 'vue';
const friends = ref([])
function goSingle(){}
function goFriends(id) {}
function goRoom(){}
</script>

<template>
  <div class="background">
    <div class="menu">
      <button class="single" @click="goSingle">单人模式</button>
      <button class="room" @click="goRoom">房间</button>
    </div>
    <div class="friend">
      <button class="addFriend"/>
      <ul>
        <li v-for="a in friends" key="a.id">
          <span class="name">{{ a.name }}</span>
          <button class="goFriend" @click="goFriends(a.id)">加入</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>

</style>