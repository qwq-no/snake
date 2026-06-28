<template>
  <div class="friend-talking">
    <!-- 左侧聊天对象列表 -->
    <div class="chat-list">
      <div class="chat-list-title">聊天对象</div>

      <div
          v-for="item in chatUsers"
          :key="item.userCode"
          class="chat-user-item"
          :class="{ active: currentChatUser && currentChatUser.userCode === item.userCode }"
          @click="selectChatUser(item)"
      >
        {{ item.userName || item.userCode }}
      </div>
      <div v-if="chatUsers.length === 0" class="empty-contacts">暂无聊天记录</div>
    </div>

    <!-- 右侧聊天窗口 -->
    <div class="chat-panel" v-if="currentChatUser">
      <div class="chat-panel-header">
        {{ currentChatUser.userName || currentChatUser.userCode }}
      </div>

      <div class="chat-message-list" ref="messageListRef">
        <div
            v-for="msg in currentMessages"
            :key="msg.id"
            class="message-row"
            :class="{ mine: Number(msg.fromUserCode) === Number(myUserCode), others: Number(msg.fromUserCode) !== Number(myUserCode) }"
        >
          <div class="message-name">
            {{ Number(msg.fromUserCode) === Number(myUserCode) ? myDisplayName : (currentChatUser.userName || currentChatUser.userCode) }}
          </div>
          <div class="message-bubble">
            {{ msg.content }}
          </div>
        </div>
        <div v-if="currentMessages.length === 0" class="empty-hint">暂无消息，开始聊天吧</div>
      </div>

      <div class="chat-input-area">
        <input
            v-model="inputText"
            class="chat-input"
            type="text"
            placeholder="输入消息..."
            @keyup.enter="sendMessage"
        />
        <button class="send-btn" @click="sendMessage">发送</button>
      </div>
    </div>

    <!-- 右侧空状态 -->
    <div class="chat-panel empty" v-else>
      <div class="empty-tip">请选择一个好友开始聊天</div>
    </div>
  </div>
</template>

<script setup>
import {nextTick, onBeforeUnmount, onMounted, ref} from 'vue';
import {
  registerPageHandler,
  sendPrivateChat,
  setCurrentPageType,
  syncCurrentPageToServer,
  unregisterPageHandler
} from "../utils/ws/index.js";
import {sendGameWs} from "../utils/ws/actions.js";

const props = defineProps({
  friendUserCode: { type: [Number, String], default: null },
  friendUserName: { type: String, default: null }
});

const myUserCode = ref(sessionStorage.getItem('userCode') || '');
const myDisplayName = ref(sessionStorage.getItem('displayName') || '我');

const chatUsers = ref([]);
const currentChatUser = ref(null);
const currentMessages = ref([]);
const inputText = ref('');
const messageListRef = ref(null);

function ensureTargetFriendInList(targetCode, targetName) {
  if (targetCode == null) return;
  const code = Number(targetCode);
  const existingIdx = chatUsers.value.findIndex(c => Number(c.userCode) === code);
  const entry = { userCode: code, userName: targetName || String(code), lastMsgTime: null };
  if (existingIdx >= 0) {
    chatUsers.value.splice(existingIdx, 1);
  }
  chatUsers.value.unshift(entry);
}

function selectChatUser(item) {
  currentChatUser.value = item;
  currentMessages.value = [];
  // 请求聊天历史
  sendGameWs({
    type: 'private_chat_history',
    pageType: 'talk',
    withUserCode: item.userCode
  });
  scrollToBottom();
}

async function scrollToBottom() {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
}

function sendMessage() {
  if (!inputText.value.trim() || !currentChatUser.value) return;

  sendPrivateChat(currentChatUser.value.userCode, inputText.value.trim());
  inputText.value = '';
}

