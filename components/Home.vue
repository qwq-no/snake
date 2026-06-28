<template>
  <div class="background" :class="{ dimmed: activeName }">
    <div class="set">
      <button class="goSet" @click="goSet">设置</button>
    </div>
    <h1 class="title">爱玩贪吃蛇</h1>
    <div class="menu">
      <button class="single" @click="goSingle">单人模式</button>
      <button class="room" @click="goRoom">房间</button>
    </div>

    <div class="friend">
      <button class="addFriend" @click="goAddFriend">添加朋友</button>
      <button class="appliedFriend" @click="goAppliedFriend">申请列表</button>
      <ul>
        <li v-for="a in friends" :key="a.userCode">
          <div class="friend-meta">
            <span class="code">编号：{{a.userCode}}</span>
            <span class="name">昵称：{{a.userName}}</span>
            <span class="status">状态：{{ a.status || '离线' }}</span>
          </div>
          <button class="talkFriend" @click="goTalkFriend(a)">聊天</button>
          <button
            class="goFriend"
            :class="{ disabled: a.roomCode == null }"
            @click="a.roomCode != null && goToFriend(a)"
          >加入房间</button>
          <button class="delFriend" @click="delFriend(a)">×</button>
        </li>
      </ul>
    </div>
    <div class="group-chat-preview">
      <button class="roomChannel" @click="goGroupChat">房间频道</button>
      <div class="preview-msgs" v-if="groupMessages.length > 0">
        <div
            v-for="msg in groupMessages.slice(-2)"
            :key="msg.timestamp"
            class="preview-msg"
        >
          <span class="prev-nick">{{ msg.nickname }}</span>: {{ msg.content }}
        </div>
      </div>
    </div>
    <p class="userCode">{{userCode}}</p>
    <div v-if="activeName" class="overlay-backdrop">
      <div class="overlay-center" role="dialog" aria-modal="true">
        <button class="close" @click="close">X</button>
        <component
            :is="componentsMap[activeName]"
            v-bind="activeProps"
            @close="close"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue';
import router from "../router/index.js";
import AddFriend from "./AddFriend.vue";
import Set from "./Set.vue";
import GroupChat from "./GroupChat.vue";
import FriendTalking from "./FriendTalking.vue";
import AppliedFriend from "./AppliedFriend.vue";
import {
  registerPageHandler,
  setCurrentPageType,
  setCurrentUserCode,
  syncCurrentPageToServer,
  unregisterPageHandler
} from "../utils/ws/index.js";
import {requestGroupChatHistory, sendJoin} from "../utils/ws/actions.js";
import {sessionStore} from "../utils/sessionStorage.js";
import {removeFriend} from "../utils/api.js";

const componentsMap = { addFriend: AddFriend, set: Set, groupChat: GroupChat, appliedFriend: AppliedFriend, friendTalking: FriendTalking };
const friends = ref([]);
const activeName = ref(null);
const activeProps = ref({});
const userCode = ref(null);
const groupMessages = ref([]);

function normalizeFriends(friendList) {
  return (friendList || [])
      .filter(Boolean)
      .map((friend) => ({
        userCode: friend.userCode,
        userName: friend.userName,
        status: friend.status || null,
        roomCode: friend.roomCode ?? null
      }));
}

function applyFriendStatus(friendStatus) {
  if (!friendStatus || !friendStatus.userCode) return;
  const target = friends.value.find((friend) => Number(friend.userCode) === Number(friendStatus.userCode));
  if (!target) {
    friends.value = [...friends.value, {
      userCode: friendStatus.userCode,
      userName: friendStatus.userName,
      status: friendStatus.status || null,
      roomCode: friendStatus.roomCode ?? null
    }];
    return;
  }
  target.status = friendStatus.status || null;
  target.roomCode = friendStatus.roomCode ?? null;
  if (friendStatus.userName) {
    target.userName = friendStatus.userName;
  }
}

function homeHandler(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'friend_status_list') {
    friends.value = normalizeFriends(msg.data);
    return;
  }

  if (msg.type === 'friend_status_change' || msg.type === 'friend_status_offline') {
    applyFriendStatus(msg.data);
    return;
  }

  if (msg.type === 'group_chat_message') {
    groupMessages.value = [...groupMessages.value, msg.data].slice(-300);
    return;
  }

  if (msg.type === 'group_chat_history') {
    groupMessages.value = (msg.data || []).slice(-300);
    return;
  }
}

onMounted(async () => {
  userCode.value = sessionStorage.getItem("userCode");
  setCurrentUserCode(userCode.value);
  setCurrentPageType('home');
  registerPageHandler('home', homeHandler);
  syncCurrentPageToServer('home');
  requestGroupChatHistory();
});

onBeforeUnmount(() => {
  unregisterPageHandler('home');
});

function open(name, props = {}) {
  activeName.value = name;
  activeProps.value = props;
}

function close() {
  activeName.value = null;
  activeProps.value = {};
}

