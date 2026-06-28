<template>
  <div class="game-wrap">
    <div class="game-stage">
      <canvas ref="canvas" class="world"></canvas>
      <canvas ref="fogCanvas" class="fog"></canvas>
      <div class="countdown" v-if="countdownText">
        {{ countdownText }}
      </div>
    </div>

    <!-- 退出确认面板 -->
    <div v-show="gameState === 'paused'" class="overlay">
      <div class="panel">
        <h2>是否退出游戏？</h2>
        <p>按 Enter / 空格 确认退出</p>
        <p>按 ESC 返回游戏</p>
      </div>
    </div>

    <!-- 死亡面板 -->
    <div v-show="gameState === 'gameFinished'" class="overlay">
      <div class="panel">
        <h2>你翻车了</h2>
        <p>当前长度：{{ mySnakeLength }}</p>
        <p>最大长度：{{ maxLength }}</p>
        <p>等待复活...</p>
        <button @click="goHome">返回主页</button>
      </div>
    </div>

    <!--结束面板-->
    <div v-show="gameState === 'gameOver'" class="overlay">
      <div class="panel">
        <h2>游戏结束</h2>
        <p>当前长度：{{ mySnakeLength }}</p>
        <p>最大长度：{{ maxLength }}</p>
        <button @click="goHome">返回主页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  initGameWs,
  registerPageHandler,
  sendEmoji,
  sendKeyInput,
  sendLeaveRoom,
  setCurrentPageType,
  setCurrentRoomCode,
  syncCurrentPageToServer,
  unregisterPageHandler
} from "../utils/ws/index.js";
import {onBeforeUnmount, onMounted, ref} from 'vue';
import router from "../router/index.js";


const canvas = ref(null);
const fogCanvas = ref(null);
let ctx;
let fogCtx;

const maxLength = ref(0);
const mySnakeLength = ref(0);
const lastAliveSnakeLength = ref(0);
const gameState = ref('playing'); // playing | paused | gameOver | gameFinished
const MAP_SIZE = 102;

const WORLD = {
  width: 4000,
  height: 4000,
  grid: 40
};

const VIEW = {
  width: 800,
  height: 600,
  scale: 1
};

const MINIMAP = {
  scale: 0.15,
  alpha: 0.65,
  margin: 12
};

const map = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(0));
const fruits = ref(new Set());
const props = ref({
  speedUp: new Set(),
  speedDown: new Set(),
  revealAll: new Set(),
  fog: new Set(),
});

const changeIntoProps = {
  3: 'speedUp',
  4: 'speedDown',
  5: 'revealAll',
  6: 'fog'
};

let appleImg;
let speedUpImg;
let speedDownImg;
let revealAllImg;
let fogImg;
let emoji1Img;
let emoji2Img;
let emoji3Img;
let emoji4Img;
const roomEmojis = ref([]);
const MAX_EMOJI_COUNT = 5;

const snakes = ref(Array.from({ length: 7 }, () => ({
  body: [],
  direction: null,
  directionNext: null,
  alive: true,
  respawnTimer: 0,
  changeDirTimer: 0,
  dir: { x: 0, y: 0 },
  moveInterval: 2,
  moveCounter: 0,
  propsTimer: { speedUp: 0, speedDown: 0, revealAll: 0, fog: 0 },
  type: 'ai',
  ownerUserCode: null,
  revealAllTimer: 0,
  fogTimer: 0
})));

let myIndex = null;
let myUserCode;
let currentRoomCode = null;
const countdownSeconds = ref(0);
const countdownText = ref('00:00');
let lastOnlineMessageAt = 0;
let pendingRoomState = null;
let pendingRoomDelta = null;
let hasRoomSnapshot = false;
let onlineRenderRafId = null;
let onlineResyncTimerId = null;

const DELTA_STALE_MS = 1500;

