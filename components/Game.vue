<template>
  <div class="game-wrap">
    <canvas ref="canvas"></canvas>

    <!-- 暂停面板 -->
    <div v-show="gameState === 'paused'" class="overlay">
      <div class="panel">
        <h2>游戏暂停</h2>
        <button @click="resumeGame">继续游戏</button>
        <button @click="restartGame">重新开始</button>
        <button @click="goHome">返回主页</button>
      </div>
    </div>

    <!-- 结束面板 -->
    <div v-show="gameState === 'gameOver'" class="overlay">
      <div class="panel">
        <h2>游戏结束</h2>
        <p>当前长度：{{ snake.body.length }}</p>
        <p>最大长度：{{maxLength}}</p>
        <button @click="restartGame">重新开始</button>
        <button @click="goHome">返回主页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import router from "../router/index.js";
import {submitLength} from "../utils/auth.js";

const canvas = ref(null);
const direction = ref(null);
const directionNext = ref(null);
const maxLength = ref(0);
const fruits = new Set();
const gameState = ref('playing')  // playing | paused | gameOver
let ctx;
// let animationId;
let timeOutId;
const map = Array.from({ length: 102 }, () => Array(102).fill(0))
const MAP_SIZE = 102;
// ====== 战场配置 ======
const WORLD = {
  width: 4000,   // 世界宽（逻辑坐标）
  height: 4000,  // 世界高
  grid: 40       // 网格大小（逻辑格）
};

// ====== 相机配置 ======
const VIEW = {
  width: 800,   // 视窗宽（像素）
  height: 600,  // 视窗高（像素）
  scale: 1      // 缩放倍率（以后可调）
};

// ====== 蛇状态（暂时演示）======
let snake = {
  body: [],
  dir: { x: 0, y: 0 },
  speed: 1 // 速度（逻辑坐标/帧）
};

function resumeGame() {
  if (gameState.value === 'paused') {
    gameState.value = 'playing';
  }
}

function restartGame() {
  clearTimeout(timeOutId);
  initGame();
  gameState.value = 'playing';
  loop();
}

function goHome() {
  clearTimeout(timeOutId);
  router.push('/')
}

async function updateMaxLength() {
  try {
    const data = await submitLength(snake.body.length);
    maxLength.value = data.maxLength;
  } catch (err) {
    console.error(err);
  }
}
function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  VIEW.width = w;
  VIEW.height = h;
  canvas.value.width = w;
  canvas.value.height = h;
}

function drawGrid(cameraX, cameraY) {
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;

  const startX = Math.floor(cameraX / WORLD.grid) * WORLD.grid;
  const startY = Math.floor(cameraY / WORLD.grid) * WORLD.grid;

  for (let x = startX; x < cameraX + VIEW.width / VIEW.scale; x += WORLD.grid) {
    ctx.beginPath();
    ctx.moveTo(x - cameraX, -cameraY);
    ctx.lineTo(x - cameraX, WORLD.height - cameraY);
    ctx.stroke();
  }

  for (let y = startY; y < cameraY + VIEW.height / VIEW.scale; y += WORLD.grid) {
    ctx.beginPath();
    ctx.moveTo(-cameraX, y - cameraY);
    ctx.lineTo(WORLD.width - cameraX, y - cameraY);
    ctx.stroke();
  }
}

function drawSnake(cameraX, cameraY) {
  ctx.fillStyle = '#4caf50';
  for (const seg of snake.body) {
    ctx.fillRect(
        (seg.x * WORLD.grid - WORLD.grid/2 - cameraX) - 15,
        (seg.y * WORLD.grid - WORLD.grid/2 - cameraY) - 15,
        30, 30
    );
  }
}

function drawFruits(cameraX, cameraY) {
  ctx.fillStyle = 'blue';
  for (const pos of fruits) {
    const [x, y] = pos.split(',').map(Number)
    if((x-1) * WORLD.grid < cameraX + VIEW.width && x * WORLD.grid > cameraX
        && (y-1) * WORLD.grid < cameraY + VIEW.height && y * WORLD.grid > cameraY) {
      ctx.fillRect(
          x * WORLD.grid - WORLD.grid/2 - cameraX -12.5,
          y * WORLD.grid - WORLD.grid/2 - cameraY -12.5,
          25,25
      );
    }
  }
}

