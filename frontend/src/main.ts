import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles.css';
import { useAuthStore } from './stores/authStore';
import { registerSW } from 'virtual:pwa-register';

const savedTheme = localStorage.getItem('automation-quoter-theme');
if (savedTheme === 'dark') document.documentElement.classList.add('dark');

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
useAuthStore().hydrate();
app.use(router);
app.use(ElementPlus);
app.mount('#app');

registerSW({
  immediate: true
});
