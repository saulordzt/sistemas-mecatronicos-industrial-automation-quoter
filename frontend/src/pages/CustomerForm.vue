<template>
  <div class="page">
    <div class="page-header"><h1>{{ form.id ? 'Editar Cliente' : 'Nuevo Cliente' }}</h1></div>
    <el-card>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="Empresa"><el-input v-model="form.companyName" /></el-form-item>
          <el-form-item label="Contacto"><el-input v-model="form.contactName" /></el-form-item>
          <el-form-item label="Correo"><el-input v-model="form.email" /></el-form-item>
          <el-form-item label="Telefono"><el-input v-model="form.phone" /></el-form-item>
          <el-form-item label="RFC o tax ID"><el-input v-model="form.taxId" /></el-form-item>
          <el-form-item label="Direccion"><el-input v-model="form.address" /></el-form-item>
          <el-form-item class="full" label="Notas"><el-input v-model="form.notes" type="textarea" :rows="4" /></el-form-item>
        </div>
        <div class="toolbar">
          <el-button @click="$router.push('/customers')">Cancelar</el-button>
          <el-button type="primary" @click="save">Guardar Cliente</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { customersApi } from '../services/api';
import { useCustomerStore } from '../stores/customerStore';

const route = useRoute();
const router = useRouter();
const store = useCustomerStore();
const form = reactive({ companyName: '', contactName: '', email: '', phone: '', address: '', taxId: '', notes: '' } as any);

onMounted(async () => {
  if (route.params.id) Object.assign(form, await customersApi.get(route.params.id as string));
});

async function save() {
  await store.saveCustomer(form);
  router.push('/customers');
}
</script>
