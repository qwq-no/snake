<template>
  <div class="room-wrap">
    <div class="top-bar">
      <button class="back-btn" @click="backToSelect">返回房间列表</button>
      <h2>房间 {{ roomCode }}</h2>
    </div>

    <div class="player-list">
      <div
          v-for="player in players"
          :key="player.userCode"
          class="player-card"
          :class="{ ready: player.ready, notReady: !player.ready }"
      >
        <div class="userCode">{{ player.userCode }}</div>
        <div
            v-if="playerChatMessages[player.userCode]"
            class="chat-msg"
            :class="{ fading: playerChatMessages[player.userCode]?.fading }"
        >{{ playerChatMessages[player.userCode]?.text }}</div>
        <div class="status">{{ player.ready ? '已准备' : '未准备' }}</div>
      </div>
    </div>

    <div class="footer">
      <button class="ready-btn" @click="toggleReady">
        {{ isReady ? '取消准备' : '准备' }}
      </button>
    </div>
    <div class="chat-footer">
      <input
          v-model="groupInput"
          class="chat-inp"
          maxlength="15"
          placeholder="输入消息（15字以内）"
          @keyup.enter="sendGroupChatFromPrepare"
      />
      <button class="chat-send" @click="sendGroupChatFromPrepare">发送</button>
    </div>
  </div>
</template>

<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue';
import router from "../router/index.js";

import {sessionStore} from "../utils/sessionStorage.js";
import {
  initGameWs,
  registerPageHandler,
  sendLeaveRoom,
  sendReady,
  sendUnready,
  setCurrentPageType,
  setCurrentRoomCode,
  syncCurrentPageToServer,
  unregisterPageHandler
} from "../utils/ws/index.js";
import {sendGroupChat} from "../utils/ws/actions.js";

const roomCode = ref("");
const myUserCode = ref(sessionStorage.getItem('userCode'));
const isReady = ref(false);
const players = ref([]);
const playerChatMessages = ref({});
const playerChatTimers = {}; // non-reactive timer storage
const groupInput = ref('');

function applyLobbyState(lobbyState) {
  const members = lobbyState.members || [];
  const readyUsers = new Set(lobbyState.readyUsers || []);
  players.value = members.map(userCode => ({
    userCode,
    ready: readyUsers.has(userCode)
  }));

  isReady.value = readyUsers.has(myUserCode.value);
}

function prepareHandler(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'ready_state') {
    applyLobbyState(msg.data);
  } else if (msg.type === 'ready_over') {
    router.push('/gameOnline');
  } else if (msg.type === 'group_chat_message') {
    const data = msg.data;
    if (!data || !data.userCode) return;
    const uCode = String(data.userCode);

    // 清除旧消息的所有定时器（旧消息立即消失，无过渡）
    const oldTimers = playerChatTimers[uCode];
    if (oldTimers) {
      if (oldTimers.showTimer) clearTimeout(oldTimers.showTimer);
      if (oldTimers.removeTimer) clearTimeout(oldTimers.removeTimer);
      delete playerChatTimers[uCode];
    }

    // 设置新消息
    playerChatMessages.value = {
      ...playerChatMessages.value,
      [uCode]: { text: data.content, fading: false }
    };

    // 3秒后开始 fade-out
    const timers = {};
    timers.showTimer = setTimeout(() => {
      const cur = playerChatMessages.value[uCode];
      if (cur) {
        playerChatMessages.value = {
          ...playerChatMessages.value,
          [uCode]: { ...cur, fading: true }
        };
        // 0.5s 过渡结束后移除
        timers.removeTimer = setTimeout(() => {
          const copy = { ...playerChatMessages.value };
          delete copy[uCode];
          playerChatMessages.value = copy;
          delete playerChatTimers[uCode];
        }, 500);
      }
    }, 3000);
    playerChatTimers[uCode] = timers;
  }
}

function sendGroupChatFromPrepare() {
  const text = groupInput.value.trim();
  if (!text) return;
  sendGroupChat(text);
  groupInput.value = '';
}

function toggleReady() {
  if (!roomCode.value || !myUserCode.value) return;
  isReady.value ? sendUnready() : sendReady();
}

