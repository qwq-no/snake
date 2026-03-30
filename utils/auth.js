import { http } from './http.js'

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
        console.log('logout start');
        await fetch('/api/refresh/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } finally {
        localStorage.clear();
        sessionStorage.clear();
        // window.location.href = '/login';
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