function getAppLeft() {
  return document.getElementById('app').getBoundingClientRect().left;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function initAssets() {
  appleImg = await loadImage('/images/apple.png');
  fogImg = await loadImage('/images/fog.png');
  revealAllImg = await loadImage('/images/revealAll.png');
  speedUpImg = await loadImage('/images/speedUp.png');
  speedDownImg = await loadImage('/images/speedDown.png');
  emoji1Img = await loadImage('/images/smile.png');
  emoji2Img = await loadImage('/images/cry.png');
  emoji3Img = await loadImage('/images/annoy.png');
  emoji4Img = await loadImage('/images/puzzle.png');
}

function resizeCanvas() {
  if (!canvas.value || !fogCanvas.value) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  VIEW.width = w;
  VIEW.height = h;
  canvas.value.width = w;
  canvas.value.height = h;
  fogCanvas.value.width = w;
  fogCanvas.value.height = h;
}

function goHome() {
  sendLeaveRoom();
  unregisterPageHandler('online');
  router.push("/");
}

function onClose() {
  // 标记需要重新初始化，下次 snapshot 会重建状态
  hasRoomSnapshot = false;
  pendingRoomState = null;
  pendingRoomDelta = null;
}

function scheduleOnlineRender() {
  if (onlineRenderRafId != null) return;
  onlineRenderRafId = window.requestAnimationFrame(() => {
    onlineRenderRafId = null;
    const roomState = pendingRoomState;
    const roomDelta = pendingRoomDelta;
    pendingRoomState = null;
    pendingRoomDelta = null;
    // snapshot 优先应用（建立基线状态），然后叠加 delta
    if (roomState) applyRoomState(roomState);
    if (roomDelta) applyRoomDelta(roomDelta);
    render();
  });
}

function onlineHandler(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'room_snapshot') {
    lastOnlineMessageAt = Date.now();
    pendingRoomState = msg.data;
    pendingRoomDelta = null; // snapshot 覆盖任何待处理的 delta
    scheduleOnlineRender();
    return;
  }

  if (msg.type === 'room_delta') {
    lastOnlineMessageAt = Date.now();
    if (!hasRoomSnapshot) {
      // 如果还没应用快照，忽略增量（保持现有逻辑）
      return;
    }
    pendingRoomDelta = msg.data;
    scheduleOnlineRender();
    return;
  }

}

function applyRoomState(roomState) {
  if (!roomState) return;

  hasRoomSnapshot = true;
  myIndex = null;

  // 1. 房间基础信息
  currentRoomCode = roomState.roomCode;
  if (roomState.status) {
    if (roomState.status === 'playing' && gameState.value !== 'paused') {
      gameState.value = 'playing';
    } else if (roomState.status === 'finished') {
      gameState.value = 'gameOver';
    }
  }

  // 2. 倒计时
  if (roomState.countdownMin != null && roomState.countdownSecond != null) {
    const totalSeconds = roomState.countdownMin * 60 + roomState.countdownSecond;
    countdownSeconds.value = totalSeconds;
    countdownText.value = formatCountdown(totalSeconds);
  }

  const isGameOver = roomState.status === 'finished'
      || (roomState.status === 'waiting' && countdownSeconds.value === 0);

  // 3. 地图
  if (Array.isArray(roomState.map)) {
    for (let i = 0; i < MAP_SIZE; i++) {
      for (let j = 0; j < MAP_SIZE; j++) {
        map[i][j] = roomState.map[i][j];
      }
    }
  }

  // 4. 水果
  fruits.value = new Set(roomState.fruits || []);

  // 5. 道具
  props.value.speedUp = new Set(roomState.speedUp || []);
  props.value.speedDown = new Set(roomState.speedDown || []);
  props.value.revealAll = new Set(roomState.revealAll || []);
  props.value.fog = new Set(roomState.fog || []);

  // 6. 表情包
  roomEmojis.value = Array.isArray(roomState.roomEmojis)
      ? roomState.roomEmojis.slice(-MAX_EMOJI_COUNT)
      : [];

  // 7. 蛇
  const serverSnakes = roomState.snakes || [];
  const newSnakes = Array.from({ length: serverSnakes.length }, () => ({
    body: [],
    alive: false,
    ownerUserCode: null
  }));

  for (let i = 0; i < serverSnakes.length; i++) {
    const s = serverSnakes[i] || {};

    newSnakes[i] = {
      body: Array.isArray(s.body)
          ? s.body.map(node => ({
            x: node.x ?? 0,
            y: node.y ?? 0
          }))
          : [],
      alive: !!s.alive,
      emojiTimer: s.emojiTimer ?? 0,
      revealAllTimer: s.revealAllTimer ?? 0,
      fogTimer: s.fogTimer ?? 0,
      ownerUserCode: s.ownerUserCode ?? null,
      maxLength: s.maxLength ?? 0,
      type: s.type ?? 'ai'
    };
    if (String(newSnakes[i].ownerUserCode) === String(myUserCode)) {
      myIndex = i;
    }
  }

  snakes.value = newSnakes;

  // 8. 找到自己的蛇
  if (isGameOver) {
    gameState.value = 'gameOver';
    if (myIndex != null && snakes.value[myIndex]) {
      const mySnake = snakes.value[myIndex];
      mySnakeLength.value = mySnake.body.length > 0 ? mySnake.body.length : lastAliveSnakeLength.value;
      maxLength.value = mySnake.maxLength ?? 0;
    }
  } else if (myIndex != null && snakes.value[myIndex]) {
    const mySnake = snakes.value[myIndex];
    if (mySnake.alive === false) {
      gameState.value = 'gameFinished';
      mySnakeLength.value = mySnake.body.length > 0 ? mySnake.body.length : lastAliveSnakeLength.value;
    } else {
      lastAliveSnakeLength.value = mySnake.body.length;
      mySnakeLength.value = mySnake.body.length;
    }
    maxLength.value = mySnake.maxLength ?? 0;
  } else {
  }
}