function talkHandler(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'talk_contact_list') {
    const list = msg.data || [];
    // 按 lastMsgTime 倒序排列
    list.sort((a, b) => (b.lastMsgTime || '').localeCompare(a.lastMsgTime || ''));
    chatUsers.value = list;
    // 如果是从首页"聊天"按钮点进来的，确保目标好友在最上面
    if (props.friendUserCode != null) {
      ensureTargetFriendInList(props.friendUserCode, props.friendUserName);
    }
    // 选中目标好友或第一个联系人
    if (props.friendUserCode != null) {
      const target = chatUsers.value.find(c => Number(c.userCode) === Number(props.friendUserCode));
      if (target) selectChatUser(target);
    } else if (list.length > 0 && !currentChatUser.value) {
      selectChatUser(list[0]);
    }
    return;
  }

  if (msg.type === 'private_chat_history') {
    const data = msg.data;
    // 支持分页响应格式 {messages, total, page, size, hasMore}，同时向后兼容旧数组格式
    if (data && Array.isArray(data.messages)) {
      currentMessages.value = data.messages;
      // hasMore 可用于后续实现滚动加载更多
    } else if (Array.isArray(data)) {
      currentMessages.value = data;
    } else {
      currentMessages.value = [];
    }
    scrollToBottom();
    return;
  }

  if (msg.type === 'private_chat_message') {
    const data = msg.data;
    if (!data) return;
    // 判断是否与当前聊天对象相关
    const otherCode = Number(data.fromUserCode) === Number(myUserCode.value)
        ? data.toUserCode : data.fromUserCode;
    if (currentChatUser.value && Number(currentChatUser.value.userCode) === Number(otherCode)) {
      currentMessages.value = [...currentMessages.value, data];
      scrollToBottom();
    }
    // 更新联系人排序：将该联系人移到最上面
    const existingIdx = chatUsers.value.findIndex(
        c => Number(c.userCode) === Number(otherCode)
    );
    const contactEntry = { userCode: otherCode, lastMsgTime: data.createdAt || new Date().toISOString() };
    if (existingIdx >= 0) {
      chatUsers.value.splice(existingIdx, 1);
    }
    chatUsers.value.unshift(contactEntry);
    return;
  }
}

onMounted(() => {
  setCurrentPageType('talk');
  registerPageHandler('talk', talkHandler);
  syncCurrentPageToServer('talk');

  // 如果是从首页"聊天"按钮点进来的，立即把目标好友放在最上面
  if (props.friendUserCode != null) {
    ensureTargetFriendInList(props.friendUserCode, props.friendUserName);
    const target = chatUsers.value.find(c => Number(c.userCode) === Number(props.friendUserCode));
    if (target) selectChatUser(target);
  }

  // 请求联系人列表（回来后会再次 merge 并完善 lastMsgTime）
  sendGameWs({
    type: 'talk_contact_list',
    pageType: 'talk'
  });
});

onBeforeUnmount(() => {
  unregisterPageHandler('talk');
});
</script>

<style scoped>
.friend-talking {
  width: 86vw;
  height: 90vh;
  max-width: 100vw;
  max-height: 100vh;
  display: flex;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.20), 0 8px 24px rgba(0, 0, 0, 0.10);
  animation: scaleIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(226, 232, 240, 0.4);
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

/* ===== 左侧联系人列表 ===== */
.chat-list {
  width: 228px;
  min-width: 190px;
  background: #f8fafc;
  border-right: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.chat-list-title {
  padding: 18px 16px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 1px solid #f1f5f9;
  letter-spacing: -0.01em;
}

.chat-user-item {
  padding: 14px 18px;
  cursor: pointer;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
  color: #334155;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.chat-user-item:hover {
  background: #eef2ff;
  color: #4338ca;
}
.chat-user-item.active {
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  font-weight: 700;
  color: #4338ca;
  border-right: 3px solid #6366f1;
}

.empty-contacts {
  padding: 32px 16px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

/* ===== 右侧聊天面板 ===== */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  min-width: 0;
}

.chat-panel-header {
  height: 56px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
  letter-spacing: -0.01em;
}

/* ===== 消息列表 ===== */
.chat-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px 18px;
  background: #fff;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
  display: flex;
  flex-direction: column;
}
.chat-message-list::-webkit-scrollbar {
  width: 5px;
}
.chat-message-list::-webkit-scrollbar-track {
  background: transparent;
}
.chat-message-list::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 20px;
}

.message-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  max-width: 72%;
  animation: msgSlideIn 0.2s ease;
}

@keyframes msgSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-row.mine {
  align-self: flex-end;
  align-items: flex-end;
}

.message-row.others {
  align-self: flex-start;
  align-items: flex-start;
}

.message-name {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
  padding: 0 8px;
  letter-spacing: 0.02em;
}

.message-bubble {
  padding: 10px 16px;
  border-radius: 16px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
  font-size: 14px;
}

.message-row.mine .message-bubble {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border-bottom-right-radius: 6px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.18);
}

.message-row.others .message-bubble {
  background: #f1f5f9;
  color: #1e293b;
  border-bottom-left-radius: 6px;
}

.empty-hint {
  text-align: center;
  color: #94a3b8;
  padding: 48px 0;
  font-size: 14px;
}

/* ===== 输入区 ===== */
.chat-input-area {
  display: flex;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
}

.chat-input {
  flex: 1;
  height: 42px;
  padding: 0 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  background: #fff;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}
.chat-input::placeholder {
  color: #94a3b8;
}

.send-btn {
  width: 84px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.18);
  letter-spacing: 0.02em;
}
.send-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.30);
}
.send-btn:active {
  transform: translateY(0);
}

/* ===== 空状态 ===== */
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-tip {
  color: #94a3b8;
  font-size: 15px;
  font-weight: 500;
}
</style>