function goSet() { open('set'); }
function goGroupChat() { open('groupChat', { messages: groupMessages }); }
function goSingle() { router.push('/game'); }
function goToFriend(friend) {
  const roomCode = friend.roomCode;
  if (roomCode == null) return;
  sessionStore.set("roomCode", roomCode);
  sendJoin(roomCode);
  const isPlaying = friend.status === 'ONLINE';
  router.push(isPlaying ? '/gameOnline' : '/roomPrepare');
}
function goRoom() { router.push('/roomSelect'); }
function goAddFriend() { open('addFriend'); }
function goAppliedFriend() { open('appliedFriend'); }
function goTalkFriend(friend) {
  open('friendTalking', {
    friendUserCode: friend.userCode,
    friendUserName: friend.userName
  });
}
async function delFriend(friend) {
  if (!confirm(`确定删除好友 ${friend.userName || friend.userCode} 吗？`)) return;
  try {
    await removeFriend(Number(userCode.value), friend.userCode);
    friends.value = friends.value.filter(f => f.userCode !== friend.userCode);
  } catch (e) {
    alert(e.message || '删除失败');
  }
}
</script>

<style scoped>
/* ===== 背景容器 ===== */
.background {
  position: relative;
  width: clamp(720px, 64vw, 1200px);
  height: 90vh;
  max-width: 1200px;
  margin: calc((100vh - 90vh) / 2) auto;
  padding: 24px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 40%, #e8eef4 100%);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 40px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(226, 232, 240, 0.6);
}

.background.dimmed {
  opacity: 1;
  transition: none;
}

/* ===== 设置按钮 ===== */
.set {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 3;
}
.set .goSet {
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  border: 1px solid var(--border, #e2e8f0);
  background: #fff;
  color: #475569;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.01em;
}
.set .goSet:hover {
  background: #f8fafc;
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
  transform: translateY(-1px);
}

/* ===== 标题 ===== */
.title {
  position: absolute;
  left: 50%;
  top: 16%;
  transform: translateX(-50%);
  width: 60%;
  max-width: 700px;
  margin: 0;
  padding: 8px 0;
  text-align: center;
  font-weight: 800;
  font-size: clamp(28px, 4.5vw, 56px);
  line-height: 1.08;
  z-index: 2;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #1e293b 0%, #334155 60%, #475569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 8px rgba(99, 102, 241, 0.10));
}

/* ===== 主菜单按钮 ===== */
.menu {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vh, 18px);
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.menu button {
  padding: clamp(16px, 3vh, 26px) clamp(28px, 5vw, 48px);
  width: clamp(140px, 18vw, 220px);
  font-size: clamp(15px, 1.8vw, 19px);
  font-weight: 700;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.30), 0 2px 8px rgba(99, 102, 241, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.02em;
  position: relative;
  overflow: hidden;
}
.menu button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0));
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: inherit;
}
.menu button:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 36px rgba(99, 102, 241, 0.38), 0 4px 12px rgba(99, 102, 241, 0.20);
}
.menu button:hover::before {
  opacity: 1;
}
.menu button:active {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.28);
}

/* ===== 好友区域（右侧，宽度自适应） ===== */
.friend {
  position: absolute;
  right: clamp(8px, 1.5vw, 20px);
  top: 50%;
  transform: translateY(-50%);
  width: clamp(170px, 22vw, 280px);
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 2;
}
.addFriend, .appliedFriend {
  padding: 8px 12px;
  font-size: clamp(11px, 1.1vw, 13px);
  font-weight: 600;
  border-radius: 10px;
  border: 1px solid var(--border, #e2e8f0);
  background: #fff;
  color: #475569;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}
.addFriend:hover, .appliedFriend:hover {
  background: #f8fafc;
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.25);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.10);
  transform: translateY(-1px);
}

/* 好友列表 */
.friend ul {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: clamp(180px, 30vh, 300px);
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04);
  border: 1px solid rgba(226, 232, 240, 0.7);
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
.friend ul::-webkit-scrollbar {
  width: 5px;
}
.friend ul::-webkit-scrollbar-track {
  background: transparent;
}
.friend ul::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 20px;
}
.friend li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(6px, 0.8vh, 12px) clamp(8px, 1vw, 14px);
  border-bottom: 1px solid #e2e8f0;
  transition: background 0.15s ease;
  gap: 4px;
}
.friend li:hover {
  background: #fafbfc;
}
.friend li:last-child {
  border-bottom: none;
}
.friend-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.friend .code { font-size: 10px; color: #94a3b8; }
.friend .name { font-weight: 600; font-size: clamp(11px, 1vw, 13px); color: #1e293b; }
.friend .status {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 20px;
  display: inline-block;
  width: fit-content;
}

/* 好友操作按钮 */
.friend li button {
  padding: 4px 8px;
  font-size: clamp(10px, 0.9vw, 12px);
  font-weight: 600;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.friend li button:hover {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.20);
}
.friend li button.goFriend {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border: none;
}
.friend li button.goFriend.disabled {
  background: #e2e8f0;
  color: #94a3b8;
  border: none;
  cursor: not-allowed;
  pointer-events: none;
}
.friend li button.goFriend:hover {
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.30);
  transform: translateY(-1px);
}
.friend li button.delFriend {
  padding: 2px 6px;
  font-size: 14px;
  line-height: 1;
  color: #94a3b8;
  border: none;
  background: transparent;
}
.friend li button.delFriend:hover {
  background: #fef2f2;
  color: #ef4444;
  border: none;
  box-shadow: none;
  transform: scale(1.15);
}

/* ===== 群聊预览（左下，透明玻璃质感） ===== */
.group-chat-preview {
  position: absolute;
  left: clamp(8px, 1.5vw, 20px);
  bottom: 40px;
  z-index: 2;
  width: clamp(150px, 18vw, 228px);
  max-width: 228px;
  background: rgba(255, 255, 255, 0.30);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 14px;
  padding: clamp(8px, 1vw, 14px);
  box-shadow: 0 2px 16px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5);
  border: 1px solid rgba(226, 232, 240, 0.6);
  transition: all 0.3s ease;
}
.group-chat-preview:hover {
  box-shadow: 0 8px 28px rgba(0,0,0,0.08), 0 0 0 1px rgba(99, 102, 241, 0.15);
  background: rgba(255, 255, 255, 0.50);
}

