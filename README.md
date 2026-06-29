# 🐍 Snake Frontend

在线贪吃蛇对战平台前端，Vue 3 + Canvas 实现多人在线实时对战渲染。

👉 后端仓库：[qwq-no/snake-back](https://github.com/qwq-no/snake-back) | 在线演示：http://124.221.217.168

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Vue 3.5 (Composition API, `<script setup>`) |
| 构建 | Vite 8 |
| 路由 | Vue Router 5 (History Mode) |
| HTTP | Axios + Fetch (双 Token 自动续签拦截器) |
| 实时通信 | 原生 WebSocket (自建生命周期管理层) |
| 游戏渲染 | Canvas 2D (双层画布: 游戏层 + 迷雾层) |
| 状态管理 | 无 Vuex/Pinia — 原生响应式模块级单例 (`ref` + 闭包) |

## 核心架构

### WebSocket 生命周期管理层 (`src/utils/ws/`)

```
state.js         → 全局单例状态: ws 实例 / userCode / pageType / roomCode
lifecycle.js     → connect / close / reconnect (3s 退避) / heartbeat
actions.js       → sendGameWs / sendPageChange / sendJoin / sendKeyInput
```

**页面感知的心跳**：online 页面 3s 间隔，其他页面 30s。页面切换时立即发一次心跳，避免间隔突变导致的超时窗口。

**断线重连**：监听 `onclose` 事件 → 3 秒退避重连 → `onopen` 时自动发 `connect` + `page_change` 消息恢复服务端状态。

### 路由守卫 + 自动认证

```javascript
router.beforeEach(async (to) => {
  // 1. accessToken 存在 → 调 /api/user/getId 验证 → 通过
  // 2. accessToken 过期 → 调 /api/refresh/login 自动续签 (httpOnly cookie)
  // 3. 都失败 → redirect /login
})
```

HTTP 层 (`utils/http.js`) 也有镜像逻辑：任何请求遇 401 → 自动 refresh → 重试原请求，用户无感。

### 多人在线游戏渲染管线 (`GameOnline.vue`)

```
WebSocket onmessage: room_snapshot / room_delta
  → onlineHandler(msg)
    ├── room_snapshot → 全量替换蛇列表 + 水果 → hasRoomSnapshot = true
    ├── room_delta    → 增量应用变化的蛇 + 增删水果
    ├── room_lobby_state → 准备阶段房间状态
    └── room_debug_time → 服务端时间基准
  → requestAnimationFrame 渲染循环
    ├── clearCanvas()
    ├── drawGrid()           # 102 x 102 网格
    ├── drawFruits()         # 点状水果
    ├── drawSnakes()         # 蛇身线段 + 方向箭头 + 道具效果
    ├── drawMinimap()        # 右上角缩略小地图
    └── drawFogOfWar()       # 迷雾画布叠加
```

**双层 Canvas 架构**：
- 底层 Canvas：游戏画面 (网格 / 食物 / 蛇 / 道具)
- 顶层 Canvas：战争迷雾 (每蛇仅周围可见，fog 道具进一步缩小视野)

### 本地单人模式 (`Game.vue`)

纯前端 102 x 102 地图贪吃蛇：AI 蛇 (BFS 寻路) + 道具系统 + 迷雾 + 成绩提交。

### 页面状态机

```
login → register
  ↓
home ←→ roomSelect → roomPrepare → gameOnline
  ↓       (浏览房间)   (等待 & 准备)    (实时对战)
addFriend / appliedFriend
```

每个页面通过 `registerPageHandler(pageType, handler)` 注册 WebSocket 消息处理器，`page_change` 时服务端推送对应快照。

## 项目结构

```
snake_front/src/
├── main.js                           # 应用入口 + 路由挂载
├── App.vue                           # 根组件 <router-view>
├── components/
│   ├── Login.vue                     # 登录 (bcrypt, Callable 后端)
│   ├── Register.vue                  # 注册
│   ├── Home.vue                      # 个人主页: 好友列表 + 聊天 + 加入房间
│   ├── RoomSelect.vue                # 房间大厅: room_summary_list/delta 增量更新
│   ├── RoomPrepare.vue               # 准备室: 倒计时 + 房间聊天 + 表情
│   ├── GameOnline.vue  (877行)       # 在线对战: Canvas 双层渲染 + WS 实时同步
│   ├── Game.vue                      # 单人模式: BFS AI 蛇 + 道具 + 迷雾
│   ├── FriendTalking.vue             # 好友私聊
│   ├── GroupChat.vue                 # 全局 / 房间群聊组件
│   ├── AddFriend.vue                 # 添加好友
│   └── AppliedFriend.vue             # 好友申请列表
├── router/
│   └── index.js                      # 路由表 + beforeEach 守卫 + refresh 续签
└── utils/
    ├── api.js                        # REST API 封装 (login/register/friends/…)
    ├── http.js                       # Fetch 封装: auto token + 401 → refresh 重试
    └── ws/
        ├── index.js                  # 统一导出
        ├── state.js                  # 全局 WS 单例状态模块
        ├── lifecycle.js              # 连接 / 重连 / 心跳 / dispatch
        └── actions.js                # 发送 WS 消息的纯函数
```

## 关键设计决策

### 无状态管理库

所有页面共享的 WebSocket 连接和用户信息通过 `utils/ws/state.js` 的模块级闭包管理，各组件间通过 `utils/ws/index.js` 导入函数式 API。选型理由：相比 Vuex/Pinia，模块闭包更轻量、无模板代码、与 WebSocket 事件驱动模型更匹配。

### 增量渲染而非全量重绘

`GameOnline.vue` 区分 `room_snapshot`（初始化 / 重连）和 `room_delta`（每 tick 增量）两种消息。Delta 模式下只更新变化的蛇和水果，避免每帧遍历 102 x 102 数组，Canvas 合成开销 O(变化量) 而非 O(地图面积)。

### 服务端驱动的游戏状态

客户端只做渲染和发送键盘输入，所有游戏逻辑（碰撞检测、重生、道具效果）由服务端 150ms tick 循环计算。这保证了多人在线场景下的状态一致性，即使个别客户端延迟高也不影响其他玩家。

### Progressive 初始化 (GameOnline.onMounted)

```
Phase 1: Canvas init (同步)      — refs 就绪, resizeCanvas
Phase 2: WS 状态 & handler (同步) — 必须在 await 前完成, 防止 WS 消息在异步间隙到达时状态未就绪
Phase 3: 图片加载 (异步)         — 渲染函数正确处理加载中状态
Phase 4: 事件绑定 & sync     — 键盘 / 窗口事件 + syncCurrentPageToServer
```

## 快速开始

```bash
cd snake_front
npm install
npm run dev        # http://localhost:5173, proxy /api → localhost:8086
```

构建部署：

```bash
npm run build      # 输出 dist/
# dist/ 放到 Nginx root 目录, 配置 SPA fallback:
# try_files $uri $uri/ /index.html
```

---

👉 后端代码见 [qwq-no/snake-back](https://github.com/qwq-no/snake-back) | 在线演示：http://124.221.217.168