function backToSelect() {
  sendLeaveRoom();
  router.push('/roomSelect');
}



onMounted(() => {
  roomCode.value = sessionStore.get("roomCode") || sessionStorage.getItem("roomCode");
  myUserCode.value = sessionStorage.getItem('userCode');

  setCurrentPageType('prepare');
  setCurrentRoomCode(Number(roomCode.value));

  initGameWs({ onOpen: null, onClose: null, onError: null });
  registerPageHandler('prepare', prepareHandler);
  syncCurrentPageToServer('prepare');
});

onBeforeUnmount(() => {
  unregisterPageHandler('prepare');
  unregisterPageHandler('online');
  // 清理所有聊天消息定时器
  for (const key of Object.keys(playerChatTimers)) {
    const t = playerChatTimers[key];
    if (t.showTimer) clearTimeout(t.showTimer);
    if (t.removeTimer) clearTimeout(t.removeTimer);
  }
});
</script>

<style scoped>
.room-wrap {
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(99, 102, 241, 0.08), transparent 40%),
    radial-gradient(ellipse at 80% 100%, rgba(139, 92, 246, 0.06), transparent 40%),
    linear-gradient(180deg, #0f1219 0%, #0b0e15 100%);
  color: #c8d6e5;
  animation: pageFadeIn 0.4s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@keyframes pageFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.top-bar {
  max-width: 1200px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.room-wrap h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.02em;
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

.player-list {
  flex: 1;
  overflow-y: auto;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
  align-content: start;
  padding-right: 4px;
}

.player-card {
  min-height: 96px;
  padding: 16px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.player-card.ready {
  border-color: rgba(52, 211, 153, 0.35);
  box-shadow: 0 8px 24px rgba(52, 211, 153, 0.08);
}
.player-card.ready::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.10), transparent 60%);
  pointer-events: none;
}
.player-card.notReady {
  border-color: rgba(255, 255, 255, 0.07);
}

.userCode {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: 0.01em;
}

.status {
  align-self: flex-end;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.28);
  letter-spacing: 0.03em;
}
.player-card.ready .status {
  color: #6ee7b7;
  background: rgba(52, 211, 153, 0.12);
}
.player-card.notReady .status {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.10);
}

.footer {
  max-width: 1200px;
  margin: 20px auto 0;
  display: flex;
  justify-content: center;
}

.ready-btn {
  min-width: 140px;
  padding: 12px 24px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
  letter-spacing: 0.02em;
}
.ready-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.38);
}
.ready-btn:active {
  transform: translateY(0);
}

.chat-msg {
  font-size: 12px;
  color: #fbbf24;
  padding: 4px 8px;
  margin: 6px 0;
  word-break: break-word;
  opacity: 1;
  transition: opacity 0.5s ease, transform 0.5s ease;
  border-radius: 6px;
  background: rgba(251, 191, 36, 0.06);
  line-height: 1.4;
}
.chat-msg.fading {
  opacity: 0;
  transform: translateY(-4px);
}

.chat-footer {
  max-width: 1200px;
  margin: 16px auto 0;
  display: flex;
  gap: 10px;
  justify-content: center;
}

.chat-inp {
  width: 260px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
}
.chat-inp:focus {
  border-color: rgba(129, 140, 248, 0.40);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.06);
  background: rgba(255, 255, 255, 0.09);
}
.chat-inp::placeholder {
  color: rgba(255, 255, 255, 0.28);
}

.chat-send {
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.22);
  letter-spacing: 0.02em;
}
.chat-send:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.32);
}
.chat-send:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .room-wrap {
    padding: 16px;
  }
  .top-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .player-list {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
  }
  .player-card {
    min-height: 84px;
    padding: 14px;
    border-radius: 16px;
  }
  .chat-inp {
    width: 200px;
  }
}

/* 滚动条样式 */
.player-list::-webkit-scrollbar {
  width: 6px;
}
.player-list::-webkit-scrollbar-track {
  background: #2d333b;
  border-radius: 3px;
}
.player-list::-webkit-scrollbar-thumb {
  background: #1a1d24;
  border-radius: 3px;
}
.player-list::-webkit-scrollbar-thumb:hover {
  background: #14171d;
}
</style>