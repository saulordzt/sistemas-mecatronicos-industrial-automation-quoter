<template>
  <div class="page">
    <div class="page-header">
      <h1>Asistente de Cotizacion</h1>
      <el-button type="primary" @click="createQuote">Crear Cotizacion Borrador</el-button>
    </div>

    <el-card class="section-card ai-card">
      <template #header>
        <div class="card-header-inline">
          <span>Asistente AI</span>
          <el-button type="primary" :loading="aiLoading" @click="analyzeWithAi">Analizar con AI</el-button>
        </div>
      </template>
      <div class="ai-grid">
        <el-form-item class="full" label="Brief del proyecto">
          <el-input
            v-model="aiBrief"
            type="textarea"
            :rows="4"
            placeholder="Describe el proyecto, el proceso, los equipos, el alcance y cualquier restriccion relevante."
          />
        </el-form-item>
        <el-alert v-if="aiError" type="error" :closable="false" :title="aiError" />
        <template v-if="aiPreview">
          <div class="ai-preview-grid">
            <el-card shadow="never">
              <template #header>
                <div class="card-header-inline">
                  <span>Campos sugeridos</span>
                  <el-button size="small" @click="applyAiWizard">Aplicar datos</el-button>
                </div>
              </template>
              <div class="preview-list">
                <div><strong>DI/DO:</strong> {{ aiPreview.wizard.digitalInputs }} / {{ aiPreview.wizard.digitalOutputs }}</div>
                <div><strong>AI/AO:</strong> {{ aiPreview.wizard.analogInputs }} / {{ aiPreview.wizard.analogOutputs }}</div>
                <div><strong>PLC/HMI:</strong> {{ yesNo(aiPreview.wizard.plcRequired) }} / {{ yesNo(aiPreview.wizard.hmiRequired) }}</div>
                <div><strong>Tablero:</strong> {{ yesNo(aiPreview.wizard.electricalPanelRequired) }}</div>
                <div><strong>Instalacion:</strong> {{ yesNo(aiPreview.wizard.installationRequired) }}</div>
                <div><strong>Puesta en marcha:</strong> {{ yesNo(aiPreview.wizard.commissioningRequired) }}</div>
                <div><strong>Complejidad:</strong> {{ levelLabel(aiPreview.wizard.complexityLevel) }}</div>
                <div><strong>Riesgo:</strong> {{ levelLabel(aiPreview.wizard.riskLevel) }}</div>
              </div>
            </el-card>

            <el-card shadow="never">
              <template #header>
                <div class="card-header-inline">
                  <span>Alcance, exclusiones y notas</span>
                  <el-button size="small" @click="applyAiNarrative">Aplicar texto</el-button>
                </div>
              </template>
              <div class="preview-copy">
                <p><strong>Alcance:</strong> {{ aiPreview.scopeOfWork || 'Sin sugerencia' }}</p>
                <p><strong>Exclusiones:</strong> {{ aiPreview.exclusions || 'Sin sugerencia' }}</p>
                <p><strong>Notas:</strong> {{ aiPreview.notes || 'Sin sugerencia' }}</p>
              </div>
            </el-card>

            <el-card shadow="never">
              <template #header>
                <div class="card-header-inline">
                  <span>Servicios sugeridos</span>
                  <el-button size="small" @click="applyAiServices">Aplicar servicios</el-button>
                </div>
              </template>
              <div class="preview-list">
                <div v-for="service in aiPreview.services" :key="`${service.serviceType}-${service.description}`" class="preview-item">
                  <strong>{{ service.serviceType }}</strong>
                  <span>{{ service.hours }} h x {{ money(service.hourlyRate) }}</span>
                  <small>{{ service.description }}</small>
                  <small v-if="service.reason">{{ service.reason }}</small>
                </div>
                <div v-if="!aiPreview.services.length" class="muted">Sin servicios sugeridos.</div>
              </div>
            </el-card>

            <el-card shadow="never">
              <template #header>
                <div class="card-header-inline">
                  <span>Materiales sugeridos</span>
                  <el-button size="small" @click="applyAiMaterials">Aplicar materiales</el-button>
                </div>
              </template>
              <div class="preview-list">
                <div v-for="material in aiPreview.materials" :key="material.partNumber" class="preview-item">
                  <strong>{{ material.partNumber }}</strong>
                  <span>{{ material.description }}</span>
                  <small>Cantidad sugerida: {{ material.quantity }}</small>
                  <small v-if="material.reason">{{ material.reason }}</small>
                </div>
                <div v-if="!aiPreview.materials.length" class="muted">Sin materiales sugeridos.</div>
              </div>
            </el-card>
          </div>

          <el-alert
            v-if="aiPreview.assumptions.length"
            type="info"
            :closable="false"
            title="Supuestos"
            :description="aiPreview.assumptions.join(' | ')"
          />
          <el-alert
            v-if="aiPreview.warnings.length"
            type="warning"
            :closable="false"
            title="Advertencias"
            :description="aiPreview.warnings.join(' | ')"
          />
        </template>
      </div>
    </el-card>

    <el-card class="section-card">
      <el-steps :active="activeStep" finish-status="success" align-center>
        <el-step v-for="step in steps" :key="step" :title="step" />
      </el-steps>
    </el-card>

    <el-card>
      <template #header>{{ steps[activeStep] }}</template>

      <div v-if="activeStep === 0" class="form-grid">
        <el-form-item label="Cliente">
          <el-select v-model="quote.customerId" filterable @change="syncProjectOptions">
            <el-option v-for="customer in customers.customers" :key="customer.id" :label="customer.companyName" :value="customer.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Proyecto">
          <el-select v-model="quote.projectId" filterable>
            <el-option v-for="project in filteredProjects" :key="project.id" :label="project.projectName" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item class="full" label="Alcance del trabajo"><el-input v-model="quote.scopeOfWork" type="textarea" :rows="5" /></el-form-item>
      </div>

      <div v-if="activeStep === 1" class="form-grid">
        <el-form-item label="Entradas digitales"><el-input-number v-model="wizard.digitalInputs" :min="0" /></el-form-item>
        <el-form-item label="Salidas digitales"><el-input-number v-model="wizard.digitalOutputs" :min="0" /></el-form-item>
        <el-form-item label="Entradas analogicas"><el-input-number v-model="wizard.analogInputs" :min="0" /></el-form-item>
        <el-form-item label="Salidas analogicas"><el-input-number v-model="wizard.analogOutputs" :min="0" /></el-form-item>
      </div>

      <div v-if="activeStep === 2" class="form-grid">
        <el-form-item label="PLC requerido"><el-switch v-model="wizard.plcRequired" /></el-form-item>
        <el-form-item label="HMI requerido"><el-switch v-model="wizard.hmiRequired" /></el-form-item>
        <el-form-item label="Nivel de complejidad">
          <el-select v-model="wizard.complexityLevel"><el-option label="Bajo" value="low" /><el-option label="Medio" value="medium" /><el-option label="Alto" value="high" /></el-select>
        </el-form-item>
      </div>

      <div v-if="activeStep === 3" class="form-grid">
        <el-form-item label="Tablero electrico requerido"><el-switch v-model="wizard.electricalPanelRequired" /></el-form-item>
      </div>

      <div v-if="activeStep === 4" class="form-grid">
        <el-form-item label="Instalacion requerida"><el-switch v-model="wizard.installationRequired" /></el-form-item>
        <el-form-item label="Puesta en marcha requerida"><el-switch v-model="wizard.commissioningRequired" /></el-form-item>
        <el-form-item label="Nivel de riesgo">
          <el-select v-model="wizard.riskLevel" @change="applyRisk"><el-option label="Bajo" value="low" /><el-option label="Medio" value="medium" /><el-option label="Alto" value="high" /></el-select>
        </el-form-item>
      </div>

      <div v-if="activeStep === 5">
        <div class="table-actions"><el-button size="small" @click="catalogDialogVisible = true">Seleccionar del Catalogo</el-button><el-button size="small" @click="addMaterial">Agregar Material</el-button></div>
        <div class="table-scroll" style="margin-top: 12px"><el-table :data="quote.materials" stripe>
          <el-table-column label="No. de parte" min-width="140"><template #default="{ row }"><el-input v-model="row.partNumber" /></template></el-table-column>
          <el-table-column label="Descripcion" min-width="220"><template #default="{ row }"><el-input v-model="row.description" /></template></el-table-column>
          <el-table-column label="Brand" min-width="130"><template #default="{ row }"><el-input v-model="row.brand" /></template></el-table-column>
          <el-table-column label="Cant." width="110"><template #default="{ row }"><el-input-number v-model="row.quantity" :min="0" @change="refreshTotals" /></template></el-table-column>
          <el-table-column label="Costo unitario" width="140"><template #default="{ row }"><el-input-number v-model="row.unitCost" :min="0" :precision="2" @change="refreshTotals" /></template></el-table-column>
          <el-table-column label="Total" width="130" align="right"><template #default="{ row }">{{ money(row.totalPrice) }}</template></el-table-column>
        </el-table></div>
      </div>

      <el-dialog v-model="catalogDialogVisible" title="Seleccionar Productos" width="min(1100px, 94vw)" @open="fetchCatalogProducts(1)">
        <el-input v-model="catalogSearch" placeholder="Buscar en catalogo" clearable style="margin-bottom: 12px" @input="onCatalogSearch" />
        <div class="table-scroll catalog-table-scroll"><el-table :data="catalogProducts" v-loading="catalogLoading" stripe height="420">
          <el-table-column prop="partNumber" label="No. de parte" min-width="150" />
          <el-table-column prop="description" label="Descripcion" min-width="240" />
          <el-table-column prop="supplier" label="Proveedor" min-width="130" />
          <el-table-column label="Costo" width="130" align="right"><template #default="{ row }">{{ row.currency }} {{ money(row.unitCost) }}</template></el-table-column>
          <el-table-column label="" width="130">
            <template #default="{ row }">
              <div class="table-actions">
                <el-tooltip v-if="isAutomationDirectProduct(row)" content="Ver en AutomationDirect" placement="top">
                  <el-button size="small" circle @click="openAutomationDirectProduct(row)">
                    <el-icon><TopRight /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-button size="small" type="primary" @click="addProductToBom(row)">Agregar</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table></div>
        <div class="pagination-bar">
          <span class="muted">{{ catalogTotal.toLocaleString() }} productos</span>
          <el-pagination
            v-model:current-page="catalogPage"
            v-model:page-size="catalogPageSize"
            :total="catalogTotal"
            :page-sizes="[25, 50, 100]"
            layout="sizes, prev, pager, next"
            @size-change="onCatalogPageSizeChange"
            @current-change="fetchCatalogProducts"
          />
        </div>
      </el-dialog>

      <div v-if="activeStep === 6" class="form-grid">
        <el-form-item label="Margen materiales %"><el-input-number v-model="quote.commercial.materialMarkupPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Margen mano de obra %"><el-input-number v-model="quote.commercial.laborMarkupPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Contingencia %"><el-input-number v-model="quote.commercial.contingencyPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Descuento %"><el-input-number v-model="quote.commercial.discountPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="IVA %"><el-input-number v-model="quote.commercial.taxPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Moneda"><el-select v-model="quote.commercial.currency"><el-option label="MXN" value="MXN" /><el-option label="USD" value="USD" /></el-select></el-form-item>
        <el-form-item v-if="quote.commercial.currency === 'MXN'" label="USD to MXN rate"><el-input-number v-model="quote.commercial.usdToMxnRate" :min="0" :precision="4" /></el-form-item>
        <el-form-item label="Condiciones de pago"><el-input v-model="quote.commercial.paymentTerms" /></el-form-item>
        <el-form-item label="Tiempo de entrega"><el-input v-model="quote.commercial.deliveryTime" /></el-form-item>
        <el-form-item label="Dias de vigencia"><el-input-number v-model="quote.commercial.quoteValidityDays" :min="1" /></el-form-item>
      </div>

      <div v-if="activeStep === 7">
        <div class="totals-panel">
          <div class="total-line"><strong>Entradas / Salidas</strong><span>{{ totalIo }}</span></div>
          <div class="total-line"><strong>Riesgo</strong><span>{{ wizard.riskLevel }}</span></div>
          <div class="total-line"><strong>Materiales</strong><span>{{ money(quote.totals.materialsSubtotal) }}</span></div>
          <div class="total-line"><strong>Total final</strong><span>{{ quote.commercial.currency }} {{ money(quote.totals.finalTotal) }}</span></div>
        </div>
      </div>

      <div class="toolbar">
        <el-button :disabled="activeStep === 0" @click="activeStep--">Atras</el-button>
        <el-button :disabled="activeStep === steps.length - 1" type="primary" @click="activeStep++">Siguiente</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { TopRight } from '@element-plus/icons-vue';
