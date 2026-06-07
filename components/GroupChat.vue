<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { sendGroupChat } from '../utils/ws/actions.js';

const props = defineProps({
  messages: { type: Array, default: () => [] }
});

const myUserCode = ref(sessionStorage.getItem('userCode'));
const inputText = ref('');
const listRef = ref(null);

async function scrollToBottom() {
  await nextTick();
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight;
  }
}

watch(() => props.messages.length, () => {
  scrollToBottom();
});

function doSend() {
  const text = inputText.value.trim();
  if (!text) return;
  sendGroupChat(text);
  inputText.value = '';
}
</script>

<template>
  <div class="group-chat">
    <h3 class="chat-title">房间频道</h3>
    <div class="chat-messages" ref="listRef">
      <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="chat-row"
          :class="{ mine: String(msg.userCode) === String(myUserCode) }"
      >
        <span class="chat-nick">{{ msg.nickname }}</span>
        <span class="chat-content">{{ msg.content }}</span>
      </div>
      <div v-if="messages.length === 0" class="empty-hint">暂无消息</div>
    </div>
    <div class="chat-input-row">
      <input
          v-model="inputText"
          placeholder="输入消息..."
          @keyup.enter="doSend"
      />
      <button @click="doSend">发送</button>
    </div>
  </div>
</template>

<style scoped>
.group-chat {
  display: flex;
  flex-direction: column;
  height: 70vh;
  min-height: 420px;
}

.chat-title {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8fafc;
  border-radius: 14px;
  margin-bottom: 14px;
  border: 1px solid #f1f5f9;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.chat-messages::-webkit-scrollbar {
  width: 5px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 20px;
}

.empty-hint {
  text-align: center;
  color: #94a3b8;
  padding: 48px 0;
  font-size: 14px;
}

.chat-row {
  display: flex;
  gap: 8px;
  padding: 7px 0;
  align-items: baseline;
  animation: messageSlideIn 0.2s ease;
}

@keyframes messageSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-row.mine {
  flex-direction: row-reverse;
}

.chat-nick {
  font-weight: 700;
  color: #6366f1;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 2px 6px;
  background: rgba(99, 102, 241, 0.06);
  border-radius: 5px;
}
.chat-row.mine .chat-nick {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.06);
}

.chat-content {
  color: #334155;
  font-size: 14px;
  word-break: break-word;
  line-height: 1.55;
}

.chat-input-row {
  display: flex;
  gap: 10px;
}

.chat-input-row input {
  flex: 1;
  padding: 11px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  color: #1e293b;
  background: #fff;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-input-row input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}
.chat-input-row input::placeholder {
  color: #94a3b8;
}

.chat-input-row button {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.20);
  letter-spacing: 0.02em;
}
.chat-input-row button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.30);
}
.chat-input-row button:active {
  transform: translateY(0);
}
</style>
