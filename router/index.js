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
    { path: '/home', component: Home },
    { path: '/roomManagement', component: RoomManagement },
    { path: '/addFriend', component: AddFriend },
    { path: '/game', component: Game }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// 路由守卫：非公开页面必须登录
router.beforeEach(async (to) => {
    if (to.meta.public) return true;

    const token = localStorage.getItem('accessToken');
    if (token) return true;

    // 没 accessToken，尝试用 refresh cookie 自动续签
    try {
        const resp = await fetch('/api/refresh/login', {
            method: 'POST',
            credentials: 'include'
        });

        if (resp.ok) {
            const result = await resp.json();
            const newToken = result?.data?.accessToken;
            if (result?.code === 1 && newToken) {
                localStorage.setItem('accessToken', newToken);
                return true;
            }
        }
    } catch (e) {}

    return '/login';
});

export default router