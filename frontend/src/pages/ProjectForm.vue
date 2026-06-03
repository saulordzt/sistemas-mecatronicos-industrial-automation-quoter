<template>
  <div class="page">
    <div class="page-header"><h1>{{ form.id ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</h1></div>
    <el-card>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="Cliente">
            <el-select v-model="form.customerId" filterable>
              <el-option v-for="customer in customers.customers" :key="customer.id" :label="customer.companyName" :value="customer.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="Nombre del proyecto"><el-input v-model="form.projectName" /></el-form-item>
          <el-form-item label="Tipo de proyecto">
            <el-select v-model="form.projectType">
              <el-option v-for="type in projectTypes" :key="type" :label="type" :value="type" />
            </el-select>
          </el-form-item>
          <el-form-item label="Industria"><el-input v-model="form.industry" /></el-form-item>
          <el-form-item label="Ubicacion"><el-input v-model="form.location" /></el-form-item>
          <el-form-item label="Estatus"><el-input v-model="form.status" /></el-form-item>
          <el-form-item label="Created date"><el-input v-model="form.createdDate" type="date" /></el-form-item>
          <el-form-item class="full" label="Descripcion"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
        </div>
        <div class="toolbar">
          <el-button @click="$router.push('/projects')">Cancelar</el-button>
          <el-button type="primary" @click="save">Guardar Proyecto</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { projectsApi } from '../services/api';
import { useCustomerStore } from '../stores/customerStore';
import { useProjectStore } from '../stores/projectStore';

const projectTypes = ['PLC programming', 'HMI development', 'Electrical panel', 'Retrofit', 'Machine automation', 'Troubleshooting', 'Integration project'];
const route = useRoute();
const router = useRouter();
const store = useProjectStore();
const customers = useCustomerStore();
const form = reactive({ customerId: '', projectName: '', projectType: '', industry: '', location: '', description: '', status: 'Active', createdDate: new Date().toISOString().slice(0, 10) } as any);

onMounted(async () => {
  await customers.fetchCustomers();
  if (route.params.id) Object.assign(form, await projectsApi.get(route.params.id as string));
});

async function save() {
  await store.saveProject(form);
  router.push('/projects');
}
</script>
