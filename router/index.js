import { createRouter, createWebHistory } from 'vue-router'
import Home from '../components/Home.vue'
import Login from '../components/Login.vue'
import RoomManagement from '../components/RoomManagement.vue'
import AddFriend from "../components/AddFriend.vue";
import Game from "../components/Game.vue";
import Register from "../components/Register.vue";

const routes = [
    { path: '/', component: Login },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/home', component: Home },
    { path: '/roomManagement', component: RoomManagement },
    { path: '/addFriend', component: AddFriend },
    { path: '/game', component: Game }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router