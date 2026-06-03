<template>
  <div class="page">
    <div class="page-header"><h1>{{ form.id ? 'Editar Proveedor' : 'Nuevo Proveedor' }}</h1></div>
    <el-card>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="Empresa"><el-input v-model="form.companyName" /></el-form-item>
          <el-form-item label="Contacto principal"><el-input v-model="form.primaryContactName" /></el-form-item>
          <el-form-item label="Correo"><el-input v-model="form.primaryContactEmail" /></el-form-item>
          <el-form-item label="Telefono"><el-input v-model="form.primaryContactPhone" /></el-form-item>
          <el-form-item label="RFC / Tax ID"><el-input v-model="form.taxId" /></el-form-item>
          <el-form-item label="Sitio web"><el-input v-model="form.website" /></el-form-item>
          <el-form-item class="full" label="Direccion"><el-input v-model="form.address" /></el-form-item>
          <el-form-item class="full" label="Notas"><el-input v-model="form.notes" type="textarea" :rows="4" /></el-form-item>
          <el-form-item label="Activo"><el-switch v-model="form.active" /></el-form-item>
        </div>
        <div class="toolbar">
          <el-button @click="$router.push('/providers')">Cancelar</el-button>
          <el-button type="primary" @click="save">Guardar Proveedor</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { providersApi } from '../services/api';
import { useProviderStore } from '../stores/providerStore';

const route = useRoute();
const router = useRouter();
const store = useProviderStore();
const form = reactive({
  companyName: '',
  primaryContactName: '',
  primaryContactEmail: '',
  primaryContactPhone: '',
  address: '',
  website: '',
  taxId: '',
  notes: '',
  active: true
} as any);

onMounted(async () => {
  if (route.params.id) Object.assign(form, await providersApi.get(route.params.id as string));
});

async function save() {
  await store.saveProvider(form);
  router.push('/providers');
}
</script>
