import { createRouter, createWebHistory } from 'vue-router'
import Home from '../components/Home.vue'
import Login from '../components/Login.vue'
import AddFriend from "../components/AddFriend.vue";
import Game from "../components/Game.vue";
import Register from "../components/Register.vue";
import AppliedFriend from "../components/AppliedFriend.vue";
import RoomSelect from "../components/RoomSelect.vue";
import GameOnline from "../components/GameOnline.vue";
import RoomPrepare from "../components/RoomPrepare.vue";
import {connectGameWs, setCurrentPageType, setCurrentUserCode} from "../utils/ws/index.js";

function getPageTypeFromPath(path) {
    if (path === '/home') return 'home';
    if (path === '/roomSelect') return 'select';
    if (path === '/roomPrepare') return 'prepare';
    if (path === '/gameOnline') return 'online';
    if (path === '/game') return 'single';
    if (path === '/appliedFriend' || path === '/addFriend' || path === '/login' || path === '/register') return 'home';
    return 'home';
}


const routes = [
    { path: '/', redirect: '/home' },

    { path: '/login', component: Login, meta: { public: true } },
    { path: '/register', component: Register, meta: { public: true } },

    { path: '/roomSelect' , component: RoomSelect, meta: { requiresAuth: true } },
    { path: '/appliedFriend', component: AppliedFriend, meta: { requiresAuth: true } },
    { path: '/home', component: Home, meta: { requiresAuth: true } },
    { path: '/addFriend', component: AddFriend, meta: { requiresAuth: true } },
    { path: '/game', component: Game, meta: { requiresAuth: true } },
    { path: '/gameOnline', component: GameOnline, meta: { requiresAuth: true } },
    { path: '/roomPrepare', component: RoomPrepare, meta: { requiresAuth: true } }
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
                    setCurrentUserCode(String(result.data.user.userCode));
                    setCurrentPageType(getPageTypeFromPath(to.path));
                    connectGameWs();
                    return true;
                }
            }
        } catch (e) {}
    }

    if (token && userCode) {
        setCurrentUserCode(userCode);
        setCurrentPageType(getPageTypeFromPath(to.path));
        connectGameWs();
        return true;
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
                setCurrentUserCode(String(result?.data?.user.userCode));
                setCurrentPageType(getPageTypeFromPath(to.path));
                connectGameWs();
                return true;
            }
        }
    } catch (e) {}

    return '/login';
});

export default router