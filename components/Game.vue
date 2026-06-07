<template>
  <div class="game-wrap">
    <div class="game-stage">
      <canvas ref="canvas" class="world"></canvas>
      <canvas ref="fogCanvas" class="fog"></canvas>
    </div>

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
        <p>当前长度：{{ snakes[0].body.length }}</p>
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
import {submitLength} from "../utils/api.js";
import {registerPageHandler, syncCurrentPageToServer, setCurrentPageType, unregisterPageHandler} from "../utils/ws/index.js";

const canvas = ref(null);
const fogCanvas = ref(null);
let fogCtx;
const maxLength = ref(0);
const fruits = new Set();
let fruitCount = 500;
const props = {
  speedUp: new Set(),   //3
  speedDown: new Set(),   //4
  revealAll: new Set(),   //5
  fog: new Set(),   //6
};
const changeIntoProps = {
  3 : 'speedUp',
  4 : 'speedDown',
  5 : 'revealAll',
  6 : 'fog'
};
let propsCount = [5,5,5,5];//道具
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
// ====== 小地图配置 ======
const MINIMAP = {
  scale: 0.15,       // 缩小比例，可按需要调
  alpha: 0.65,       // 透明度
  margin: 12,        // 距离左上角边距
};
let otherSnakeShow = false;
let fogShow = false;
let appleImg;
let speedUpImg;
let speedDownImg;
let revealAllImg;
let fogImg;

async function initAssets() {
  appleImg = await loadImage('/images/apple.png');
  fogImg = await loadImage('/images/fog.png');
  revealAllImg = await loadImage('/images/revealAll.png');
  speedUpImg = await loadImage('/images/speedUp.png');
  speedDownImg = await loadImage('/images/speedDown.png');
}

// ====== 蛇状态======
const snakeCount = 7;
const propsTime = 8;
let snakes = Array.from({ length: snakeCount }, () => ({
  body: [],
  direction: null,
  directionNext: null,
  alive: true,
  respawnTimer: 0,
  changeDirTimer: 0,
  dir: { x: 0, y: 0 },
  moveInterval: 2,
  moveCounter:0,
  propsTimer: {  speedUp: 0, speedDown: 0, revealAll: 0, fog: 0}  //加速、减速、全屏、致盲
}));

function getAppLeft() {
  return document.getElementById('app').getBoundingClientRect().left;
}

function gameHandler() {}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

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
  router.back();
}

function onOpen(){
}
function onClose(){
}
function onError(){
}

async function updateMaxLength() {
  try {
    const data = await submitLength(snakes[0].body.length);
    maxLength.value = data.maxLength;
  } catch (err) {
  }
}

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  VIEW.width = w;
  VIEW.height = h;
  canvas.value.width = w;
  canvas.value.height = h;
  fogCanvas.value.width = w;
  fogCanvas.value.height = h;
}

// function drawGrid(cameraX, cameraY) {
//   ctx.strokeStyle = '#222';
//   ctx.lineWidth = 1;
//
//   const startX = Math.floor(cameraX / WORLD.grid) * WORLD.grid;
//   const startY = Math.floor(cameraY / WORLD.grid) * WORLD.grid;
//
//   for (let x = startX; x < cameraX + VIEW.width / VIEW.scale; x += WORLD.grid) {
//     ctx.beginPath();
//     ctx.moveTo(x - cameraX, -cameraY);
//     ctx.lineTo(x - cameraX, WORLD.height - cameraY);
//     ctx.stroke();
//   }
//
//   for (let y = startY; y < cameraY + VIEW.height / VIEW.scale; y += WORLD.grid) {
//     ctx.beginPath();
//     ctx.moveTo(-cameraX, y - cameraY);
//     ctx.lineTo(WORLD.width - cameraX, y - cameraY);
//     ctx.stroke();
//   }
// }

function initWall(cameraX, cameraY) {
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.strokeRect(-cameraX, -cameraY, WORLD.width, WORLD.height);
}

function drawSnake(cameraX, cameraY) {
  ctx.fillStyle = '#4caf50';
  for (let i = 0; i < snakeCount; i++) {
    for (const seg of snakes[i].body) {
      ctx.fillRect(
          (seg.x * WORLD.grid - WORLD.grid/2 - cameraX) - 15,
          (seg.y * WORLD.grid - WORLD.grid/2 - cameraY) - 15,
          30, 30
      );
    }
  }
}

