import {
    getCurrentPageType,
    getCurrentUserCode,
    getGameWs,
    getGlobalCloseHandler,
    getGlobalErrorHandler,
    getGlobalOpenHandler,
    getHeartbeatTimer,
    getPageHandlers,
    getReconnectTimer,
    getShouldReconnect,
    getWsUrl,
    setGameWs,
    setGlobalCloseHandler,
    setGlobalErrorHandler,
    setGlobalOpenHandler,
    setHeartbeatTimer,
    setReconnectTimer,
    setShouldReconnect
} from './state.js';

import {sendGameWs, sendPageChange} from './actions.js';

let lastAnnouncedWs = null;
let lastAnnouncedPageType = null;
let unloadGuardBound = false;

function shouldReplaySnapshot(pageType) {
    return pageType === 'select' || pageType === 'prepare';
}

function announceCurrentPage(pageType = getCurrentPageType(), allowWithoutHandler = false) {
    const ws = getGameWs();
    if (!ws || ws.readyState !== WebSocket.OPEN || !pageType) {
        return false;
    }

    if (!allowWithoutHandler && !getPageHandlers().has(pageType) && !shouldReplaySnapshot(pageType)) {
        return false;
    }

    if (lastAnnouncedWs === ws && lastAnnouncedPageType === pageType) {
        return false;
    }

    const sent = sendPageChange(pageType);
    if (sent) {
        lastAnnouncedWs = ws;
        lastAnnouncedPageType = pageType;
    }
    return sent;
}

function handlePageUnload() {
    setShouldReconnect(false);

    const reconnectTimer = getReconnectTimer();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        setReconnectTimer(null);
    }

    stopHeartbeat();
}

function bindUnloadGuard() {
    if (unloadGuardBound || typeof window === 'undefined') {
        return;
    }

    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    unloadGuardBound = true;
}

function getHeartbeatIntervalByPageType(pageType) {
    return pageType === 'online' ? 3000 : 30000;
}

function getHeartbeatPayload() {
    return {
        type: 'heartbeat',
        ts: Date.now(),
        pageType: getCurrentPageType()
    };
}

function startHeartbeat() {
    stopHeartbeat();
    // 立即发送一次心跳，避免切换页面时心跳间隔变化导致的超时窗口
    // 例如：prepare(30s间隔) → online(3s间隔)，若上次心跳已过4s+，setInterval 要等3s
    // 才首次触发，后端6s超时就会被触发
    const ws = getGameWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendGameWs(getHeartbeatPayload());
    }
    const timer = setInterval(() => {
        const ws = getGameWs();
        if (ws && ws.readyState === WebSocket.OPEN) {
            sendGameWs(getHeartbeatPayload());
        }
    }, getHeartbeatIntervalByPageType(getCurrentPageType()));
    setHeartbeatTimer(timer);
}

function stopHeartbeat() {
    const timer = getHeartbeatTimer();
    if (timer) {
        clearInterval(timer);
        setHeartbeatTimer(null);
    }
}

function scheduleReconnect() {
    if (!getShouldReconnect()) return;

    const oldTimer = getReconnectTimer();
    if (oldTimer) {
        clearTimeout(oldTimer);
    }

    const timer = setTimeout(() => {
        setReconnectTimer(null);
        connectGameWs();
    }, 3000);

    setReconnectTimer(timer);
}

function safeParseMessage(payload) {
    try {
        return JSON.parse(payload);
    } catch (err) {
        return null;
    }
}

function dispatchMessage(msg) {
    if (!msg) {
        return;
    }

    // If server omitted pageType but message is clearly a room message, assume 'online'
    let pageType = msg.pageType;
    if (!pageType && msg.type) {
        const t = String(msg.type);
        if (t.startsWith('room_') || t === 'room_debug_time') {
            pageType = 'online';
            msg.pageType = pageType;
        }
    }

    if (!pageType) {
        return;
    }

    const handler = getPageHandlers().get(pageType);
    if (handler) {
        handler(msg);
        return;
    }

}

function buildConnectPayload() {
    return {
        type: 'connect',
        pageType: getCurrentPageType(),
        userCode: getCurrentUserCode()
    };
}

export function syncCurrentPageToServer(pageType = getCurrentPageType()) {
    return announceCurrentPage(pageType);
}

export function initGameWs({
                               onOpen,
                               onClose,
                               onError
                           } = {}) {
    bindUnloadGuard();
    setGlobalOpenHandler(onOpen || null);
    setGlobalCloseHandler(onClose || null);
    setGlobalErrorHandler(onError || null);
}

export function connectGameWs() {
    setShouldReconnect(true);

    if (!getCurrentUserCode()) {
        return;
    }

    const ws = getGameWs();
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        // 页面切换时 WS 复用，重启心跳以使用当前页面的心跳间隔（online=3s, 其他=30s）
        startHeartbeat();
        return;
    }

    const newWs = new WebSocket(getWsUrl());
    setGameWs(newWs);

    newWs.onopen = () => {

        const openHandler = getGlobalOpenHandler();
        if (openHandler) openHandler();

        sendGameWs(buildConnectPayload());

        // 重连时始终通知服务器当前页面，确保房间绑定关系正确恢复
        announceCurrentPage(getCurrentPageType(), true);

        startHeartbeat();
    };

    newWs.onmessage = (event) => {
        const msg = safeParseMessage(event.data);
        if (!msg) return;
        dispatchMessage(msg);
    };

    newWs.onclose = (event) => {
        stopHeartbeat();

        const closeHandler = getGlobalCloseHandler();
        if (closeHandler) closeHandler(event);

        setGameWs(null);
        scheduleReconnect();
    };

    newWs.onerror = (err) => {
        const errorHandler = getGlobalErrorHandler();
        if (errorHandler) errorHandler(err);
    };
}

export function closeGameWs() {
    setShouldReconnect(false);
    stopHeartbeat();

    const reconnectTimer = getReconnectTimer();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        setReconnectTimer(null);
    }

    const ws = getGameWs();
    if (ws) {
        try {
            ws.close();
        } catch (err) {
        }
        setGameWs(null);
    }
}

export function registerPageHandler(pageType, handler) {
    if (!pageType || typeof handler !== 'function') {
        return;
    }
    getPageHandlers().set(pageType, handler);
}

export function unregisterPageHandler(pageType) {
    if (!pageType) return;
    getPageHandlers().delete(pageType);
}