import { useCustomerStore } from '../stores/customerStore';
import { useProjectStore } from '../stores/projectStore';
import { useQuoteStore } from '../stores/quoteStore';
import { aiApi, productsApi } from '../services/api';
import type { QuoteAssistantPreview } from '../types';
import { isAutomationDirectProduct, openAutomationDirectProduct } from '../utils/automationDirect';
import { calculateQuoteTotals, getRiskContingencySuggestion, updateMaterialTotals, updateServiceTotals } from '../utils/quoteCalculations';
import { createEmptyQuote } from '../utils/quoteDefaults';

const steps = ['Informacion del proyecto', 'Entradas y salidas', 'Requerimientos PLC/HMI', 'Requerimientos de tablero electrico', 'Mano de obra/servicios', 'Materiales/BOM', 'Configuracion comercial', 'Revisar cotizacion'];
const activeStep = ref(0);
const router = useRouter();
const customers = useCustomerStore();
const projects = useProjectStore();
const quoteStore = useQuoteStore();
const catalogDialogVisible = ref(false);
const catalogSearch = ref('');
const catalogProducts = ref<any[]>([]);
const catalogLoading = ref(false);
const catalogPage = ref(1);
const catalogPageSize = ref(50);
const catalogTotal = ref(0);
const aiBrief = ref('');
const aiLoading = ref(false);
const aiError = ref('');
const aiPreview = ref<QuoteAssistantPreview | null>(null);
const quote = reactive<any>(createEmptyQuote());
const wizard = reactive({
  digitalInputs: 0,
  digitalOutputs: 0,
  analogInputs: 0,
  analogOutputs: 0,
  plcRequired: true,
  hmiRequired: false,
  electricalPanelRequired: false,
  installationRequired: false,
  commissioningRequired: true,
  complexityLevel: 'medium',
  riskLevel: 'low'
});

