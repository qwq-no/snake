// 在 App 启动时尝试用 refresh cookie 自动登录
export async function tryAutoLogin() {
    try {
        const resp = await fetch('/api/refresh/login', {
            method: 'POST',
            credentials: 'include' // 发送 HttpOnly cookie 到后端
        });
        if (resp.ok) {
            const user = await resp.json(); // 后端返回的 user info
            // 将 user 写入前端状态（store），并导航到 home
            // store.commit('setUser', user)
            // router.push('/home')
            return true;
        } else {
            // 401 -> 未登录，前端跳转到登录页或显示登录入口
            return false;
        }
    } catch (e) {
        return false;
    }
}