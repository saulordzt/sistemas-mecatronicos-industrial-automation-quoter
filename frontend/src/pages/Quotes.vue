<template>
  <div class="page">
    <div class="page-header">
      <h1>Cotizaciones</h1>
      <div class="table-actions">
        <el-button @click="$router.push('/quote-assistant')">Asistente</el-button>
        <el-button type="primary" @click="$router.push('/quotes/new')">Nueva Cotizacion</el-button>
      </div>
    </div>

    <el-card v-if="!isMobile">
      <el-table :data="groupedQuotes" row-key="id" :tree-props="{ children: 'children' }" v-loading="store.loading" stripe default-expand-all>
        <el-table-column prop="quoteNumber" label="Cotizacion" min-width="220">
          <template #default="{ row }">
            <div class="quote-cell">
              <span>{{ row.quoteNumber }}</span>
              <el-tag v-if="isOriginalQuote(row)" size="small" effect="plain">Original</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Variante" min-width="140">
          <template #default="{ row }">{{ row.variantName || 'Base' }}</template>
        </el-table-column>
        <el-table-column label="Revision" width="100" align="center">
          <template #default="{ row }">R{{ row.revisionNumber || 1 }}</template>
        </el-table-column>
        <el-table-column prop="customerSnapshot.companyName" label="Cliente" min-width="180" />
        <el-table-column prop="projectSnapshot.projectName" label="Proyecto" min-width="180" />
        <el-table-column prop="status" label="Estatus" width="120">
          <template #default="{ row }"><el-tag>{{ quoteStatusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="Creada" min-width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="Actualizada" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="Descargas PDF" width="140" align="center">
          <template #default="{ row }">{{ row.clientPdfDownloadCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="Total" width="160" align="right">
          <template #default="{ row }">{{ row.commercial?.currency }} {{ money(row.totals?.finalTotal) }}</template>
        </el-table-column>
        <el-table-column label="Acciones" width="140" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(command) => handleRowCommand(command, row)">
              <el-button size="small">
                Acciones
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">Editar</el-dropdown-item>
                  <el-dropdown-item command="revise">Nueva revision</el-dropdown-item>
                  <el-dropdown-item command="variant">Nueva variante</el-dropdown-item>
                  <el-dropdown-item command="duplicate">Duplicar</el-dropdown-item>
                  <el-dropdown-item command="clientLink">Liga cliente</el-dropdown-item>
                  <el-dropdown-item command="pdf">Exportar PDF</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>Eliminar</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div v-else class="quote-mobile-list" v-loading="store.loading">
      <el-card v-for="quote in mobileQuotes" :key="quote.id" class="section-card quote-mobile-card">
        <div class="quote-mobile-head">
          <div class="quote-mobile-title">
            <strong>{{ quote.quoteNumber }}</strong>
            <el-tag v-if="isOriginalQuote(quote)" size="small" effect="plain">Original</el-tag>
          </div>
          <el-dropdown trigger="click" @command="(command) => handleRowCommand(command, quote)">
            <el-button size="small">
              Acciones
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">Editar</el-dropdown-item>
                <el-dropdown-item command="revise">Nueva revision</el-dropdown-item>
                <el-dropdown-item command="variant">Nueva variante</el-dropdown-item>
                <el-dropdown-item command="duplicate">Duplicar</el-dropdown-item>
                <el-dropdown-item command="clientLink">Liga cliente</el-dropdown-item>
                <el-dropdown-item command="pdf">Exportar PDF</el-dropdown-item>
                <el-dropdown-item command="delete" divided>Eliminar</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="quote-mobile-meta">
          <span><strong>Variante:</strong> {{ quote.variantName || 'Base' }}</span>
          <span><strong>Revision:</strong> R{{ quote.revisionNumber || 1 }}</span>
          <span><strong>Cliente:</strong> {{ quote.customerSnapshot?.companyName || '-' }}</span>
          <span><strong>Proyecto:</strong> {{ quote.projectSnapshot?.projectName || '-' }}</span>
          <span><strong>Estatus:</strong> {{ quoteStatusLabel(quote.status) }}</span>
          <span><strong>Creada:</strong> {{ formatDate(quote.createdAt) }}</span>
          <span><strong>Actualizada:</strong> {{ formatDate(quote.updatedAt) }}</span>
          <span><strong>PDF:</strong> {{ quote.clientPdfDownloadCount || 0 }}</span>
        </div>

        <div class="quote-mobile-total">
          <span>Total</span>
          <strong>{{ quote.commercial?.currency }} {{ money(quote.totals?.finalTotal) }}</strong>
        </div>

        <div v-if="quote.children?.length" class="quote-mobile-children">
          <div class="quote-mobile-children-title">Revisiones y variantes</div>
          <div v-for="child in quote.children" :key="child.id" class="quote-mobile-child">
            <div>
              <strong>{{ child.quoteNumber }}</strong>
              <span>{{ child.variantName || 'Base' }} · R{{ child.revisionNumber || 1 }}</span>
            </div>
            <el-button size="small" @click="router.push(`/quotes/${child.id}/edit`)">Abrir</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useQuoteStore } from '../stores/quoteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { generateQuotePdf } from '../services/pdfService';
import type { Quote } from '../types';
import { quoteStatusLabels } from '../utils/quoteDefaults';