.roomChannel {
  width: 100%;
  padding: 8px 0;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: clamp(11px, 1vw, 13px);
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.22);
}
.roomChannel:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.32);
}

.preview-msgs {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.preview-msg {
  font-size: clamp(10px, 0.9vw, 12px);
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.5;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.40);
  transition: background 0.15s ease;
}
.preview-msg:hover {
  background: rgba(255, 255, 255, 0.70);
}

.prev-nick {
  font-weight: 700;
  color: #6366f1;
}

/* ===== 用户编号 ===== */
.userCode {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #94a3b8;
  z-index: 1;
  letter-spacing: 0.04em;
}

/* ===== Overlay 模态 ===== */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  background: transparent;
  backdrop-filter: blur(0px);
  animation: overlayFadeIn 0.2s ease;
}

@keyframes overlayFadeIn {
  from { background: transparent; }
  to { background: rgba(15, 23, 42, 0.08); backdrop-filter: blur(2px); }
}

.overlay-center {
  position: relative;
  background: #ffffff;
  padding: 28px;
  border-radius: 20px;
  min-width: min(440px, 88vw);
  max-width: 92%;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 25px 70px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12);
  pointer-events: auto;
  animation: cardSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(226, 232, 240, 0.5);
}

@keyframes cardSlideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.overlay-center .close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #64748b;
  z-index: 2;
  transition: all 0.2s ease;
}
.overlay-center .close:hover {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fecaca;
  transform: scale(1.05);
}

.menu, .set, .friend, .title { z-index: 1; }

/* ===== 中等屏幕（好友列表和群聊变窄，给菜单让位） ===== */
@media (max-width: 1100px) {
  .background {
    width: clamp(600px, 80vw, 1100px);
  }
  .friend {
    width: clamp(140px, 16vw, 200px);
  }
  .friend li {
    flex-wrap: wrap;
    gap: 3px;
  }
  .friend li button {
    padding: 3px 6px;
    font-size: 10px;
  }
  .friend-meta {
    gap: 1px;
  }
  .group-chat-preview {
    width: clamp(120px, 15vw, 170px);
    padding: 8px;
  }
  .menu button {
    width: clamp(120px, 16vw, 170px);
  }
}

/* ===== 小屏（进一步压缩，好友列表仅显示必要信息） ===== */
@media (max-width: 800px) {
  .background {
    width: 94vw;
    height: 88vh;
    margin: calc((100vh - 88vh) / 2) auto;
    padding: 12px;
    border-radius: 16px;
  }
  .title {
    top: 10%;
    width: 80%;
    font-size: clamp(20px, 7vw, 32px);
  }
  .menu {
    top: 54%;
    gap: 10px;
  }
  .menu button {
    padding: 14px 20px;
    font-size: 15px;
    width: clamp(110px, 30vw, 150px);
    border-radius: 14px;
  }
  .friend {
    right: 4px;
    width: clamp(120px, 35vw, 170px);
    gap: 6px;
  }
  .friend ul {
    max-height: 200px;
  }
  .friend li {
    padding: 6px 8px;
    flex-wrap: wrap;
  }
  .friend .code { display: none; }
  .friend-meta {
    gap: 1px;
  }
  .friend li button {
    margin-left: 0;
    padding: 3px 5px;
    font-size: 10px;
    border-radius: 5px;
  }
  .group-chat-preview {
    left: 4px;
    bottom: 22px;
    width: clamp(110px, 28vw, 150px);
    padding: 6px 8px;
    border-radius: 10px;
  }
  .preview-msg {
    font-size: 10px;
    padding: 2px 4px;
  }
  .roomChannel {
    font-size: 10px;
    padding: 6px 0;
    margin-bottom: 4px;
  }
  .overlay-center {
    min-width: 280px;
    padding: 18px;
    border-radius: 16px;
  }
  .addFriend, .appliedFriend {
    padding: 6px 8px;
    font-size: 10px;
  }
  .set {
    top: 12px;
    right: 8px;
  }
  .set .goSet {
    padding: 7px 12px;
    font-size: 11px;
  }
}
</style>