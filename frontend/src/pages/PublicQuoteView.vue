<template>
  <div class="public-quote-page">
    <div class="public-quote-shell" v-loading="loading">
      <header class="public-quote-header">
        <img src="../assets/brand/logo.png" alt="Sistemas Mecatronicos" />
        <div>
          <span class="muted">Propuesta de cotizacion</span>
          <h1>{{ quote?.quoteNumber || 'Quote' }}</h1>
          <el-tag>{{ quoteStatusLabel(quote?.status || 'Draft') }}</el-tag>
        </div>
        <el-button type="primary" @click="downloadPdf">Descargar PDF</el-button>
      </header>

      <section class="public-quote-summary">
        <el-card shadow="never">
          <template #header>Cliente</template>
          <strong>{{ quote?.customerSnapshot?.companyName || '-' }}</strong>
          <p>{{ quote?.customerSnapshot?.contactName || '-' }}</p>
          <p>{{ quote?.customerSnapshot?.email || '-' }}</p>
        </el-card>
        <el-card shadow="never">
          <template #header>Proyecto</template>
          <strong>{{ quote?.projectSnapshot?.projectName || '-' }}</strong>
          <p>{{ quote?.projectSnapshot?.projectType || '-' }}</p>
          <p>{{ quote?.projectSnapshot?.location || '-' }}</p>
        </el-card>
        <el-card shadow="never" class="public-total-card">
          <template #header>Total</template>
          <strong>{{ quote?.commercial?.currency }} {{ money(quote?.totals?.finalTotal) }}</strong>
          <p>Vigencia {{ quote?.commercial?.quoteValidityDays || 0 }} dias</p>
        </el-card>
      </section>

      <el-card class="section-card" shadow="never">
        <template #header>Alcance del Trabajo</template>
        <p class="notes-text">{{ quote?.scopeOfWork || 'Alcance por definir.' }}</p>
      </el-card>

      <el-card class="section-card" shadow="never">
        <template #header>Lista de Materiales</template>
        <div class="table-scroll">
          <el-table :data="quote?.materials || []" stripe>
          <el-table-column prop="partNumber" label="Parte #" min-width="140" />
          <el-table-column prop="description" label="Descripcion" min-width="260" />
          <el-table-column prop="quantity" label="Cant." width="90" />
          <el-table-column label="Total" width="150" align="right">
            <template #default="{ row }">{{ quote?.commercial?.currency }} {{ money(row.totalPrice) }}</template>
          </el-table-column>
          </el-table>
        </div>
      </el-card>

      <el-card class="section-card" shadow="never">
        <template #header>Mano de Obra y Servicios</template>
        <div class="table-scroll">
          <el-table :data="quote?.services || []" stripe>
          <el-table-column prop="serviceType" label="Servicio" min-width="170" />
          <el-table-column prop="description" label="Descripcion" min-width="260" />
          <el-table-column prop="hours" label="Horas" width="90" />
          <el-table-column label="Total" width="150" align="right">
            <template #default="{ row }">{{ quote?.commercial?.currency }} {{ money(row.total) }}</template>
          </el-table-column>
          </el-table>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>Terminos Comerciales</template>
        <div class="detail-list public-terms">
          <div><strong>Entrega</strong><span>{{ quote?.commercial?.deliveryTime || '-' }}</span></div>
          <div><strong>Pago</strong><span>{{ quote?.commercial?.paymentTerms || '-' }}</span></div>
          <div><strong>Exclusiones</strong><span>{{ quote?.exclusions || '-' }}</span></div>
          <div><strong>Notas</strong><span>{{ quote?.notes || '-' }}</span></div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { publicQuotesApi } from '../services/api';
import { generateQuotePdf } from '../services/pdfService';
import { useSettingsStore } from '../stores/settingsStore';
import { quoteStatusLabels } from '../utils/quoteDefaults';

const route = useRoute();
const settings = useSettingsStore();
const quote = ref<any>(null);
const loading = ref(false);

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quoteStatusLabel(status: string) {
  return quoteStatusLabels[status] || status;
}

async function downloadPdf() {
  if (!quote.value?.id) return;
  const result = await publicQuotesApi.trackPdfDownload(quote.value.id);
  quote.value.clientPdfDownloadCount = result.clientPdfDownloadCount;
  quote.value.lastClientPdfDownloadAt = result.lastClientPdfDownloadAt;
  generateQuotePdf(quote.value, settings.company);
}

onMounted(async () => {
  settings.load();
  loading.value = true;
  try {
    quote.value = await publicQuotesApi.get(route.params.id as string);
  } catch (_error) {
    ElMessage.error('La liga de cotizacion no esta disponible');
  } finally {
    loading.value = false;
  }
});
</script>
