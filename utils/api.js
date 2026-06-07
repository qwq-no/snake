import { http } from './http.js'
import {closeGameWs} from "./ws/index.js";


export async function login(payload) {
    const resp = await http('/api/user/login', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '登录失败');
    }

    const accessToken = result?.data?.accessToken;
    if (!accessToken) throw new Error('缺少 accessToken');

    localStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('userCode', result?.data?.user.userCode);
    sessionStorage.setItem('username', result?.data?.user.username);
    sessionStorage.setItem('displayName', result?.data?.user.displayName);
    return result.data; // {accessToken,user{userCode,username,displayName}
}

export async function register(payload) {
    const resp = await http('/api/user/register', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '注册失败');
    }
    return result.data;
}

export async function logout() {
    try {
        await fetch('/api/refresh/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } finally {
        closeGameWs();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
    }
}

export async function submitLength(length) {
    const resp = await http('/api/user/getMaxLength', {
        method: 'POST',
        body: JSON.stringify({ length }),
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '提交长度失败');
    }

    return result.data;
}

export async function submitFriendApply(otherUserCode) {
    const myUserCode = sessionStorage.getItem('userCode');
    const resp = await http('/api/friendRequest/friendApply', {
        method: 'POST',
        body: JSON.stringify({
            myUserCode,
            otherUserCode
        }),
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '申请好友失败');
    }

    return result.data;
}

export async function getFriendRequestList() {
    const myUserCode = sessionStorage.getItem('userCode');
    const resp = await http(`/api/friendRequest/list?myUserCode=${myUserCode}`, {
        method: 'GET',
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '获取好友申请列表失败');
    }

    return result.data.FriendRequestList;
}

export async function handleFriendRequest(requestId, action) {
    const resp = await http('/api/friendRequest/handleFriendRequest', {
        method: 'POST',
        body: JSON.stringify({
            requestId,
            action
        }),
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '处理好友申请失败');
    }

    return result.data;
}

export async function updateDisplayName(displayName) {
    const resp = await http('/api/user/updateDisplayName', {
        method: 'POST',
        body: JSON.stringify({ displayName }),
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '更改名称失败');
    }

    return result.data;
}

export async function updatePassword(password) {
    const resp = await http('/api/user/updatePassword', {
        method: 'POST',
        body: JSON.stringify({ password }),
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '更改密码失败');
    }

    return result.data;
}

export async function getFriendList(myUserCode) {
    const resp = await http(`/api/friendship/list?myUserCode=${myUserCode}`, {
        method: 'GET',
        credentials: 'include'
    });

    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '获取好友列表失败');
    }

    return result.data;
}