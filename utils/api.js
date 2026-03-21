export async function login(payload) {
    const resp = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include' // 如果后端写 cookie，浏览器才会保存
    });
    return resp;
}

export async function registerWithFetch(payload) {
    const resp = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        //credentials: 'include' // 如果需要跨域携带 cookie（例如自动登录返回 cookie），打开此项
    });
    return resp;
}

// Axios example:
import axios from 'axios';
export function registerWithAxios(payload) {
    return axios.post('/api/user/register', payload, {
        //withCredentials: true // 若需要携带 cookie
    });
}