function drawFruits(cameraX, cameraY) {
  for (const pos of fruits) {
    const [x, y] = pos.split(',').map(Number)
    if((x-1) * WORLD.grid < cameraX + VIEW.width && x * WORLD.grid > cameraX
        && (y-1) * WORLD.grid < cameraY + VIEW.height && y * WORLD.grid > cameraY) {
      ctx.drawImage(appleImg, x * WORLD.grid - WORLD.grid/2 - cameraX -12.5, y * WORLD.grid - WORLD.grid/2 - cameraY -12.5, 25, 25);
    }
  }
}

function drawProps(cameraX, cameraY) {
  const colors = [speedUpImg,speedDownImg,revealAllImg,fogImg];
  for(let i = 0; i < 4; i++) {
    for (const pos of props[changeIntoProps[i+3]]) {
      const [x, y] = pos.split(',').map(Number)
      if((x-1) * WORLD.grid < cameraX + VIEW.width && x * WORLD.grid > cameraX
          && (y-1) * WORLD.grid < cameraY + VIEW.height && y * WORLD.grid > cameraY) {
        ctx.drawImage(colors[i], x * WORLD.grid - WORLD.grid/2 - cameraX -12.5, y * WORLD.grid - WORLD.grid/2 - cameraY -12.5, 25, 25);
      }
    }
  }

}

function drawMinimap() {
  const size = VIEW.height / 4; // 边长 = 相机高度四分之一
  const mapW = WORLD.width;
  const mapH = WORLD.height;

  const scaleX = size / mapW;
  const scaleY = size / mapH;
  const scale = Math.min(scaleX, scaleY);

  const miniW = mapW * scale;
  const miniH = mapH * scale;

  const x0 = MINIMAP.margin;
  const y0 =  MINIMAP.margin;

  ctx.save();
  ctx.globalAlpha = MINIMAP.alpha;

  // 背景
  ctx.fillStyle = '#111';
  ctx.fillRect(x0, y0, miniW, miniH);
  // 画蛇头光点
  for (let i = 0; i < snakes.length; i++) {
    if (!snakes[i].alive || !snakes[i].body || snakes[i].body.length === 0) continue;

    const head = snakes[i].body[0];

    // 先默认：自己蓝色，其它先不画或后面再加
    let color = null;
    if (i === 0) color = 'blue'; // 自己：蓝色
    else if(otherSnakeShow) color = 'red';
    else continue;

    ctx.fillStyle = color;
    const px = x0 + head.x * WORLD.grid * scale;
    const py = y0 + head.y * WORLD.grid * scale;

    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 小地图边框
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, miniW, miniH);

  ctx.restore();
}