const filteredProjects = computed(() => projects.projects.filter((project) => !quote.customerId || project.customerId === quote.customerId));
let catalogSearchTimer: number | undefined;

async function fetchCatalogProducts(page = catalogPage.value) {
  catalogLoading.value = true;
  try {
    const response = await productsApi.list({ page, pageSize: catalogPageSize.value, search: catalogSearch.value });
    catalogProducts.value = (response.items || []).filter((product: any) => product.active !== false);
    catalogTotal.value = response.total || 0;
    catalogPage.value = response.page || page;
    catalogPageSize.value = response.pageSize || catalogPageSize.value;
  } finally {
    catalogLoading.value = false;
  }
}

function onCatalogSearch() {
  window.clearTimeout(catalogSearchTimer);
  catalogSearchTimer = window.setTimeout(() => fetchCatalogProducts(1), 300);
}

function onCatalogPageSizeChange(pageSize: number) {
  catalogPageSize.value = pageSize;
  fetchCatalogProducts(1);
}

const totalIo = computed(() => wizard.digitalInputs + wizard.digitalOutputs + wizard.analogInputs + wizard.analogOutputs);

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function yesNo(value: boolean) {
  return value ? 'Si' : 'No';
}

function levelLabel(value: string) {
  if (value === 'high') return 'Alto';
  if (value === 'medium') return 'Medio';
  return 'Bajo';
}

