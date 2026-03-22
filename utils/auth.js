import { http } from './http.js'

export async function login(payload) {
    const resp = await http('/api/user/login', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '登录失败');
    }

    const accessToken = result?.data?.accessToken;
    if (!accessToken) throw new Error('缺少 accessToken');

    localStorage.setItem('accessToken', accessToken);
    return result.data; // {accessToken,id,username,displayName}
}

export async function register(payload) {
    const resp = await http('/api/user/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    const result = await resp.json();

    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || '注册失败');
    }
    return result.data;
}

// App 启动时调用：无 access 也能通过 refresh cookie 自动拿新 access
export async function tryAutoLogin() {
    const current = localStorage.getItem('accessToken');
    if (current) return true;

    const resp = await fetch('/api/refresh/login', {
        method: 'POST',
        credentials: 'include',
    });
    if (!resp.ok) return false;

    const result = await resp.json();
    if (result?.code !== 1) return false;

    const newToken = result?.data?.accessToken;
    if (!newToken) return false;

    localStorage.setItem('accessToken', newToken);
    return true;
}

export function logout() {
    localStorage.removeItem('accessToken');
}

export async function getId() {
    const resp = await http('/api/user/getId', {
        method: 'GET'
    });
    const result = await resp.json();
    if (!resp.ok || result?.code !== 1) {
        throw new Error(result?.msg || 'unauthorized');
    }
    return result.data;
}