function renderFog() {
  fogCtx.clearRect(0, 0, VIEW.width, VIEW.height);
  const head = snakes[0].body[0];
  const cameraX = head.x * WORLD.grid - (VIEW.width / 2) / VIEW.scale + getAppLeft();
  const cameraY = head.y * WORLD.grid - (VIEW.height / 2) / VIEW.scale;

  const hx = head.x * WORLD.grid - cameraX;
  const hy = head.y * WORLD.grid - cameraY;

  const innerRadius = 100;
  const outerRadius = 220;

  fogCtx.save();

  // 黑色远处
  fogCtx.fillStyle = 'black';
  fogCtx.fillRect(0, 0, VIEW.width, VIEW.height);

  // 透明中心
  fogCtx.globalCompositeOperation = 'destination-out';
  fogCtx.beginPath();
  fogCtx.arc(hx, hy, outerRadius, 0, Math.PI * 2);
  fogCtx.fill();

  // 渐变环：重新切回 normal 画一个透明到黑的环
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

function updateSnake() {
  if(snakes[0].alive === false)return;
  for (let i = 0; i < snakeCount; i++) {
    if(snakes[i].alive === false){
      if(snakes[i].respawnTimer > 0) {snakes[i].respawnTimer--;continue;}
      else {snakes[i].alive = true;refreshSnake(i);}
    }
    const head = snakes[i].body[0];
    if(i === 0 || i !== 0 && snakes[i].changeDirTimer === 0 || emergency(i) === true){
      if(i !== 0){snakes[i].directionNext = aiChangeDirection(head.x,head.y,snakes[i].direction);}
      if(snakes[i].directionNext === 'up'){snakes[i].dir.x = 0;snakes[i].dir.y = -1;snakes[i].direction = snakes[i].directionNext;}
      else if(snakes[i].directionNext === 'down'){snakes[i].dir.x = 0;snakes[i].dir.y = 1;snakes[i].direction = snakes[i].directionNext;}
      else if(snakes[i].directionNext === 'left'){snakes[i].dir.x = -1;snakes[i].dir.y = 0;snakes[i].direction = snakes[i].directionNext;}
      else if(snakes[i].directionNext === 'right'){snakes[i].dir.x = 1;snakes[i].dir.y = 0;snakes[i].direction = snakes[i].directionNext;}
      if(snakes[0].dir.x === 0 && snakes[0].dir.y === 0){return;}
      snakes[i].changeDirTimer = Math.floor(Math.random() * 10) + 1;
    }
    else snakes[i].changeDirTimer--;
    snakes[i].moveCounter++;
    if(snakes[i].moveCounter >= snakes[i].moveInterval){
      snakes[i].moveCounter = 0;
      const newHead = {
        x: head.x + snakes[i].dir.x,    //调整x方向
        y: head.y + snakes[i].dir.y     //调整y方向
      };
      if(map[newHead.x][newHead.y] === 1){
        if(i === 0){
          snakes[i].alive = false;
        }else {
          snakes[i].alive = false;
          snakes[i].respawnTimer = 10;
          let k = 0;
          for(let meat of snakes[i].body){
            if(k === 0){map[meat.x][meat.y] = 0;}
            else {
              map[meat.x][meat.y] = 2;
              fruits.add(`${meat.x},${meat.y}`)
              fruitCount--;
            }
            k = 2-k;
          }
          snakes[i].body=[];
        }
      }
      else if(map[newHead.x][newHead.y] === 2){
        map[newHead.x][newHead.y] = 1;
        fruits.delete(`${newHead.x},${newHead.y}`)
        fruitCount++;
        if(fruitCount>0)makeFruit();
        snakes[i].body.unshift(newHead);
      }
      else if(map[newHead.x][newHead.y] === 0){
        map[snakes[i].body[snakes[i].body.length -1].x][snakes[i].body[snakes[i].body.length -1].y] = 0;
        map[newHead.x][newHead.y] = 1;
        snakes[i].body.pop();
        snakes[i].body.unshift(newHead);
      }
      else {
        const k = map[newHead.x][newHead.y];
        map[snakes[i].body[snakes[i].body.length -1].x][snakes[i].body[snakes[i].body.length -1].y] = 0;
        map[newHead.x][newHead.y] = 1;
        snakes[i].body.pop();
        snakes[i].body.unshift(newHead);
        snakes[i].propsTimer[changeIntoProps[k]] += propsTime;
        props[changeIntoProps[k]].delete(`${newHead.x},${newHead.y}`)
        propsCount[k-3]++;
        makeProps(k);
      }
      if(snakes[i].propsTimer.speedUp > snakes[i].propsTimer.speedDown){
        snakes[i].moveInterval = 1;
        snakes[i].propsTimer.speedUp = snakes[i].propsTimer.speedUp - snakes[i].propsTimer.speedDown - 1;
        snakes[i].propsTimer.speedDown = 0;
      }
      else if(snakes[i].propsTimer.speedUp < snakes[i].propsTimer.speedDown){
        snakes[i].moveInterval = 4;
        snakes[i].propsTimer.speedDown = snakes[i].propsTimer.speedDown - snakes[i].propsTimer.speedUp - 1;
        snakes[i].propsTimer.speedUp = 0;
      }
      else {
        snakes[i].moveInterval = 2;
        snakes[i].propsTimer.speedDown = 0;
        snakes[i].propsTimer.speedUp = 0;
      }
      if(i === 0){
        if(snakes[i].propsTimer.revealAll > 0){
          otherSnakeShow = true;
          snakes[i].propsTimer.revealAll--;
        }
        else{
          otherSnakeShow = false;
        }
        if(snakes[i].propsTimer.fog > 0){
          fogShow = true;
          snakes[i].propsTimer.fog--;
        }
        else {fogShow = false;}
      }
    }
  }
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    if (gameState.value === 'playing') {
      gameState.value = 'paused';
    } else if (gameState.value === 'paused') {
      gameState.value = 'playing';
    }
    return;
  }
  let newDirection = null;
  if (key === 'w') newDirection = 'up';
  else if (key === 's') newDirection = 'down';
  else if (key === 'a') newDirection = 'left';
  else if (key === 'd') newDirection = 'right';

  if (!newDirection) return;

  // 防止反向
  const opposite = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  }

  if (newDirection === opposite[snakes[0].direction]) return;

  snakes[0].directionNext = newDirection;
}

function initSnakes() {
  snakes[0].body=[];
  for (let i = 0; i < snakeCount; i++) {
    refreshSnake(i);
  }
  snakes[0].direction = null;
}

