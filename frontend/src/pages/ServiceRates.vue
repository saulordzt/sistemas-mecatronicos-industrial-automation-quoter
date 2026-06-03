<template>
  <div class="page">
    <div class="page-header">
      <h1>Tarifas de Servicio</h1>
      <el-button type="primary" @click="openRate()">Nueva Tarifa</el-button>
    </div>

    <el-card>
      <el-table :data="store.serviceRates" v-loading="store.loading" stripe>
        <el-table-column prop="serviceType" label="Tipo de servicio" min-width="180" />
        <el-table-column prop="description" label="Descripcion" min-width="220" />
        <el-table-column prop="hourlyRate" label="Tarifa por hora" width="140" />
        <el-table-column prop="currency" label="Moneda" width="110" />
        <el-table-column label="Acciones" width="170">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" @click="openRate(row)">Editar</el-button>
              <el-button size="small" type="danger" @click="store.deleteServiceRate(row.id)">Eliminar</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="Tarifa de Servicio" width="560px">
      <el-form label-position="top">
        <el-form-item label="Tipo de servicio"><el-input v-model="form.serviceType" /></el-form-item>
        <el-form-item label="Descripcion"><el-input v-model="form.description" /></el-form-item>
        <el-form-item label="Tarifa por hora"><el-input-number v-model="form.hourlyRate" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="Moneda"><el-select v-model="form.currency"><el-option label="MXN" value="MXN" /><el-option label="USD" value="USD" /></el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Cancelar</el-button>
        <el-button type="primary" @click="save">Guardar</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useServiceRateStore } from '../stores/serviceRateStore';

const store = useServiceRateStore();
const dialogVisible = ref(false);
const form = reactive<any>({ serviceType: '', description: '', hourlyRate: 0, currency: 'MXN', active: true });

function openRate(row?: any) {
  Object.assign(form, row || { id: undefined, serviceType: '', description: '', hourlyRate: 0, currency: 'MXN', active: true });
  dialogVisible.value = true;
}

async function save() {
  await store.saveServiceRate(form);
  dialogVisible.value = false;
}

onMounted(store.fetchServiceRates);
</script>