function updateSnake() {
  const head = snake.body[0];
  if(directionNext.value === 'up'){snake.dir.x = 0;snake.dir.y = -1;direction.value = directionNext.value;}
  else if(directionNext.value === 'down'){snake.dir.x = 0;snake.dir.y = 1;direction.value = directionNext.value;}
  else if(directionNext.value === 'left'){snake.dir.x = -1;snake.dir.y = 0;direction.value = directionNext.value;}
  else if(directionNext.value === 'right'){snake.dir.x = 1;snake.dir.y = 0;direction.value = directionNext.value;}
  if(snake.dir.x === 0&&snake.dir.y === 0){return true;}
  const newHead = {
    x: head.x + snake.dir.x * snake.speed,    //调整x方向
    y: head.y + snake.dir.y * snake.speed     //调整y方向
  };
  if(map[newHead.x][newHead.y] === 1)return false;
  else if(map[newHead.x][newHead.y] === 2){
    map[newHead.x][newHead.y] = 1;
    fruits.delete(`${newHead.x},${newHead.y}`)
    makeFruit();
  }
  else if(map[newHead.x][newHead.y] === 0){
    map[snake.body[snake.body.length -1].x][snake.body[snake.body.length -1].y] = 0;
    map[newHead.x][newHead.y] = 1;
    snake.body.pop();
  }
  snake.body.unshift(newHead);
  return true;
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    if (gameState.value === 'playing') {
      gameState.value = 'paused';
    } else if (gameState.value === 'paused') {
      gameState.value = 'playing';
    }
  }
  let newDirection = null;
  if (key === 'w') newDirection = 'up';
  else if (key === 's') newDirection = 'down';
  else if (key === 'a') newDirection = 'left';
  else if (key === 'd') newDirection = 'right';

  if (!newDirection) return

  // 防止反向
  const opposite = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  }

  if (newDirection === opposite[direction.value]) return

  directionNext.value = newDirection
}

function randomPlace() {
  let location = {}
  do{
    location.x = Math.floor(Math.random() * 100) + 1;
    location.y = Math.floor(Math.random() * 100) + 1;
  }while(map[location.x][location.y] !== 0)
  return location;
}

function initSnake() {
  let location = randomPlace();
  snake.body = [
    { x: location.x, y: location.y }
  ];
  map[location.x][location.y] = 1;
}

function makeFruit() {
  let location = randomPlace();
  map[location.x][location.y] = 2;
  fruits.add(`${location.x},${location.y}`)
}

function initGame() {
  for (let row = 0; row < MAP_SIZE; row++) {
    map[row].fill(0);
  }
  for (let i = 0; i < MAP_SIZE; i++) {
    map[0][i] = 1;
    map[MAP_SIZE - 1][i] = 1;
    map[i][0] = 1;
    map[i][MAP_SIZE - 1] = 1;
  }
  initSnake();
  fruits.clear();
  for (let x = 0; x < 500; x++) {
    makeFruit();
  }
}

function render() {
  const head = snake.body[0];
  const cameraX = head.x * WORLD.grid - (VIEW.width / 2) / VIEW.scale;
  const cameraY = head.y * WORLD.grid - (VIEW.height / 2) / VIEW.scale;

  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = 'grey';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  drawFruits(cameraX, cameraY);
  drawSnake(cameraX, cameraY);
}

function loop() {
  try {
    if (gameState.value === 'playing') {
      if (updateSnake() === false) {
        gameState.value = 'gameOver';
        updateMaxLength();
        clearTimeout(timeOutId);
        render();
        return;
      }
    }

    render();
    timeOutId = setTimeout(loop, 300);
  } catch (err) {
    console.error('loop error:', err);
    clearTimeout(timeOutId);
  }
}

onMounted(() => {
  ctx = canvas.value.getContext('2d');
  resizeCanvas();
  initGame();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', handleKeydown);
  loop();
});

onBeforeUnmount(() => {
  clearTimeout(timeOutId)
  // cancelAnimationFrame(animationId);
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', handleKeydown)
});
</script>

<style scoped>
.game-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
canvas {
  display: block;
  background: #111;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.panel {
  width: 260px;
  padding: 20px;
  background: #222;
  border: 1px solid #444;
  border-radius: 12px;
  color: #fff;
  text-align: center;
}

.panel h2 {
  margin: 0 0 12px;
  color: #fff;
}

.panel p {
  margin: 8px 0 16px;
}

.panel button {
  display: block;
  width: 100%;
  margin: 8px 0;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: #4caf50;
  color: white;
  cursor: pointer;
}

.panel button:hover {
  background: #43a047;
}
</style>