function applyRoomDelta(roomDelta) {
  if (!roomDelta) return;

  if (roomDelta.status) {
    if (roomDelta.status === 'playing' && gameState.value !== 'paused') {
      gameState.value = 'playing';
    } else if (roomDelta.status === 'finished') {
      gameState.value = 'gameOver';
    }
  }

  if (roomDelta.remainingSeconds != null) {
    const nextSeconds = Math.max(0, Number(roomDelta.remainingSeconds) || 0);
    countdownSeconds.value = nextSeconds;
    countdownText.value = formatCountdown(nextSeconds);
  }

  if (Array.isArray(roomDelta.roomEmojis)) {
    roomEmojis.value = roomDelta.roomEmojis.slice(-MAX_EMOJI_COUNT);
  }

  patchPointSet(fruits.value, roomDelta.fruitAdded, roomDelta.fruitRemoved);
  patchPointSet(props.value.speedUp, roomDelta.speedUpAdded, roomDelta.speedUpRemoved);
  patchPointSet(props.value.speedDown, roomDelta.speedDownAdded, roomDelta.speedDownRemoved);
  patchPointSet(props.value.revealAll, roomDelta.revealAllAdded, roomDelta.revealAllRemoved);
  patchPointSet(props.value.fog, roomDelta.fogAdded, roomDelta.fogRemoved);

  const deltaSnakes = roomDelta.snakeDeltas || [];
  const removedFruitKeys = new Set((roomDelta.fruitRemoved || []).map(pointToKey));

  for (let i = 0; i < deltaSnakes.length; i++) {
    const delta = deltaSnakes[i];
    if (!delta) continue;

    // Prefer server-provided snakeIndex to avoid sparse-delta index skew.
    const targetIndex = Number.isInteger(delta.snakeIndex) ? delta.snakeIndex : i;
    if (targetIndex < 0 || targetIndex >= snakes.value.length) {
      continue;
    }

    applySnakeDelta(snakes.value[targetIndex], delta, removedFruitKeys);
  }

  myIndex = snakes.value.findIndex(s => String(s.ownerUserCode) === String(myUserCode));
  if (myIndex != null && myIndex >= 0 && snakes.value[myIndex]) {
    const mySnake = snakes.value[myIndex];
    if (mySnake.alive === false) {
      gameState.value = 'gameFinished';
      mySnakeLength.value = mySnake.body.length > 0 ? mySnake.body.length : lastAliveSnakeLength.value;
    } else {
      // 复活后恢复到游戏中状态，避免一直停留在死亡面板
      if (gameState.value === 'gameFinished') {
        gameState.value = 'playing';
      }
      lastAliveSnakeLength.value = mySnake.body.length;
      mySnakeLength.value = mySnake.body.length;
    }
    maxLength.value = mySnake.maxLength ?? maxLength.value;
  }
}

