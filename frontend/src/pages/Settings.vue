<template>
  <div class="page">
    <div class="page-header"><h1>Configuracion</h1></div>
    <el-card>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="Empresa"><el-input v-model="settings.company.name" /></el-form-item>
          <el-form-item label="Legal name"><el-input v-model="settings.company.legalName" /></el-form-item>
          <el-form-item label="Telefono"><el-input v-model="settings.company.phone" /></el-form-item>
          <el-form-item label="Correo"><el-input v-model="settings.company.email" /></el-form-item>
          <el-form-item label="Sitio web"><el-input v-model="settings.company.website" /></el-form-item>
          <el-form-item label="RFC / Tax ID"><el-input v-model="settings.company.taxId" /></el-form-item>
          <el-form-item class="full" label="Direccion"><el-input v-model="settings.company.address" /></el-form-item>
        </div>
        <p class="muted">Place the corporate logo at <code>/frontend/src/assets/brand/logo.png</code>.</p>
        <div class="toolbar">
          <el-button type="primary" @click="save">Save Configuracion</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';

const settings = useSettingsStore();

function save() {
  settings.save();
  ElMessage.success('Configuracion saved');
}

onMounted(settings.load);
</script>