function convertedProductCost(product: any) {
  const cost = Number(product.unitCost || 0);
  if (quote.commercial.currency === 'MXN' && product.currency === 'USD') {
    return Math.round(cost * Number(quote.commercial.usdToMxnRate || 0) * 100) / 100;
  }
  return cost;
}

function syncProjectOptions() {
  if (!filteredProjects.value.find((project) => project.id === quote.projectId)) quote.projectId = '';
}

function applyRisk() {
  quote.commercial.contingencyPercentage = getRiskContingencySuggestion(wizard.riskLevel);
  refreshTotals();
}

function addMaterial() {
  quote.materials.push(updateMaterialTotals({ partNumber: '', description: '', brand: 'AutomationDirect', supplier: '', quantity: 1, unitCost: 0, markupPercentage: quote.commercial.materialMarkupPercentage, unitPrice: 0, totalPrice: 0, notes: '' }));
}

function addProductToBom(product: any) {
  const unitCost = convertedProductCost(product);
  quote.materials.push(updateMaterialTotals({
    partNumber: product.partNumber,
    description: product.description,
    brand: product.brand,
    supplier: product.supplier,
    quantity: 1,
    unitCost,
    markupPercentage: quote.commercial.materialMarkupPercentage,
    unitPrice: 0,
    totalPrice: 0,
    notes: product.currency === 'USD' && quote.commercial.currency === 'MXN'
      ? `Catalog cost: USD ${money(product.unitCost)}. Converted at ${quote.commercial.usdToMxnRate} MXN/USD. ${product.availabilityNote || product.notes || product.leadTime || product.availabilityStatus || ''}`.trim()
      : product.availabilityNote || product.notes || product.leadTime || product.availabilityStatus || '',
    sourceCurrency: product.currency,
    sourceUnitCost: product.unitCost,
    exchangeRateApplied: product.currency === 'USD' && quote.commercial.currency === 'MXN' ? quote.commercial.usdToMxnRate : undefined
  }));
  refreshTotals();
}