function patchPointSet(targetSet, addedList, removedList) {
  if (!targetSet) return;
  if (Array.isArray(removedList)) {
    for (const point of removedList) {
      targetSet.delete(pointToKey(point));
    }
  }
  if (Array.isArray(addedList)) {
    for (const point of addedList) {
      targetSet.add(pointToKey(point));
    }
  }
}

function pointToKey(point) {
  if (!point) return '';
  return `${point.x ?? 0},${point.y ?? 0}`;
}

function applySnakeDelta(snake, delta, removedFruitKeys = new Set()) {
  if (!snake || !delta) return;

  if (!Array.isArray(snake.body)) {
    snake.body = [];
  }

  if (delta.ownerUserCode !== undefined) {
    if (delta.ownerUserCode !== null) {
      snake.ownerUserCode = delta.ownerUserCode;
    } else {
      if (delta.deltaType === 'RELEASE' || delta.deltaType === 'DIE') {
        snake.ownerUserCode = null;
      }
    }
  }
  if (delta.alive !== undefined) {
    snake.alive = !!delta.alive;
  }

  if (delta.revealAllTimer !== undefined && delta.revealAllTimer !== null) {
    snake.revealAllTimer = delta.revealAllTimer;
  }
  if (delta.fogTimer !== undefined && delta.fogTimer !== null) {
    snake.fogTimer = delta.fogTimer;
  }
  if (delta.maxLength !== undefined && delta.maxLength !== null) {
    snake.maxLength = delta.maxLength;
  }

  const hasBody = Array.isArray(delta.body) && delta.body.length > 0;
  if (hasBody) {
    snake.body = delta.body.map(node => ({
      x: node.x ?? 0,
      y: node.y ?? 0
    }));
  } else if (delta.deltaType === 'MOVE' && delta.head) {
    const nextHead = { x: delta.head.x ?? 0, y: delta.head.y ?? 0 };
    const headKey = pointToKey(nextHead);
    if (!removedFruitKeys.has(headKey) && snake.body.length > 0) {
      snake.body.pop();
    }
    snake.body.unshift(nextHead);
  } else if (delta.deltaType === 'RELEASE') {
    snake.alive = false;
  }

  if (delta.deltaType === 'DIE') {
    snake.alive = false;
  }
}

function initGame() {
  hasRoomSnapshot = false;
  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      map[row][col] = 0;
    }
  }
  fruits.value.clear();
  props.value.speedUp.clear();
  props.value.speedDown.clear();
  props.value.revealAll.clear();
  props.value.fog.clear();
}

function initWall(cameraX, cameraY) {
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.strokeRect(-cameraX, -cameraY, WORLD.width, WORLD.height);
}

function getSnakeColor(snake) {
  // 自己 → 绿色，真人玩家 → 蓝色，人机 → 红色
  if (String(snake.ownerUserCode) === String(myUserCode)) return '#4caf50'; // green: self
  if (snake.type === 'human') return '#2196f3'; // blue: other human players
  return '#f44336'; // red: AI
}

function drawSnake(targetCtx, cameraX, cameraY) {
  if (!targetCtx) return;

  for (let i = 0; i < snakes.value.length; i++) {
    const snake = snakes.value[i];
    if (!snake.alive || !snake.body || snake.body.length === 0) continue;

    targetCtx.fillStyle = getSnakeColor(snake);

    for (const seg of snake.body) {
      targetCtx.fillRect(
          (seg.x * WORLD.grid - WORLD.grid / 2 - cameraX) - 15,
          (seg.y * WORLD.grid - WORLD.grid / 2 - cameraY) - 15,
          30, 30
      );
    }
  }
}