function refreshSnake(i) {
  const location = randomPlace();
  snakes[i].body[0] = location;
  snakes[i].direction = aiChangeDirection(location.x, location.y,null);
  snakes[i].directionNext = null;
  snakes[i].respawnTimer = 0;
  snakes[i].changeDirTimer = 0;
  snakes[i].alive = true;
  snakes[i].moveCounter = 0;
  snakes[i].moveInterval = 2;
  snakes[i].propsTimer.speedUp = 0;
  snakes[i].propsTimer.speedDown = 0;
  snakes[i].propsTimer.revealAll = 0;
  snakes[i].propsTimer.fog = 0;
  map[location.x][location.y] = 1;
}

function aiChangeDirection(x,y,direction) {
  if(map[x+1][y]===1&&map[x-1][y]===1&&map[x][y+1]===1&&map[x][y-1]===1)return direction;
  const choices = ['up', 'down', 'left', 'right'];
  const opposite = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  }
  do {
    const newDirection = choices[Math.floor(Math.random() * choices.length)];
    if (newDirection === opposite[direction]){continue;}
    if (newDirection === 'up' && map[x][y-1] === 1) {}
    else if (newDirection === 'down' && map[x][y+1] === 1) {}
    else if (newDirection === 'left' && map[x-1][y] === 1) {}
    else if (newDirection === 'right' && map[x+1][y] === 1) {}
    else return newDirection;
  } while (true)
}

function emergency(i) {
  const x = snakes[i].body[0].x;
  const y = snakes[i].body[0].y;
  if(snakes[i].direction === 'up'&& map[x][y-1] === 1) {return true;}
  else if(snakes[i].direction === 'down'&& map[x][y+1] === 1) {return true;}
  else if(snakes[i].direction === 'left'&& map[x-1][y] === 1) {return true;}
  else if(snakes[i].direction === 'right'&& map[x+1][y] === 1) {return true;}
  return false;
}

function randomPlace() {
  let location = {}
  do{
    location.x = Math.floor(Math.random() * 100) + 1;
    location.y = Math.floor(Math.random() * 100) + 1;
  }while(map[location.x][location.y] !== 0)
  return location;
}

function makeFruit() {
  let location = randomPlace();
  map[location.x][location.y] = 2;
  fruits.add(`${location.x},${location.y}`)
  fruitCount--;
}

function makeProps(i) {
  let location = randomPlace();
  map[location.x][location.y] = i;
  props[changeIntoProps[i]].add(`${location.x},${location.y}`)
  propsCount[i-3]--;
}

function initProps() {

  for(let i = 0; i < 4; i++) {
    propsCount[i] = 5;
    props[changeIntoProps[i+3]].clear();
    while(propsCount[i] > 0) {
      makeProps(i+3);
    }
  }
}

function initFruit() {
  fruits.clear();
  fruitCount = 500;
  while (fruitCount > 0) {
    makeFruit();
  }
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
  fogShow = false;
  otherSnakeShow = false;
  initSnakes();
  initProps();
  initFruit();
}

function render() {
  const head = snakes[0].body[0];
  const cameraX = head.x * WORLD.grid - (VIEW.width / 2) / VIEW.scale + getAppLeft();
  const cameraY = head.y * WORLD.grid - (VIEW.height / 2) / VIEW.scale;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  fogCtx.clearRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = 'grey';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  initWall(cameraX,cameraY);
  drawFruits(cameraX, cameraY);
  drawProps(cameraX, cameraY);
  drawSnake(cameraX, cameraY);
  drawMinimap();
  if(fogShow){renderFog();}
  // drawGrid(cameraX, cameraY);
}

function loop() {
  try {
    if (gameState.value === 'playing') {
      updateSnake()
      if (snakes[0].alive === false) {
        gameState.value = 'gameOver';
        updateMaxLength();
        clearTimeout(timeOutId);
        render();
        return;
      }
    }

    render();
    timeOutId = setTimeout(loop, 150);
  } catch (err) {
    clearTimeout(timeOutId);
  }
}

onMounted(async () => {
  ctx = canvas.value.getContext('2d');
  fogCtx = fogCanvas.value.getContext('2d');
  await initAssets();
  resizeCanvas();
  initGame();
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('keydown', handleKeydown);
  setCurrentPageType('game');
  registerPageHandler('game',gameHandler);
  syncCurrentPageToServer('game');
  loop();
});

onBeforeUnmount(() => {
  clearTimeout(timeOutId)
  // cancelAnimationFrame(animationId);
  window.removeEventListener('resize', resizeCanvas);
  document.removeEventListener('keydown', handleKeydown);
  unregisterPageHandler('game');
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
  width: 300px;
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
}
.panel button:first-of-type {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.30);
}
.panel button:last-of-type {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.panel button:first-of-type:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.40);
}
.panel button:last-of-type:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.20);
  transform: translateY(-1px);
}
.panel button:active {
  transform: translateY(0);
}
</style>