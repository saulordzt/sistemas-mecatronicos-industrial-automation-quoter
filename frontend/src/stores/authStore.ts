import { defineStore } from 'pinia';
import { authApi, setAuthToken } from '../services/api';

const tokenKey = 'automation-quoter-token';
const userKey = 'automation-quoter-user';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(tokenKey) || '',
    user: JSON.parse(localStorage.getItem(userKey) || 'null') as any,
    loading: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token)
  },
  actions: {
    hydrate() {
      setAuthToken(this.token || null);
    },
    async login(email: string, password: string) {
      this.loading = true;
      try {
        const result = await authApi.login(email, password);
        this.token = result.token;
        this.user = result.user;
        localStorage.setItem(tokenKey, this.token);
        localStorage.setItem(userKey, JSON.stringify(this.user));
        setAuthToken(this.token);
      } finally {
        this.loading = false;
      }
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      setAuthToken(null);
    }
  }
});
