<template>
  <router-view v-if="$route.meta.public" />
  <el-container v-else class="app-shell">
    <el-aside v-if="!isMobile && desktopNavOpen" width="248px" class="sidebar">
      <div class="brand">
        <img src="./assets/brand/logo-white.svg" alt="Sistemas Mecatronicos logo" />
      </div>
      <el-menu router :default-active="$route.path" class="nav-menu">
        <el-menu-item index="/"><el-icon><DataBoard /></el-icon><span>Panel</span></el-menu-item>
        <el-menu-item index="/customers"><el-icon><OfficeBuilding /></el-icon><span>Clientes</span></el-menu-item>
        <el-menu-item index="/projects"><el-icon><Folder /></el-icon><span>Proyectos</span></el-menu-item>
        <el-menu-item index="/quotes"><el-icon><Document /></el-icon><span>Cotizaciones</span></el-menu-item>
        <el-menu-item index="/products"><el-icon><Box /></el-icon><span>Productos</span></el-menu-item>
        <el-menu-item index="/quote-assistant"><el-icon><Guide /></el-icon><span>Asistente</span></el-menu-item>
        <el-menu-item index="/service-rates"><el-icon><Timer /></el-icon><span>Tarifas</span></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Setting /></el-icon><span>Configuracion</span></el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <button class="sidebar-theme-button" type="button" @click="toggleTheme">
          <span class="sidebar-theme-label">Tema</span>
          <span class="sidebar-theme-value">
            <el-icon><component :is="darkMode ? Sunny : Moon" /></el-icon>
            <strong>{{ darkMode ? 'Claro' : 'Oscuro' }}</strong>
          </span>
        </button>
        <el-button class="sidebar-logout-button" @click="logout">
          <el-icon><SwitchButton /></el-icon>
          <span>Salir</span>
        </el-button>
      </div>
    </el-aside>

    <el-drawer
      v-model="mobileNavOpen"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="mobile-nav-drawer"
    >
      <div class="brand mobile-brand">
        <img src="./assets/brand/logo-white.svg" alt="Sistemas Mecatronicos logo" />
      </div>
      <el-menu router :default-active="$route.path" class="nav-menu mobile-nav-menu" @select="mobileNavOpen = false">
        <el-menu-item index="/"><el-icon><DataBoard /></el-icon><span>Panel</span></el-menu-item>
        <el-menu-item index="/customers"><el-icon><OfficeBuilding /></el-icon><span>Clientes</span></el-menu-item>
        <el-menu-item index="/projects"><el-icon><Folder /></el-icon><span>Proyectos</span></el-menu-item>
        <el-menu-item index="/quotes"><el-icon><Document /></el-icon><span>Cotizaciones</span></el-menu-item>
        <el-menu-item index="/products"><el-icon><Box /></el-icon><span>Productos</span></el-menu-item>
        <el-menu-item index="/quote-assistant"><el-icon><Guide /></el-icon><span>Asistente</span></el-menu-item>
        <el-menu-item index="/service-rates"><el-icon><Timer /></el-icon><span>Tarifas</span></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Setting /></el-icon><span>Configuracion</span></el-menu-item>
      </el-menu>
      <div class="mobile-drawer-footer">
        <button class="sidebar-theme-button mobile-sidebar-theme-button" type="button" @click="toggleTheme">
          <span class="sidebar-theme-label">Tema</span>
          <span class="sidebar-theme-value">
            <el-icon><component :is="darkMode ? Sunny : Moon" /></el-icon>
            <strong>{{ darkMode ? 'Claro' : 'Oscuro' }}</strong>
          </span>
        </button>
        <el-button class="mobile-logout-button" @click="logout">
          <el-icon><SwitchButton /></el-icon>
          <span>Salir</span>
        </el-button>
      </div>
    </el-drawer>

    <el-container>
      <el-header class="topbar">
        <div class="topbar-title">
          <el-button class="mobile-menu-button" @click="toggleNavigation">
            <el-icon><Menu /></el-icon>
            <span>{{ isMobile ? 'Menu' : desktopNavOpen ? 'Ocultar menu' : 'Mostrar menu' }}</span>
          </el-button>
          <strong>Cotizador Sistemas Mecatronicos</strong>
          <span>Propuestas profesionales para automatizacion, control, tableros y puesta en marcha</span>
        </div>
        <div class="topbar-actions">
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Box, DataBoard, Document, Folder, Guide, Menu, Moon, OfficeBuilding, Setting, Sunny, SwitchButton, Timer } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/authStore';

const auth = useAuthStore();
const router = useRouter();
const darkMode = ref(document.documentElement.classList.contains('dark'));
const isMobile = ref(window.innerWidth < 960);
const mobileNavOpen = ref(false);
const desktopNavOpen = ref(true);

function handleResize() {
  isMobile.value = window.innerWidth < 960;
  if (!isMobile.value) mobileNavOpen.value = false;
}

function applyTheme(value: string | number | boolean) {
  const enabled = Boolean(value);
  document.documentElement.classList.toggle('dark', enabled);
  localStorage.setItem('automation-quoter-theme', enabled ? 'dark' : 'light');
}

function toggleTheme() {
  darkMode.value = !darkMode.value;
  applyTheme(darkMode.value);
}

function toggleNavigation() {
  if (isMobile.value) {
    mobileNavOpen.value = !mobileNavOpen.value;
    return;
  }
  desktopNavOpen.value = !desktopNavOpen.value;
}

function logout() {
  auth.logout();
  router.push('/login');
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>
