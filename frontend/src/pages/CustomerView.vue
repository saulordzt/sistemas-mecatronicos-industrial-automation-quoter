<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>{{ customer?.companyName || 'Cliente' }}</h1>
        <p class="muted">{{ customer?.contactName || 'Sin contacto asignado' }}</p>
      </div>
      <div class="table-actions">
        <el-button @click="$router.push('/customers')">Atras</el-button>
        <el-button type="primary" :disabled="!customer" @click="openCustomerEdit">Editar Cliente</el-button>
      </div>
    </div>

    <div class="client-view-grid">
      <el-card class="section-card">
        <template #header>Informacion del Cliente</template>
        <div class="detail-list">
          <div><strong>Empresa</strong><span>{{ customer?.companyName || '-' }}</span></div>
          <div><strong>Contacto</strong><span>{{ customer?.contactName || '-' }}</span></div>
          <div><strong>Correo</strong><span>{{ customer?.email || '-' }}</span></div>
          <div><strong>Telefono</strong><span>{{ customer?.phone || '-' }}</span></div>
          <div><strong>RFC / Tax ID</strong><span>{{ customer?.taxId || '-' }}</span></div>
          <div><strong>Direccion</strong><span>{{ customer?.address || '-' }}</span></div>
        </div>
      </el-card>

      <el-card class="section-card">
        <template #header>Resumen Comercial</template>
        <div class="metric-grid compact">
          <el-card shadow="never"><el-statistic title="Proyectos" :value="clientProjects.length" /></el-card>
          <el-card shadow="never"><el-statistic title="Cotizaciones" :value="clientQuotes.length" /></el-card>
          <el-card shadow="never"><el-statistic title="Aprobadas" :value="approvedQuotes.length" /></el-card>
          <el-card shadow="never"><el-statistic title="Total Cotizado" :value="quotedTotal" prefix="$" /></el-card>
        </div>
      </el-card>
    </div>

    <el-card class="section-card">
      <template #header>Notas</template>
      <p class="notes-text">{{ customer?.notes || 'No hay notas registradas para este cliente.' }}</p>
    </el-card>

    <el-card class="section-card">
      <template #header>
        <div class="page-header" style="margin: 0">
          <strong>Proyectos</strong>
          <el-button size="small" @click="$router.push('/projects/new')">Nuevo Proyecto</el-button>
        </div>
      </template>
      <el-table :data="clientProjects" stripe>
        <el-table-column prop="projectName" label="Proyecto" min-width="200" />
        <el-table-column prop="projectType" label="Tipo" min-width="160" />
        <el-table-column prop="industry" label="Industria" min-width="140" />
        <el-table-column prop="status" label="Estatus" width="120" />
        <el-table-column label="Acciones" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="openProject(row.id)">Abrir</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="page-header" style="margin: 0">
          <strong>Cotizaciones</strong>
          <el-button size="small" type="primary" @click="$router.push('/quotes/new')">Nueva Cotizacion</el-button>
        </div>
      </template>
      <el-table :data="clientQuotes" stripe>
        <el-table-column prop="quoteNumber" label="Cotizacion" min-width="150" />
        <el-table-column prop="status" label="Estatus" width="120">
          <template #default="{ row }"><el-tag>{{ quoteStatusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="Proyecto" min-width="180">
          <template #default="{ row }">{{ row.projectSnapshot?.projectName || projectName(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="Total" width="150" align="right">
          <template #default="{ row }">{{ row.commercial?.currency }} {{ money(row.totals?.finalTotal) }}</template>
        </el-table-column>
        <el-table-column label="Acciones" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="openQuote(row.id)">Abrir</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCustomerStore } from '../stores/customerStore';
import { useProjectStore } from '../stores/projectStore';
import { useQuoteStore } from '../stores/quoteStore';
import { quoteStatusLabels } from '../utils/quoteDefaults';

const route = useRoute();
const router = useRouter();
const customers = useCustomerStore();
const projects = useProjectStore();
const quotes = useQuoteStore();

const customer = computed(() => customers.customers.find((item) => item.id === route.params.id));
const clientProjects = computed(() => projects.projects.filter((project) => project.customerId === route.params.id));
const clientQuotes = computed(() => quotes.quotes.filter((quote) => quote.customerId === route.params.id));
const approvedQuotes = computed(() => clientQuotes.value.filter((quote) => quote.status === 'Approved'));
const quotedTotal = computed(() => Number(clientQuotes.value.reduce((sum, quote) => sum + Number(quote.totals?.finalTotal || 0), 0).toFixed(2)));

function openCustomerEdit() {
  if (customer.value?.id) router.push('/customers/' + customer.value.id + '/edit');
}

function openProject(id: string) {
  router.push('/projects/' + id + '/edit');
}

function openQuote(id: string) {
  router.push('/quotes/' + id + '/edit');
}

function projectName(projectId: string) {
  return projects.projects.find((project) => project.id === projectId)?.projectName || '-';
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quoteStatusLabel(status: string) {
  return quoteStatusLabels[status] || status;
}

onMounted(async () => {
  await Promise.all([customers.fetchCustomers(), projects.fetchProjects(), quotes.fetchQuotes()]);
});
</script>
