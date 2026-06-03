<template>
  <div class="page">
    <div class="page-header">
      <h1>Clientes</h1>
      <el-button type="primary" @click="$router.push('/customers/new')">Nuevo Cliente</el-button>
    </div>

    <el-card>
      <el-table :data="store.customers" v-loading="store.loading" stripe>
        <el-table-column prop="companyName" label="Empresa" min-width="180" />
        <el-table-column prop="contactName" label="Contacto" min-width="160" />
        <el-table-column prop="email" label="Correo" min-width="180" />
        <el-table-column prop="phone" label="Telefono" min-width="130" />
        <el-table-column prop="taxId" label="RFC / Tax ID" min-width="130" />
        <el-table-column label="Acciones" width="230">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" @click="$router.push(`/customers/${row.id}`)">Ver</el-button>
              <el-button size="small" @click="$router.push(`/customers/${row.id}/edit`)">Editar</el-button>
              <el-button size="small" type="danger" @click="store.deleteCustomer(row.id)">Eliminar</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useCustomerStore } from '../stores/customerStore';

const store = useCustomerStore();
onMounted(store.fetchCustomers);
</script>
