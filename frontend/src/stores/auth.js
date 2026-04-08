import { defineStore } from 'pinia';
import axios from '../utils/axios';
import { clearChatStorageForCurrentUser } from '../utils/chatStorage';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null,
        token: localStorage.getItem('token') || null,
    }),
    actions: {
        async login(email, password) {
            const res = await axios.post('/auth/login', { email, password });
            this.token = res.data.token;
            this.user = res.data.user;
            localStorage.setItem('token', this.token);
        },
        logout() {
            clearChatStorageForCurrentUser();
            this.token = null;
            this.user = null;
            localStorage.removeItem('token');
        },
    },
});