import {getCurrentPageType, getCurrentRoomCode, getGameWs} from './state.js';

export function sendGameWs(data) {
    const ws = getGameWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    ws.send(JSON.stringify(data));
    return true;
}

export function sendKeyInput(key) {
    return sendGameWs({
        type: 'input',
        pageType: getCurrentPageType(),
        key
    });
}

export function sendJoin(roomCode = getCurrentRoomCode()) {
    return sendGameWs({
        type: 'join',
        pageType: getCurrentPageType(),
        roomCode
    });
}

export function sendReady() {
    return sendGameWs({
        type: 'ready',
        pageType: getCurrentPageType()
    });
}

export function sendUnready() {
    return sendGameWs({
        type: 'unready',
        pageType: getCurrentPageType()
    });
}

export function sendLeaveRoom() {
    return sendGameWs({
        type: 'leave',
        pageType: getCurrentPageType()
    });
}

export function sendEmoji(emojiId) {
    return sendGameWs({
        type: 'emoji',
        pageType: getCurrentPageType(),
        emojiId
    });
}

export function sendPageChange(pageType = getCurrentPageType()) {
    if (!pageType) {
        return false;
    }

    return sendGameWs({
        type: 'page_change',
        pageType,
        roomCode: getCurrentRoomCode()
    });
}

export function sendGroupChat(content) {
    return sendGameWs({
        type: 'group_chat_send',
        pageType: getCurrentPageType(),
        content
    });
}

export function requestGroupChatHistory() {
    return sendGameWs({
        type: 'group_chat_history',
        pageType: getCurrentPageType()
    });
}

export function sendPrivateChat(toUserCode, content) {
    return sendGameWs({
        type: 'private_chat_send',
        pageType: 'talk',
        toUserCode,
        content
    });
}

export function requestPrivateChatHistory(withUserCode, page = 1, size = 50) {
    return sendGameWs({
        type: 'private_chat_history',
        pageType: 'talk',
        withUserCode,
        page,
        size
    });
}