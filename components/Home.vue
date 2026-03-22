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
      <ul>
        <li v-for="a in friends" :key="a.id">
          <span class="name">{{ a.name }}</span>
          <button class="goFriend" @click="goToFriend(a.id)">加入房间</button>
        </li>
      </ul>
    </div>
    <p>ID:{{userId}}</p>

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
import {onMounted, ref} from 'vue';
import router from "../router/index.js";
import AddFriend from "./AddFriend.vue";
import RoomManagement from "./RoomManagement.vue";
import Set from "./Set.vue";
import {getId} from "../utils/auth.js";

const componentsMap = { addFriend: AddFriend, roomManagement: RoomManagement, set: Set };
const friends = ref([
  // 示例数据，真实项目从接口/状态获取
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]);
const activeName = ref(null);
const activeProps = ref({});
const userId = ref('');

onMounted(async () => {
  try {
    userId.value = await getId()
  } catch (e) {
    console.error(e)
  }
})
function open(name, props = {}) {
  activeName.value = name;
  activeProps.value = props;
}
function close() {
  activeName.value = null;
  activeProps.value = {};
}
function goSet() { open('set'); }
function goSingle() { router.push('/game'); }
function goToFriend(id) {
  // 示例：把 friend id 传给 overlay，或直接进入房间
  open('roomManagement', { friendId: id });
}
function goRoom() { open('roomManagement'); }
function goAddFriend() { open('addFriend'); }
</script>

<style scoped>
/* 背景：宽 60vw，高 90vh，并居中 */
.background {
  position: relative;
  width: 60vw;
  height: 90vh;
  max-width: 1200px;
  margin: calc((100vh - 90vh) / 2) auto;
  padding: 24px;
  box-sizing: border-box;
  background: #f5f7fb;
  border-radius: 10px;
  overflow: hidden;
}

/* 打开 overlay 时不再改变背景外观（保持原样）*/
.background.dimmed {
  /* 保持原样，不做半透明处理 */
  opacity: 1;
  transition: none;
}

/* 设置按钮：在背景容器的右上角 */
.set {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 3;
}
.set .goSet {
  padding: 8px 12px;
  font-size: 14px;
  border-radius: 6px;
  border: none;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 6px 12px rgba(0,0,0,0.08);
}

/* 标题：上移一些，留出更多空间给菜单 */
.title {
  position: absolute;
  left: 50%;
  top: 18%;                     /* 上移：减少与菜单的拥挤 */
  transform: translateX(-50%);
  width: 50%;
  max-width: 700px;
  margin: 0;
  padding: 8px 0;
  text-align: center;
  font-weight: 800;
  color: #0f172a;
  font-size: clamp(28px, 4.5vw, 56px);
  line-height: 1.05;
  z-index: 2;
  letter-spacing: 1px;
  text-shadow: 0 4px 18px rgba(79,70,229,0.08);
}

/* 主菜单：向下移动到页面中心偏下，竖直排列 */
.menu {
  position: absolute;
  left: 50%;
  top: 50%;                     /* 下移，增加与标题间距 */
  transform: translateX(-50%);  /* 仅水平居中 */
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.menu button {
  padding: 28px 48px;
  width: 220px;
  font-size: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg,#4f46e5,#06b6d4);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 12px 30px rgba(15,23,42,0.12);
}

/* 朋友区域：右侧垂直居中（添加按钮在上，列表在下） */
.friend {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 2;
}
.addFriend {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 8px;
  border: none;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 6px 12px rgba(0,0,0,0.06);
}

/* 朋友列表：允许上下滚动 */
.friend ul {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(2,6,23,0.05);
}
.friend li {
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 10px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.friend li:last-child { border-bottom: none; }
.friend .name { margin-right: 8px; font-weight: 500; }

/* overlay 覆盖视口：fixed 且 transparent 背景（阻断事件但不使页面变灰） */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  background: transparent; /* 保持原页面视觉，但仍拦截点击 */
}

/* 中心卡片：不透明，居中显示，自动溢出滚动，遮盖下层内容 */
.overlay-center {
  position: relative;
  background: #ffffff; /* 不透明白色卡片，遮盖内容 */
  padding: 24px;
  border-radius: 12px;
  min-width: 420px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 30px 80px rgba(0,0,0,0.45); /* 强阴影以明显遮盖下层 */
  pointer-events: auto;
}

/* 关闭按钮：在 overlay 的右上角（卡片内部） */
.overlay-center .close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.06);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  z-index: 2;
}

/* 确保页面控件在 overlay 之下（overlay 的 z-index 更高） */
.menu, .set, .friend, .title { z-index: 1; }

/* 小屏优化 */
@media (max-width: 640px) {
  .background { width: 92vw; height: 86vh; margin: calc((100vh - 86vh) / 2) auto; padding: 16px; }
  .title { top: 14%; width: 80%; font-size: clamp(20px, 8vw, 36px); }
  .menu {
    top: 56%;
    gap: 12px;
  }
  .menu button {
    padding: 14px 20px;
    font-size: 16px;
    width: 160px;
  }
  .friend {
    right: 8px;
    width: 200px;
    top: 52%;
    transform: translateY(-50%);
  }
  .overlay-center { min-width: 300px; padding: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
}
</style>