function buildSuggestedServices() {
  const multiplier = wizard.complexityLevel === 'high' ? 1.5 : wizard.complexityLevel === 'medium' ? 1.15 : 1;
  const ioHours = Math.ceil(totalIo.value * 0.25 * multiplier);
  const services = [];
  if (wizard.plcRequired) services.push({ serviceType: 'Programacion PLC', description: 'PLC architecture, programming, and simulation', hours: Math.max(8, ioHours), hourlyRate: 1710, total: 0, notes: '' });
  if (wizard.hmiRequired) services.push({ serviceType: 'Programacion HMI', description: 'HMI screens, alarms, trends, and operator controls', hours: 12 * multiplier, hourlyRate: 1530, total: 0, notes: '' });
  if (wizard.electricalPanelRequired) services.push({ serviceType: 'Diseno electrico', description: 'Electrical panel design and documentation', hours: 10 * multiplier, hourlyRate: 1620, total: 0, notes: '' });
  if (wizard.installationRequired) services.push({ serviceType: 'Instalacion en campo', description: 'Field installation and wiring support', hours: 16, hourlyRate: 1350, total: 0, notes: '' });
  if (wizard.commissioningRequired) services.push({ serviceType: 'Puesta en marcha', description: 'Startup, commissioning, and production support', hours: 12, hourlyRate: 1710, total: 0, notes: '' });
  quote.services = services.map(updateServiceTotals);
}

