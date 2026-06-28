/**
 * WebSocket URL 自动适配：
 * - 本地开发：ws://localhost:8086/ws/game（经过 Vite proxy 转发）
 * - 生产环境：wss://你的域名/ws/game（经过 Nginx 反向代理）
 */
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/ws/game`;

let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let shouldReconnect = true;

let currentUserCode = null;
let currentPageType = null;
let currentRoomCode = null;

const pageHandlers = new Map();

let globalOpenHandler = null;
let globalCloseHandler = null;
let globalErrorHandler = null;

export function getWsUrl() {
    return WS_URL;
}

export function getGameWs() {
    return ws;
}

export function setGameWs(instance) {
    ws = instance;
}

export function getReconnectTimer() {
    return reconnectTimer;
}

export function setReconnectTimer(timer) {
    reconnectTimer = timer;
}

export function getHeartbeatTimer() {
    return heartbeatTimer;
}

export function setHeartbeatTimer(timer) {
    heartbeatTimer = timer;
}

export function getShouldReconnect() {
    return shouldReconnect;
}

export function setShouldReconnect(value) {
    shouldReconnect = value;
}

export function getCurrentUserCode() {
    return currentUserCode;
}

export function setCurrentUserCode(userCode) {
    currentUserCode = userCode;
}

export function getCurrentPageType() {
    return currentPageType;
}

export function setCurrentPageType(pageType) {
    currentPageType = pageType;
}

export function getCurrentRoomCode() {
    return currentRoomCode;
}

export function setCurrentRoomCode(roomCode) {
    currentRoomCode = roomCode;
}

export function getPageHandlers() {
    return pageHandlers;
}

export function setGlobalOpenHandler(handler) {
    globalOpenHandler = handler;
}

export function setGlobalCloseHandler(handler) {
    globalCloseHandler = handler;
}

export function setGlobalErrorHandler(handler) {
    globalErrorHandler = handler;
}

export function getGlobalOpenHandler() {
    return globalOpenHandler;
}

export function getGlobalCloseHandler() {
    return globalCloseHandler;
}

export function getGlobalErrorHandler() {
    return globalErrorHandler;
}