const store = useQuoteStore();
const settings = useSettingsStore();
const router = useRouter();
const isMobile = ref(window.innerWidth < 760);

type QuoteTreeRow = Quote & { children?: QuoteTreeRow[] };

function handleResize() {
  isMobile.value = window.innerWidth < 760;
}

const groupedQuotes = computed<QuoteTreeRow[]>(() => {
  const byFamily = new Map<string, Quote[]>();

  for (const quote of store.quotes) {
    const familyKey = quote.familyId || quote.rootQuoteId || quote.id || quote.quoteNumber;
    if (!byFamily.has(familyKey)) byFamily.set(familyKey, []);
    byFamily.get(familyKey)?.push(quote);
  }

  return [...byFamily.values()]
    .map((familyQuotes) => {
      const sorted = [...familyQuotes].sort((left, right) => {
        const rootDelta = Number(Boolean(right.id === right.rootQuoteId)) - Number(Boolean(left.id === left.rootQuoteId));
        if (rootDelta !== 0) return rootDelta;
        const variantDelta = Number(left.variantSequence || 1) - Number(right.variantSequence || 1);
        if (variantDelta !== 0) return variantDelta;
        return Number(left.revisionNumber || 1) - Number(right.revisionNumber || 1);
      });

      const rootQuote = sorted.find((item) => item.id === item.rootQuoteId) || sorted[0];
      const children = sorted.filter((item) => item.id !== rootQuote.id);
      return {
        ...rootQuote,
        children: children.length ? children : undefined
      };
    })
    .sort((left, right) => {
      const leftDate = new Date(left.createdAt || 0).getTime();
      const rightDate = new Date(right.createdAt || 0).getTime();
      return rightDate - leftDate;
    });
});

const mobileQuotes = computed(() => groupedQuotes.value);

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quoteStatusLabel(status: string) {
  return quoteStatusLabels[status] || status;
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function isOriginalQuote(row: Quote) {
  return !row.rootQuoteId || row.id === row.rootQuoteId;
}

async function duplicate(id: string) {
  try {
    const quote = await store.duplicateQuote(id);
    router.push(`/quotes/${quote.id}/edit`);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || 'No se pudo duplicar la cotizacion');
  }
}

async function revise(id: string) {
  try {
    const quote = await store.reviseQuote(id);
    ElMessage.success('Revision creada');
    router.push(`/quotes/${quote.id}/edit`);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || 'No se pudo crear la revision');
  }
}

async function createVariant(row: any) {
  const { value } = await ElMessageBox.prompt('Nombre de la variante', 'Nueva variante', {
    inputValue: row.variantSequence ? `Opcion ${Number(row.variantSequence) + 1}` : 'Opcion 2',
    confirmButtonText: 'Crear',
    cancelButtonText: 'Cancelar'
  }).catch(() => ({ value: null }));
  if (!value) return;
  try {
    const quote = await store.createQuoteVariant(row.id, value);
    ElMessage.success('Variante creada');
    router.push(`/quotes/${quote.id}/edit`);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || 'No se pudo crear la variante');
  }
}

function clientQuoteUrl(row: any) {
  return window.location.origin + '/client/quotes/' + row.id;
}

async function copyClientLink(row: any) {
  await navigator.clipboard.writeText(clientQuoteUrl(row));
  ElMessage.success('Liga de cotizacion para cliente copiada');
}

function exportPdf(row: any) {
  settings.load();
  generateQuotePdf(row, settings.company);
}

async function handleRowCommand(command: string, row: any) {
  if (command === 'edit') {
    router.push(`/quotes/${row.id}/edit`);
    return;
  }
  if (command === 'revise') {
    await revise(row.id);
    return;
  }
  if (command === 'variant') {
    await createVariant(row);
    return;
  }
  if (command === 'duplicate') {
    await duplicate(row.id);
    return;
  }
  if (command === 'clientLink') {
    await copyClientLink(row);
    return;
  }
  if (command === 'pdf') {
    exportPdf(row);
    return;
  }
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm('Esta accion eliminara la cotizacion seleccionada.', 'Eliminar cotizacion', {
        type: 'warning',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      });
      await store.deleteQuote(row.id);
      ElMessage.success('Cotizacion eliminada');
    } catch {
      return;
    }
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
  settings.load();
  store.fetchQuotes();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.quote-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quote-mobile-list {
  display: grid;
  gap: 16px;
}

.quote-mobile-card :deep(.el-card__body) {
  display: grid;
  gap: 14px;
}

.quote-mobile-head,
.quote-mobile-child {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.quote-mobile-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quote-mobile-title strong,
.quote-mobile-total strong {
  color: var(--sm-black);
}

.quote-mobile-meta {
  display: grid;
  gap: 6px;
  color: var(--sm-graphite);
}

.quote-mobile-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--sm-line);
}

.quote-mobile-children {
  display: grid;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--sm-line);
}

.quote-mobile-children-title {
  color: var(--sm-steel);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.quote-mobile-child {
  padding: 10px 0;
  border-bottom: 1px solid var(--sm-line);
}

.quote-mobile-child:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.quote-mobile-child div {
  display: grid;
  gap: 2px;
}

.quote-mobile-child span {
  color: var(--sm-steel);
  font-size: 13px;
}
</style>