function drawFruits(cameraX, cameraY) {
  for (const pos of fruits.value) {
    const [x, y] = pos.split(',').map(Number);
    if ((x - 1) * WORLD.grid < cameraX + VIEW.width && x * WORLD.grid > cameraX &&
        (y - 1) * WORLD.grid < cameraY + VIEW.height && y * WORLD.grid > cameraY) {
      ctx.drawImage(
          appleImg,
          x * WORLD.grid - WORLD.grid / 2 - cameraX - 12.5,
          y * WORLD.grid - WORLD.grid / 2 - cameraY - 12.5,
          25, 25
      );
    }
  }
}

function drawProps(cameraX, cameraY) {
  const colors = [speedUpImg, speedDownImg, revealAllImg, fogImg];
  for (let i = 0; i < 4; i++) {
    const setName = changeIntoProps[i + 3];
    for (const pos of props.value[setName]) {
      const [x, y] = pos.split(',').map(Number);
      if ((x - 1) * WORLD.grid < cameraX + VIEW.width && x * WORLD.grid > cameraX &&
          (y - 1) * WORLD.grid < cameraY + VIEW.height && y * WORLD.grid > cameraY) {
        ctx.drawImage(
            colors[i],
            x * WORLD.grid - WORLD.grid / 2 - cameraX - 12.5,
            y * WORLD.grid - WORLD.grid / 2 - cameraY - 12.5,
            25, 25
        );
      }
    }
  }
}

function hasRevealAll() {
  const myIndex = snakes.value.findIndex(s => String(s.ownerUserCode) === String(myUserCode));
  if (myIndex < 0) return false;
  return (snakes.value[myIndex].revealAllTimer ?? 0) > 0;
}

function hasFog() {
  const myIndex = snakes.value.findIndex(s => String(s.ownerUserCode) === String(myUserCode));
  if (myIndex < 0) return false;
  return (snakes.value[myIndex].fogTimer ?? 0) > 0;
}

function drawMinimap() {
  const size = VIEW.height / 4;
  const mapW = WORLD.width;
  const mapH = WORLD.height;

  const scaleX = size / mapW;
  const scaleY = size / mapH;
  const scale = Math.min(scaleX, scaleY);

  const miniW = mapW * scale;
  const miniH = mapH * scale;

  const x0 = MINIMAP.margin;
  const y0 = MINIMAP.margin;

  ctx.save();
  ctx.globalAlpha = MINIMAP.alpha;

  ctx.fillStyle = '#111';
  ctx.fillRect(x0, y0, miniW, miniH);

  const showAll = hasRevealAll();

  for (let i = 0; i < snakes.value.length; i++) {
    const snake = snakes.value[i];
    if (!snake.alive || !snake.body || snake.body.length === 0) continue;

    // 没有 revealAll 效果时，小地图只显示自己的蛇
    if (!showAll && String(snake.ownerUserCode) !== String(myUserCode)) continue;

    const head = snake.body[0];
    let color = getSnakeColor(snake);

    ctx.fillStyle = color;
    const px = x0 + head.x * WORLD.grid * scale;
    const py = y0 + head.y * WORLD.grid * scale;

    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, miniW, miniH);

  ctx.restore();
}

function drawEmojiPanel() {
  if (!ctx) return;

  const startX = 20;
  const startY = 300;
  const lineHeight = 42;
  const panelWidth = 260;
  const iconSize = 28;

  ctx.save();
  ctx.globalAlpha = 0.78;

  // 背景框（动态高度，按实际条目数）
  const list = roomEmojis.value.slice(-MAX_EMOJI_COUNT); // 先来在上，后来在下（不 reverse）
  const panelHeight = list.length > 0 ? lineHeight * list.length + 20 : 0;
  if (panelHeight > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(startX - 10, startY - 20, panelWidth, panelHeight);
  }

  ctx.font = '16px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const y = startY + i * lineHeight;

    // 昵称
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`${item.nickname}：`, startX, y + iconSize / 2);

    // 表情图片
    const img = getEmojiImg(item.emojiId);
    if (img) {
      ctx.drawImage(img, startX + 72, y, iconSize, iconSize);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`[${item.emojiId}]`, startX + 72, y + iconSize / 2);
    }
  }

  ctx.restore();
}