function buildAiPayload() {
  return {
    brief: aiBrief.value,
    quote: {
      customerId: quote.customerId,
      projectId: quote.projectId,
      scopeOfWork: quote.scopeOfWork,
      exclusions: quote.exclusions,
      notes: quote.notes,
      commercial: {
        currency: quote.commercial.currency,
        paymentTerms: quote.commercial.paymentTerms,
        deliveryTime: quote.commercial.deliveryTime,
        quoteValidityDays: quote.commercial.quoteValidityDays
      }
    },
    wizard: { ...wizard }
  };
}

async function analyzeWithAi() {
  aiError.value = '';
  aiLoading.value = true;
  try {
    const response = await aiApi.generateQuoteAssistantPreview(buildAiPayload());
    aiPreview.value = response.preview || null;
  } catch (error: any) {
    aiError.value = error?.response?.data?.message || error?.message || 'No se pudo generar la vista previa con AI.';
  } finally {
    aiLoading.value = false;
  }
}

function applyAiWizard() {
  if (!aiPreview.value) return;
  Object.assign(wizard, aiPreview.value.wizard);
  applyRisk();
}

function applyAiNarrative() {
  if (!aiPreview.value) return;
  quote.scopeOfWork = aiPreview.value.scopeOfWork || quote.scopeOfWork;
  quote.exclusions = aiPreview.value.exclusions || quote.exclusions;
  quote.notes = aiPreview.value.notes || quote.notes;
}

function applyAiServices() {
  if (!aiPreview.value) return;
  quote.services = aiPreview.value.services.map((item) => updateServiceTotals({
    serviceType: item.serviceType,
    description: item.description,
    hours: item.hours,
    hourlyRate: item.hourlyRate,
    total: 0,
    notes: item.notes || item.reason || ''
  }));
  refreshTotals();
}

function applyAiMaterials() {
  if (!aiPreview.value) return;
  quote.materials = aiPreview.value.materials.map((item) => {
    const product = item.sourceProduct as any;
    const unitCost = convertedProductCost(product);
    return updateMaterialTotals({
      partNumber: item.partNumber,
      description: item.description,
      brand: item.brand,
      supplier: item.supplier,
      quantity: item.quantity,
      unitCost,
      markupPercentage: quote.commercial.materialMarkupPercentage,
      unitPrice: 0,
      totalPrice: 0,
      notes: [
        item.reason || '',
        product?.currency === 'USD' && quote.commercial.currency === 'MXN'
          ? `Catalogo USD ${money(product.unitCost)} convertido a ${quote.commercial.usdToMxnRate} MXN/USD.`
          : ''
      ].filter(Boolean).join(' '),
      sourceCurrency: product?.currency,
      sourceUnitCost: product?.unitCost,
      exchangeRateApplied: product?.currency === 'USD' && quote.commercial.currency === 'MXN' ? quote.commercial.usdToMxnRate : undefined
    });
  });
  refreshTotals();
}

function refreshTotals() {
  quote.materials = quote.materials.map((item: any) => updateMaterialTotals(item, quote.commercial.materialMarkupPercentage));
  quote.services = quote.services.map(updateServiceTotals);
  quote.totals = calculateQuoteTotals(quote.materials, quote.services, quote.commercial);
}

async function createQuote() {
  if (!quote.services.length) buildSuggestedServices();
  quote.customerSnapshot = customers.customers.find((customer) => customer.id === quote.customerId);
  quote.projectSnapshot = projects.projects.find((project) => project.id === quote.projectId);
  quote.wizard = { ...wizard };
  refreshTotals();
  const saved = await quoteStore.saveQuote(quote);
  router.push(`/quotes/${saved.id}/edit`);
}

onMounted(async () => {
  await Promise.all([customers.fetchCustomers(), projects.fetchProjects()]);
  applyRisk();
});
</script>

<style scoped>
.ai-card {
  margin-bottom: 20px;
}

.ai-grid {
  display: grid;
  gap: 16px;
}

.card-header-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.preview-list,
.preview-copy {
  display: grid;
  gap: 10px;
  color: var(--el-text-color-primary);
}

.preview-item {
  display: grid;
  gap: 4px;
}

.preview-item small,
.muted {
  color: var(--el-text-color-secondary);
}
</style>
