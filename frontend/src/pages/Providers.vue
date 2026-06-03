<template>
  <div class="page">
    <div class="page-header">
      <h1>Proveedores</h1>
      <el-button type="primary" @click="$router.push('/providers/new')">Nuevo Proveedor</el-button>
    </div>

    <el-card>
      <el-table :data="store.providers" v-loading="store.loading" stripe>
        <el-table-column prop="companyName" label="Empresa" min-width="220" />
        <el-table-column prop="primaryContactName" label="Contacto" min-width="180" />
        <el-table-column prop="primaryContactEmail" label="Correo" min-width="200" />
        <el-table-column prop="primaryContactPhone" label="Telefono" min-width="150" />
        <el-table-column label="Estatus" width="120">
          <template #default="{ row }"><el-tag :type="row.active ? 'success' : 'info'">{{ row.active ? 'Activo' : 'Inactivo' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="Acciones" width="160">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" @click="$router.push(`/providers/${row.id}/edit`)">Editar</el-button>
              <el-button size="small" type="danger" @click="store.deleteProvider(row.id)">Eliminar</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useProviderStore } from '../stores/providerStore';

const store = useProviderStore();
onMounted(store.fetchProviders);
</script>
