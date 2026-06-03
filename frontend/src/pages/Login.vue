<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="login-brand">
        <img src="../assets/brand/logo.png" alt="Sistemas Mecatronicos" />
        <h1>Internal Quoting Portal</h1>
        <p class="muted">Entrar to manage customers, products, projects, and quotes.</p>
      </div>
      <el-form label-position="top" @submit.prevent="login">
        <el-form-item label="Correo"><el-input v-model="email" autocomplete="username" /></el-form-item>
        <el-form-item label="Contrasena"><el-input v-model="password" type="password" autocomplete="current-password" show-password /></el-form-item>
        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <el-button type="primary" native-type="submit" :loading="auth.loading" style="width: 100%; margin-top: 14px">Sign In</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const email = ref('');
const password = ref('');
const error = ref('');
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

async function login() {
  error.value = '';
  try {
    await auth.login(email.value, password.value);
    router.push((route.query.redirect as string) || '/');
  } catch (_err) {
    error.value = 'Invalid email or password';
  }
}
</script>
