import { createRouter, createWebHistory } from 'vue-router'
import Home from '../components/Home.vue'
import Login from '../components/Login.vue'
import RoomManagement from '../components/RoomManagement.vue'
import AddFriend from "../components/AddFriend.vue";
import Game from "../components/Game.vue";
import Register from "../components/Register.vue";

const routes = [
    { path: '/', redirect: '/home' },

    { path: '/login', component: Login, meta: { public: true } },
    { path: '/register', component: Register, meta: { public: true } },

    { path: '/home', component: Home, meta: { requiresAuth: true } },
    { path: '/roomManagement', component: RoomManagement, meta: { requiresAuth: true } },
    { path: '/addFriend', component: AddFriend, meta: { requiresAuth: true } },
    { path: '/game', component: Game, meta: { requiresAuth: true } }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// 路由守卫：必须登录
router.beforeEach(async (to) => {
    if (to.meta.public) return true;

    const token = localStorage.getItem('accessToken');
    const userCode = sessionStorage.getItem('userCode');
    if (token && !userCode) {
        try {
            const resp = await fetch('/api/user/getId', {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include'
            });
            if (resp.ok) {
                const result = await resp.json();
                if (result?.code === 1 && result?.data?.user) {
                    sessionStorage.setItem('userCode', result.data.user.userCode);
                    sessionStorage.setItem('username', result.data.user.username);
                    sessionStorage.setItem('displayName', result.data.user.displayName);
                    return true;
                }
            }
        } catch (e) {}
    }

    // 没 accessToken，尝试用 refresh cookie 自动续签
    try {
        const resp = await fetch('/api/refresh/login', {   // 注意改成你的真实路径
            method: 'POST',
            credentials: 'include'
        });

        if (resp.ok) {
            const result = await resp.json();
            const newToken = result?.data?.accessToken;
            if (result?.code === 1 && newToken) {
                localStorage.setItem('accessToken', newToken);
                sessionStorage.setItem('userCode', result?.data?.user.userCode);
                sessionStorage.setItem('username', result?.data?.user.username);
                sessionStorage.setItem('displayName', result?.data?.user.displayName);
                return true;
            }
        }
    } catch (e) {}

    return '/login';
});

export default router