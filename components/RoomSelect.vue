<template>
  <div class="room-select-page">
    <div class="room-panel">
      <div class="top-bar">
        <button class="back-btn" @click="goHome">返回主页</button>
      </div>

      <div class="room-grid">
        <div
            v-for="room in rooms"
            :key="room.roomCode"
            class="room-card"
            @click="enterRoom(room.roomCode)"
        >
          <div class="room-friend" v-if="room.hasFriend">好友在玩</div>

          <div class="room-timer">{{ room.timer }}</div>

          <div class="room-info">
            <div class="room-player-count">
              {{ room.playerCount }}人在玩
            </div>
            <div class="room-code">{{ room.roomCode }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue';
import router from "../router/index.js";
import { sessionStore } from "../utils/sessionStorage.js";
import {getFriendList} from "../utils/api.js";
import {registerPageHandler, sendJoin, syncCurrentPageToServer, setCurrentPageType, setCurrentUserCode, unregisterPageHandler} from "../utils/ws/index.js";


const rooms = ref([]);
const currentUserCode = Number(sessionStorage.getItem('userCode'));
const friendCodes = ref(new Set());

async function loadFriendCodes() {
  const friends = await getFriendList(currentUserCode);
  friendCodes.value = new Set((friends || []).map((friend) => Number(friend.userCode)));
}

function upsertRooms(roomList) {
  rooms.value = (roomList || [])
      .filter(Boolean)
      .map((room) => ({
        roomCode: room.roomCode,
        playerCount: room.playerCount ?? 0,
        status: room.status || 'waiting',
        hasFriend: Array.isArray(room.userCodes) ? room.userCodes.some((code) => friendCodes.value.has(Number(code))) : false,
        timer: room.status === 'playing' ? '进行中' : '等待中'
      }))
      .sort((a, b) => a.roomCode - b.roomCode);
}

function applyRoomDelta(roomSummary) {
  if (!roomSummary || !roomSummary.roomCode) return;
  const index = rooms.value.findIndex((room) => Number(room.roomCode) === Number(roomSummary.roomCode));
  const nextRoom = {
    roomCode: roomSummary.roomCode,
    playerCount: roomSummary.playerCount ?? 0,
    status: roomSummary.status || 'waiting',
    hasFriend: Array.isArray(roomSummary.userCodes) ? roomSummary.userCodes.some((code) => friendCodes.value.has(Number(code))) : false,
    timer: roomSummary.status === 'playing' ? '进行中' : '等待中'
  };
  if (index >= 0) {
    rooms.value[index] = nextRoom;
  } else {
    rooms.value = [...rooms.value, nextRoom].sort((a, b) => a.roomCode - b.roomCode);
  }
}

function selectHandler(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'room_summary_list') {
    upsertRooms(msg.data);
    return;
  }

  if (msg.type === 'room_summary_delta') {
    applyRoomDelta(msg.data);
  }
}

function enterRoom(roomCode) {
  const room = rooms.value.find((item) => Number(item.roomCode) === Number(roomCode));
  sessionStore.set("roomCode", roomCode);
  sendJoin(roomCode);
  router.push(room && room.status === 'playing' ? '/gameOnline' : '/roomPrepare');
}

function goHome() {
  router.push('/home');
}

onMounted(() => {
  setCurrentPageType('select');
  registerPageHandler('select',selectHandler);
  setCurrentUserCode(sessionStorage.getItem('userCode'));
  syncCurrentPageToServer('select');
  loadFriendCodes();
})
onBeforeUnmount(() => {
  unregisterPageHandler('select');
})
</script>

<style scoped>
.room-select-page {
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(99, 102, 241, 0.08), transparent 40%),
    radial-gradient(ellipse at 80% 100%, rgba(139, 92, 246, 0.06), transparent 40%),
    linear-gradient(180deg, #0f1219 0%, #0b0e15 100%);
  animation: pageFadeIn 0.4s ease;
}

@keyframes pageFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.room-panel {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 24px;
  background: rgba(18, 22, 30, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}

.room-card {
  min-height: 124px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: #c8d6e5;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.room-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(129, 140, 248, 0.08), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.room-card:hover {
  transform: translateY(-3px);
  border-color: rgba(129, 140, 248, 0.35);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.30), 0 0 0 1px rgba(129, 140, 248, 0.08);
}
.room-card:hover::after {
  opacity: 1;
}
.room-card:active {
  transform: translateY(-1px);
}

.room-friend {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(52, 211, 153, 0.15);
  color: #6ee7b7;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  backdrop-filter: blur(4px);
}

.room-timer {
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.04em;
  color: #e2e8f0;
}

.room-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.room-player-count {
  opacity: 0.75;
  font-weight: 500;
}

.room-code {
  font-size: 20px;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: 0.02em;
}

.top-bar {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 18px;
}

.back-btn {
  min-width: 120px;
  padding: 10px 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
  letter-spacing: 0.02em;
}
.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.38);
}
.back-btn:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .room-select-page {
    padding: 16px;
  }
  .room-panel {
    padding: 18px;
    border-radius: 20px;
  }
  .room-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .room-card {
    min-height: 108px;
    padding: 14px;
    border-radius: 16px;
  }
}
</style>