function drawEmojiHints() {
  if (!ctx) return;

  const myIndex = snakes.value.findIndex(s => String(s.ownerUserCode) === String(myUserCode));
  if (myIndex < 0) return;

  const mySnake = snakes.value[myIndex];
  const emojiTimer = mySnake.emojiTimer ?? 0;

  const baseX = 20;
  const baseY = VIEW.height - 50;
  const gapX = 52;
  const iconSize = 24;

  const items = [
    { id: 1, img: emoji1Img },
    { id: 2, img: emoji2Img },
    { id: 3, img: emoji3Img },
    { id: 4, img: emoji4Img }
  ];

  ctx.save();
  ctx.font = '13px sans-serif';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < items.length; i++) {
    const x = baseX + i * gapX;
    const item = items[i];

    const active = emojiTimer === 0;
    ctx.globalAlpha = active ? 0.9 : 0.18;

    // 序号
    ctx.fillStyle = '#fff';
    ctx.fillText(`${item.id}.`, x, baseY + iconSize / 2);

    // 表情图片
    if (item.img) {
      ctx.drawImage(item.img, x + 14, baseY, iconSize, iconSize);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function renderFog() {
  const myIndex = snakes.value.findIndex(s => String(s.ownerUserCode) === String(myUserCode));
  if (myIndex < 0) return;

  const mySnake = snakes.value[myIndex];
  if (!mySnake.body || mySnake.body.length === 0) return;

  fogCtx.clearRect(0, 0, VIEW.width, VIEW.height);
  const head = mySnake.body[0];
  const cameraX = head.x * WORLD.grid - (VIEW.width / 2) / VIEW.scale + getAppLeft();
  const cameraY = head.y * WORLD.grid - (VIEW.height / 2) / VIEW.scale;

  const hx = head.x * WORLD.grid - cameraX;
  const hy = head.y * WORLD.grid - cameraY;

  const innerRadius = 100;
  const outerRadius = 220;

  fogCtx.save();
  fogCtx.fillStyle = 'black';
  fogCtx.fillRect(0, 0, VIEW.width, VIEW.height);

  fogCtx.globalCompositeOperation = 'destination-out';
  fogCtx.beginPath();
  fogCtx.arc(hx, hy, outerRadius, 0, Math.PI * 2);
  fogCtx.fill();

  fogCtx.globalCompositeOperation = 'source-over';
  const grad = fogCtx.createRadialGradient(hx, hy, innerRadius, hx, hy, outerRadius);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  fogCtx.fillStyle = grad;
  fogCtx.beginPath();
  fogCtx.arc(hx, hy, outerRadius, 0, Math.PI * 2);
  fogCtx.fill();

  fogCtx.restore();
}

function render() {
  const renderStart = performance.now();
  const renderMyIndex = snakes.value.findIndex(s => String(s.ownerUserCode) === String(myUserCode));
  const targetSnake = renderMyIndex >= 0 ? snakes.value[renderMyIndex] : snakes.value[0];

  let cameraX = (WORLD.width - VIEW.width / VIEW.scale) / 2 + getAppLeft();
  let cameraY = (WORLD.height - VIEW.height / VIEW.scale) / 2;
  if (targetSnake && targetSnake.body && targetSnake.body.length > 0) {
    const head = targetSnake.body[0];
    cameraX = head.x * WORLD.grid - (VIEW.width / 2) / VIEW.scale + getAppLeft();
    cameraY = head.y * WORLD.grid - (VIEW.height / 2) / VIEW.scale;
  }

  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  fogCtx.clearRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = 'grey';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  initWall(cameraX, cameraY);
  drawFruits(cameraX, cameraY);
  drawProps(cameraX, cameraY);
  drawSnake(ctx, cameraX, cameraY);
  drawMinimap();
  drawEmojiPanel();
  drawEmojiHints();

  if (hasFog()) {
    renderFog();
    drawSnake(fogCtx, cameraX, cameraY);
  }

}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  // 退出确认面板
  if (key === 'escape') {
    if (gameState.value === 'playing') {
      gameState.value = 'paused';
    } else if (gameState.value === 'paused') {
      gameState.value = 'playing';
    }
    return;
  }

  if (gameState.value !== 'playing') {
    if ((key === 'enter' || key === ' ') && gameState.value === 'paused') {
      // 确认退出：通知后端离开房间
        sendLeaveRoom();
      goHome();
    }
    return;
  }

  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    sendKeyInput(key);
  }
  if(key === '1' || key === '2' || key === '3' || key === '4') {
    sendEmoji(Number(key));
  }
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function getEmojiImg(emojiId) {
  switch (emojiId) {
    case 1: return emoji1Img;
    case 2: return emoji2Img;
    case 3: return emoji3Img;
    case 4: return emoji4Img;
    default: return null;
  }
}

onMounted(async () => {
  myUserCode = sessionStorage.getItem('userCode');
  currentRoomCode = sessionStorage.getItem("roomCode");

  // Phase 1: Canvas 初始化（同步 — onMounted 中 refs 已就绪）
  ctx = canvas.value.getContext('2d');
  fogCtx = fogCanvas.value.getContext('2d');
  resizeCanvas();

  // Phase 2: WS 状态 & 游戏初始化（同步 — 必须在任何 await 之前完成，
  // 防止 WS onopen / snapshot 在异步间隙到达时状态未就绪）
  setCurrentPageType('online');
  setCurrentRoomCode(Number(currentRoomCode));
  registerPageHandler('online', onlineHandler);
  initGameWs({ onOpen: null, onClose, onError: null });
  initGame();

  // Phase 3: 异步加载图片（期间 WS 事件可能触发，render 会正确绘制）
  await initAssets();

  // Phase 4: 同步服务器 & 事件监听
  syncCurrentPageToServer('online');

  onlineResyncTimerId = window.setInterval(() => {
    if (!hasRoomSnapshot) return;
    if (gameState.value !== 'playing') return;

    const now = Date.now();
    if (now - lastOnlineMessageAt > DELTA_STALE_MS) {
      // staleness detected; future: trigger resync
    }
  }, 500);

  // 强制请求最新房间状态，防止 prepare→online 切换时丢失 snapshot
    setTimeout(() => {
      if (!hasRoomSnapshot) {
        syncCurrentPageToServer('online');
      }
    }, 500);

  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas);
  document.removeEventListener('keydown', handleKeydown);
  if (onlineRenderRafId != null) {
    window.cancelAnimationFrame(onlineRenderRafId);
    onlineRenderRafId = null;
  }
  if (onlineResyncTimerId != null) {
    window.clearInterval(onlineResyncTimerId);
    onlineResyncTimerId = null;
  }
  unregisterPageHandler('online');
});
</script>

<style>
html, body, #app {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>

<style scoped>
.game-wrap {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.game-stage {
  position: absolute;
  inset: 0;
}

.world,
.fog {
  position: absolute;
  left: 0;
  top: 0;
}

.world {
  z-index: 1;
}

.fog {
  z-index: 2;
  pointer-events: none;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.60);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  animation: overlayFadeIn 0.25s ease;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.panel {
  width: 320px;
  padding: 28px 24px;
  background: rgba(24, 28, 36, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 20px;
  color: #e2e8f0;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04);
  animation: panelSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes panelSlideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.panel h2 {
  margin: 0 0 16px;
  color: #f1f5f9;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.panel p {
  margin: 8px 0 20px;
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.6;
}

.panel button {
  display: block;
  width: 100%;
  margin: 10px 0;
  padding: 12px 16px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.30);
}
.panel button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.40);
}
.panel button:active {
  transform: translateY(0);
}

.countdown {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  color: rgba(255, 255, 255, 0.55);
  font-size: 38px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  pointer-events: none;
  user-select: none;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.50);
  letter-spacing: 0.04em;
}
</style>