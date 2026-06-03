<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Panel</h1>
        <p class="muted">Pipeline de cotizaciones para control, integracion, tableros y servicios en campo.</p>
      </div>
      <img src="../assets/brand/logo.png" alt="Company logo" style="height: 46px; object-fit: contain" />
    </div>

    <div class="metric-grid">
      <el-card><el-statistic title="Cotizaciones Totales" :value="summary.totalQuotes" /></el-card>
      <el-card><el-statistic title="Borradores" :value="summary.draftQuotes" /></el-card>
      <el-card><el-statistic title="Aprobadas" :value="summary.approvedQuotes" /></el-card>
      <el-card><el-statistic title="Monto Total Cotizado" :value="summary.totalQuotedAmount" :precision="2" /></el-card>
    </div>

    <el-card>
      <template #header>Cotizaciones Recientes</template>
      <el-table :data="summary.recentQuotes" stripe>
        <el-table-column prop="quoteNumber" label="Cotizacion" min-width="140" />
        <el-table-column label="Variante" min-width="130">
          <template #default="{ row }">{{ row.variantName || 'Base' }}</template>
        </el-table-column>
        <el-table-column label="Revision" width="90" align="center">
          <template #default="{ row }">R{{ row.revisionNumber || 1 }}</template>
        </el-table-column>
        <el-table-column prop="customerSnapshot.companyName" label="Cliente" min-width="180" />
        <el-table-column prop="projectSnapshot.projectName" label="Proyecto" min-width="180" />
        <el-table-column prop="status" label="Estatus" width="120">
          <template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="Actualizada" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="Total" width="160" align="right">
          <template #default="{ row }">{{ row.commercial?.currency }} {{ money(row.totals?.finalTotal) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { dashboardApi } from '../services/api';

const summary = reactive({
  totalQuotes: 0,
  draftQuotes: 0,
  approvedQuotes: 0,
  totalQuotedAmount: 0,
  recentQuotes: [] as any[]
});

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

onMounted(async () => {
  Object.assign(summary, await dashboardApi.get());
});
</script>
