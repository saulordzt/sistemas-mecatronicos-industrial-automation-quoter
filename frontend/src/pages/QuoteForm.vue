<template>
  <div class="page">
    <div class="page-header">
      <div class="quote-form-title">
        <el-button circle @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <h1>{{ quote.id ? 'Editar Cotizacion' : 'Nueva Cotizacion' }}</h1>
      </div>
      <div class="table-actions">
        <el-button v-if="quote.id" @click="createRevision">Nueva Revision</el-button>
        <el-button v-if="quote.id" @click="createVariant">Nueva Variante</el-button>
        <el-button v-if="quote.id" @click="copyClientLink">Vista Cliente</el-button>
        <el-button v-if="quote.id" @click="emailDialogVisible = true">Enviar Liga</el-button>
        <el-button v-if="quote.id" @click="openRfqDialog">Solicitudes a Proveedores</el-button>
        <el-button @click="exportPdf">Exportar PDF</el-button>
        <el-button type="primary" @click="save">Guardar Borrador</el-button>
      </div>
    </div>

    <el-card class="section-card">
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="Numero de cotizacion"><el-input v-model="quote.quoteNumber" /></el-form-item>
          <el-form-item label="Variante"><el-input v-model="quote.variantName" /></el-form-item>
          <el-form-item label="Revision"><el-input :model-value="`R${quote.revisionNumber || 1}`" disabled /></el-form-item>
          <el-form-item label="Estatus">
            <el-select v-model="quote.status"><el-option v-for="status in quoteStatuses" :key="status" :label="quoteStatusLabels[status] || status" :value="status" /></el-select>
          </el-form-item>
          <el-form-item label="Creada"><el-input :model-value="formatDate(quote.createdAt)" disabled /></el-form-item>
          <el-form-item label="Ultima actualizacion"><el-input :model-value="formatDate(quote.updatedAt)" disabled /></el-form-item>
          <el-form-item label="Cliente">
            <el-select v-model="quote.customerId" filterable @change="syncSnapshots">
              <el-option v-for="customer in customers.customers" :key="customer.id" :label="customer.companyName" :value="customer.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="Contacto destinatario">
            <el-select v-model="quote.recipientContactId" filterable @change="syncSnapshots">
              <el-option v-for="contact in availableContacts" :key="contact.id" :label="contactLabel(contact)" :value="contact.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="Proyecto">
            <el-select v-model="quote.projectId" filterable @change="syncSnapshots">
              <el-option v-for="project in filteredProjects" :key="project.id" :label="project.projectName" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item class="full" label="Alcance del trabajo"><el-input v-model="quote.scopeOfWork" type="textarea" :rows="4" /></el-form-item>
          <el-form-item class="full" label="Exclusiones"><el-input v-model="quote.exclusions" type="textarea" :rows="3" /></el-form-item>
          <el-form-item class="full" label="Notas"><el-input v-model="quote.notes" type="textarea" :rows="3" /></el-form-item>
        </div>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <template #header>
        <div class="page-header" style="margin: 0">
          <strong>Lista de Materiales</strong>
          <div class="table-actions"><el-button size="small" @click="catalogDialogVisible = true">Seleccionar del Catalogo</el-button><el-button size="small" @click="addMaterial">Agregar Material</el-button></div>
        </div>
      </template>
      <div class="table-scroll"><el-table :data="quote.materials" stripe class="materials-table">
        <el-table-column label="No. de parte" min-width="140"><template #default="{ row }"><el-input v-model="row.partNumber" /></template></el-table-column>
        <el-table-column label="Descripcion" min-width="220"><template #default="{ row }"><el-input v-model="row.description" /></template></el-table-column>
        <el-table-column label="Marca" min-width="120"><template #default="{ row }"><el-input v-model="row.brand" /></template></el-table-column>
        <el-table-column label="Proveedor" min-width="210">
          <template #default="{ row }">
            <el-select v-model="row.providerId" filterable clearable @change="(value) => assignProviderToMaterial(row, value)">
              <el-option v-for="provider in providerOptions" :key="provider.id" :label="providerLabel(provider)" :value="provider.id" :disabled="provider.active === false" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="Cant." width="110"><template #default="{ row }"><el-input-number v-model="row.quantity" :min="0" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Costo unitario" width="140"><template #default="{ row }"><el-input-number v-model="row.unitCost" :min="0" :precision="2" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Margen %" width="130"><template #default="{ row }"><el-input-number v-model="row.markupPercentage" :min="0" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Total" width="130" align="right"><template #default="{ row }">{{ money(row.totalPrice) }}</template></el-table-column>
        <el-table-column label="" width="90"><template #default="{ $index }"><el-button size="small" type="danger" @click="removeMaterial($index)">Eliminar</el-button></template></el-table-column>
      </el-table></div>
    </el-card>

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

    <el-dialog v-model="emailDialogVisible" title="Enviar liga al cliente" width="680px">
      <el-form label-position="top">
        <el-form-item label="Destinatarios">
          <el-select v-model="emailForm.contactIds" multiple filterable style="width: 100%">
            <el-option v-for="contact in availableContacts" :key="contact.id" :label="contactLabel(contact)" :value="contact.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Asunto">
          <el-input v-model="emailForm.subject" />
        </el-form-item>
        <el-form-item label="Mensaje">
          <el-input v-model="emailForm.message" type="textarea" :rows="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="emailDialogVisible = false">Cancelar</el-button>
        <el-button type="primary" :loading="sendingEmail" @click="sendClientLinkEmail">Enviar</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rfqDialogVisible" title="Solicitudes a proveedores" width="720px">
      <el-form label-position="top">
        <el-form-item label="Fecha limite de respuesta">
          <el-input v-model="rfqForm.dueDate" type="date" />
        </el-form-item>
        <el-form-item label="Notas para proveedores">
          <el-input v-model="rfqForm.notes" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="rfqMissingRows.length"
        type="warning"
        :closable="false"
        :title="`Hay ${rfqMissingRows.length} materiales sin proveedor asignado.`"
        description="Asigna un proveedor a cada material antes de generar las solicitudes."
      />

      <el-table :data="rfqProviderSummary" stripe style="margin-top: 12px">
        <el-table-column prop="providerName" label="Proveedor" min-width="220" />
        <el-table-column prop="contactName" label="Contacto" min-width="180" />
        <el-table-column prop="contactEmail" label="Correo" min-width="220" />
        <el-table-column prop="itemCount" label="Partidas" width="100" align="center" />
      </el-table>

      <template #footer>
        <el-button @click="rfqDialogVisible = false">Cancelar</el-button>
        <el-button type="primary" :disabled="Boolean(rfqMissingRows.length || !rfqProviderSummary.length)" @click="generateProviderRfqs">
          Generar PDFs
        </el-button>
      </template>
    </el-dialog>

    <el-card class="section-card">
      <template #header>
        <div class="page-header" style="margin: 0">
          <strong>Mano de Obra y Servicios</strong>
          <el-button size="small" @click="addService">Agregar Servicio</el-button>
        </div>
      </template>
      <div class="table-scroll"><el-table :data="quote.services" stripe>
        <el-table-column label="Tipo" min-width="180">
          <template #default="{ row }"><el-select v-model="row.serviceType"><el-option v-for="type in serviceTypes" :key="type" :label="type" :value="type" /></el-select></template>
        </el-table-column>
        <el-table-column label="Descripcion" min-width="240"><template #default="{ row }"><el-input v-model="row.description" /></template></el-table-column>
        <el-table-column label="Horas" width="120"><template #default="{ row }"><el-input-number v-model="row.hours" :min="0" :precision="1" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Tarifa por hora" width="150"><template #default="{ row }"><el-input-number v-model="row.hourlyRate" :min="0" :precision="2" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Total" width="130" align="right"><template #default="{ row }">{{ money(row.total) }}</template></el-table-column>
        <el-table-column label="" width="90"><template #default="{ $index }"><el-button size="small" type="danger" @click="removeService($index)">Eliminar</el-button></template></el-table-column>
      </el-table></div>
    </el-card>

    <el-card class="section-card">
      <template #header>Configuracion Comercial</template>
      <div class="form-grid">
        <el-form-item label="Margen materiales %"><el-input-number v-model="quote.commercial.materialMarkupPercentage" :min="0" @change="applyMaterialMarkup" /></el-form-item>
        <el-form-item label="Margen mano de obra %"><el-input-number v-model="quote.commercial.laborMarkupPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Contingencia %"><el-input-number v-model="quote.commercial.contingencyPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Descuento %"><el-input-number v-model="quote.commercial.discountPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="IVA %"><el-input-number v-model="quote.commercial.taxPercentage" :min="0" @change="refreshTotals" /></el-form-item>
        <el-form-item label="Moneda"><el-select v-model="quote.commercial.currency"><el-option label="MXN" value="MXN" /><el-option label="USD" value="USD" /></el-select></el-form-item>
        <el-form-item v-if="quote.commercial.currency === 'MXN'" label="Tipo de cambio USD a MXN"><el-input-number v-model="quote.commercial.usdToMxnRate" :min="0" :precision="4" /></el-form-item>
        <el-form-item label="Condiciones de pago"><el-input v-model="quote.commercial.paymentTerms" /></el-form-item>
        <el-form-item label="Tiempo de entrega"><el-input v-model="quote.commercial.deliveryTime" /></el-form-item>
        <el-form-item label="Dias de vigencia"><el-input-number v-model="quote.commercial.quoteValidityDays" :min="1" /></el-form-item>
      </div>
    </el-card>

    <el-card>
      <template #header>Resumen Comercial</template>
      <div v-if="quote.id" class="quote-share-summary">
        <div>
          <span>Descargas PDF</span>
          <strong>{{ quote.clientPdfDownloadCount || 0 }}</strong>
          <small v-if="quote.lastClientPdfDownloadAt">Ultima: {{ new Date(quote.lastClientPdfDownloadAt).toLocaleString() }}</small>
        </div>
        <div>
          <span>Correos enviados</span>
          <strong>{{ quote.clientEmailSendCount || 0 }}</strong>
          <small v-if="quote.lastClientEmailSentAt">Ultimo: {{ new Date(quote.lastClientEmailSentAt).toLocaleString() }}</small>
        </div>
      </div>
      <div class="totals-panel">
        <div v-for="item in totalsDisplay" :key="item.label" class="total-line">
          <strong>{{ item.label }}</strong>
          <span>{{ quote.commercial.currency }} {{ money(item.value) }}</span>
        </div>
      </div>
    </el-card>

    <el-card v-if="quote.id && familyQuotes.length" class="section-card">
      <template #header>Revisiones y Variantes</template>
      <el-table :data="familyQuotes" stripe>
        <el-table-column prop="quoteNumber" label="Cotizacion" min-width="150" />
        <el-table-column label="Variante" min-width="140">
          <template #default="{ row }">{{ row.variantName || 'Base' }}</template>
        </el-table-column>
        <el-table-column label="Revision" width="100" align="center">
          <template #default="{ row }">R{{ row.revisionNumber || 1 }}</template>
        </el-table-column>
        <el-table-column prop="status" label="Estatus" width="120">
          <template #default="{ row }">{{ quoteStatusLabels[row.status] || row.status }}</template>
        </el-table-column>
        <el-table-column label="Total" width="160" align="right">
          <template #default="{ row }">{{ row.commercial?.currency }} {{ money(row.totals?.finalTotal) }}</template>
        </el-table-column>
        <el-table-column label="" width="120">
          <template #default="{ row }">
            <el-button size="small" :type="row.id === quote.id ? 'primary' : 'default'" @click="router.push(`/quotes/${row.id}/edit`)">
              {{ row.id === quote.id ? 'Actual' : 'Abrir' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, TopRight } from '@element-plus/icons-vue';
import { useCustomerStore } from '../stores/customerStore';
import { useProjectStore } from '../stores/projectStore';
import { useQuoteStore } from '../stores/quoteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useProviderStore } from '../stores/providerStore';
import { productsApi, quotesApi } from '../services/api';
import { generateProviderRfqPdf, generateQuotePdf } from '../services/pdfService';
import { getContactById, getPrimaryContact, normalizeCustomer } from '../utils/customerContacts';
import { isAutomationDirectProduct, openAutomationDirectProduct } from '../utils/automationDirect';
import { calculateQuoteTotals, updateMaterialTotals, updateServiceTotals } from '../utils/quoteCalculations';
import { createEmptyQuote, quoteStatusLabels, quoteStatuses, serviceTypes } from '../utils/quoteDefaults';

const route = useRoute();
const router = useRouter();
const customers = useCustomerStore();
const projects = useProjectStore();
const quotes = useQuoteStore();
const settings = useSettingsStore();
const providers = useProviderStore();
const catalogDialogVisible = ref(false);
const emailDialogVisible = ref(false);
const rfqDialogVisible = ref(false);
const catalogSearch = ref('');
const catalogProducts = ref<any[]>([]);
const catalogLoading = ref(false);
const catalogPage = ref(1);
const catalogPageSize = ref(50);
const catalogTotal = ref(0);
const familyQuotes = ref<any[]>([]);
const sendingEmail = ref(false);
const quote = reactive<any>(createEmptyQuote());
const emailForm = reactive({
  contactIds: [] as string[],
  subject: '',
  message: ''
});
const rfqForm = reactive({
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  notes: 'Favor de enviar su mejor tiempo de entrega, vigencia, condiciones comerciales y disponibilidad.'
});

const filteredProjects = computed(() => projects.projects.filter((project) => !quote.customerId || project.customerId === quote.customerId));
const currentCustomer = computed(() => normalizeCustomer(customers.customers.find((customer) => customer.id === quote.customerId)));
const availableContacts = computed(() => currentCustomer.value.contacts || []);
const selectedRecipient = computed(() => getContactById(currentCustomer.value, quote.recipientContactId));
const providerOptions = computed(() => providers.providers);
const rfqMissingRows = computed(() => quote.materials.filter((item: any) => !item.providerId));
const rfqProviderSummary = computed(() => {
  const grouped = new Map<string, any>();
  for (const item of quote.materials) {
    if (!item.providerId) continue;
    const provider = providers.providers.find((entry) => entry.id === item.providerId);
    if (!provider) continue;
    if (!grouped.has(provider.id)) {
      grouped.set(provider.id, {
        providerId: provider.id,
        providerName: provider.companyName,
        contactName: provider.primaryContactName,
        contactEmail: provider.primaryContactEmail,
        itemCount: 0
      });
    }
    grouped.get(provider.id).itemCount += 1;
  }
  return [...grouped.values()];
});
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

const totalsDisplay = computed(() => [
  { label: 'Materiales', value: quote.totals.materialsSubtotal },
  { label: 'Mano de Obra', value: quote.totals.laborSubtotal },
  { label: 'Costo Directo', value: quote.totals.directCost },
  { label: 'Margen', value: quote.totals.markup },
  { label: 'Contingencia', value: quote.totals.contingency },
  { label: 'Descuento', value: quote.totals.discount },
  { label: 'IVA', value: quote.totals.tax },
  { label: 'Total Final', value: quote.totals.finalTotal }
]);

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function convertedProductCost(product: any) {
  const cost = Number(product.unitCost || 0);
  if (quote.commercial.currency === 'MXN' && product.currency === 'USD') {
    return Math.round(cost * Number(quote.commercial.usdToMxnRate || 0) * 100) / 100;
  }
  return cost;
}

function syncSnapshots() {
  const customer = customers.customers.find((item) => item.id === quote.customerId);
  const normalizedCustomer = normalizeCustomer(customer);
  if (!normalizedCustomer.contacts.find((contact) => contact.id === quote.recipientContactId)) {
    quote.recipientContactId = normalizedCustomer.primaryContactId || null;
  }
  const recipientContact = getContactById(normalizedCustomer, quote.recipientContactId);
  quote.customerSnapshot = {
    ...normalizedCustomer,
    selectedContact: recipientContact,
    recipientContact
  };
  quote.projectSnapshot = projects.projects.find((project) => project.id === quote.projectId);
}

function contactLabel(contact: any) {
  return [contact.name, contact.title, contact.email].filter(Boolean).join(' | ');
}

function providerLabel(provider: any) {
  return provider.active === false ? `${provider.companyName} (Inactivo)` : provider.companyName;
}

function refreshTotals() {
  quote.materials = quote.materials.map((item: any) => updateMaterialTotals(item, quote.commercial.materialMarkupPercentage));
  quote.services = quote.services.map(updateServiceTotals);
  quote.totals = calculateQuoteTotals(quote.materials, quote.services, quote.commercial);
}

function applyMaterialMarkup() {
  quote.materials = quote.materials.map((item: any) => ({ ...item, markupPercentage: quote.commercial.materialMarkupPercentage }));
  refreshTotals();
}

function addMaterial() {
  quote.materials.push(updateMaterialTotals({ partNumber: '', description: '', brand: 'AutomationDirect', supplier: '', providerId: null, quantity: 1, unitCost: 0, markupPercentage: quote.commercial.materialMarkupPercentage, unitPrice: 0, totalPrice: 0, notes: '' }));
}

function assignProviderToMaterial(material: any, providerId?: string | null) {
  material.providerId = providerId || null;
  const provider = providers.providers.find((entry) => entry.id === providerId);
  if (provider) material.supplier = provider.companyName;
}

function addProductToBom(product: any) {
  const unitCost = convertedProductCost(product);
  quote.materials.push(updateMaterialTotals({
    partNumber: product.partNumber,
    description: product.description,
    brand: product.brand,
    supplier: product.supplier,
    providerId: product.providerId || matchedProviderId(product.supplier),
    quantity: 1,
    unitCost,
    markupPercentage: quote.commercial.materialMarkupPercentage,
    unitPrice: 0,
    totalPrice: 0,
    notes: product.currency === 'USD' && quote.commercial.currency === 'MXN'
      ? `Costo de catalogo: USD ${money(product.unitCost)}. Convertido a ${quote.commercial.usdToMxnRate} MXN/USD. ${product.availabilityNote || product.notes || product.leadTime || product.availabilityStatus || ''}`.trim()
      : product.availabilityNote || product.notes || product.leadTime || product.availabilityStatus || '',
    sourceCurrency: product.currency,
    sourceUnitCost: product.unitCost,
    exchangeRateApplied: product.currency === 'USD' && quote.commercial.currency === 'MXN' ? quote.commercial.usdToMxnRate : undefined
  }));
  refreshTotals();
}

function matchedProviderId(supplier: string) {
  const provider = providers.providers.find((entry) => String(entry.companyName || '').trim().toLowerCase() === String(supplier || '').trim().toLowerCase());
  return provider?.id || null;
}

function normalizeMaterialProviders() {
  quote.materials = quote.materials.map((item: any) => {
    const providerId = item.providerId || matchedProviderId(item.supplier);
    const provider = providers.providers.find((entry) => entry.id === providerId);
    return {
      ...item,
      providerId: providerId || null,
      supplier: provider?.companyName || item.supplier || ''
    };
  });
}

function removeMaterial(index: number) {
  quote.materials.splice(index, 1);
  refreshTotals();
}

function addService() {
  quote.services.push(updateServiceTotals({ serviceType: 'PLC programming', description: '', hours: 1, hourlyRate: 1710, total: 0, notes: '' }));
}

function removeService(index: number) {
  quote.services.splice(index, 1);
  refreshTotals();
}

async function loadFamilyQuotes() {
  if (!quote.id) {
    familyQuotes.value = [];
    return;
  }
  familyQuotes.value = await quotesApi.family(quote.id);
}

async function save() {
  normalizeMaterialProviders();
  syncSnapshots();
  refreshTotals();
  const saved = await quotes.saveQuote(quote);
  ElMessage.success('Cotizacion guardada');
  await loadFamilyQuotes();
  router.push(`/quotes/${saved.id}/edit`);
}

async function createRevision() {
  if (!quote.id) return;
  const created = await quotes.reviseQuote(quote.id);
  ElMessage.success('Revision creada');
  router.push(`/quotes/${created.id}/edit`);
}

async function createVariant() {
  if (!quote.id) return;
  const { value } = await ElMessageBox.prompt('Nombre de la variante', 'Nueva variante', {
    inputValue: `Opcion ${(quote.variantSequence || 1) + 1}`,
    confirmButtonText: 'Crear',
    cancelButtonText: 'Cancelar'
  }).catch(() => ({ value: null }));
  if (!value) return;
  const created = await quotes.createQuoteVariant(quote.id, value);
  ElMessage.success('Variante creada');
  router.push(`/quotes/${created.id}/edit`);
}

function clientQuoteUrl() {
  return window.location.origin + '/client/quotes/' + quote.id;
}

async function copyClientLink() {
  if (!quote.id) return;
  await navigator.clipboard.writeText(clientQuoteUrl());
  ElMessage.success('Liga de cotizacion para cliente copiada');
}

function prepareEmailDialog() {
  const recipient = selectedRecipient.value || getPrimaryContact(currentCustomer.value);
  const projectName = quote.projectSnapshot?.projectName ? ` para el proyecto ${quote.projectSnapshot.projectName}` : '';
  emailForm.contactIds = recipient?.id ? [recipient.id] : [];
  emailForm.subject = `Cotizacion ${quote.quoteNumber} - Sistemas Mecatronicos`;
  emailForm.message = recipient?.name
    ? `Hola ${recipient.name}, compartimos la liga de la cotizacion ${quote.quoteNumber}${projectName}.`
    : `Compartimos la liga de la cotizacion ${quote.quoteNumber}${projectName}.`;
}

async function sendClientLinkEmail() {
  if (!quote.id) return;
  sendingEmail.value = true;
  try {
    settings.load();
    const result = await quotesApi.sendClientLink(quote.id, {
      contactIds: emailForm.contactIds,
      subject: emailForm.subject,
      message: emailForm.message,
      company: settings.company
    });
    quote.clientEmailSendCount = result.clientEmailSendCount;
    quote.lastClientEmailSentAt = result.lastClientEmailSentAt;
    quote.lastClientEmailRecipients = result.lastClientEmailRecipients;
    emailDialogVisible.value = false;
    ElMessage.success('Correo enviado');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || 'No fue posible enviar el correo');
  } finally {
    sendingEmail.value = false;
  }
}

function exportPdf() {
  syncSnapshots();
  refreshTotals();
  settings.load();
  generateQuotePdf(quote, settings.company);
}

function openRfqDialog() {
  normalizeMaterialProviders();
  rfqDialogVisible.value = true;
}

function providerQuoteMaterials(providerId: string) {
  return quote.materials.filter((item: any) => item.providerId === providerId);
}

function generateProviderRfqs() {
  normalizeMaterialProviders();
  syncSnapshots();
  settings.load();
  for (const providerSummary of rfqProviderSummary.value) {
    const provider = providers.providers.find((entry) => entry.id === providerSummary.providerId);
    if (!provider) continue;
    generateProviderRfqPdf({
      quote,
      company: settings.company,
      provider,
      dueDate: rfqForm.dueDate,
      notes: rfqForm.notes,
      materials: providerQuoteMaterials(provider.id)
    });
  }
  rfqDialogVisible.value = false;
  ElMessage.success(`Se generaron ${rfqProviderSummary.value.length} solicitudes`);
}

function goBack() {
  router.push('/quotes');
}

onMounted(async () => {
  settings.load();
  await Promise.all([customers.fetchCustomers(), projects.fetchProjects(), providers.fetchProviders()]);
  if (route.params.id) Object.assign(quote, await quotesApi.get(route.params.id as string));
  else quote.recipientContactId = null;
  normalizeMaterialProviders();
  refreshTotals();
  syncSnapshots();
  await loadFamilyQuotes();
});

watch(emailDialogVisible, (visible) => {
  if (visible) prepareEmailDialog();
});
</script>

<style scoped>
.quote-form-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quote-form-title h1 {
  margin: 0;
}

.materials-table :deep(.el-input-number) {
  width: 100%;
}

.materials-table :deep(.el-input-number__decrease),
.materials-table :deep(.el-input-number__increase) {
  display: none;
}

.materials-table :deep(.el-input-number .el-input__wrapper) {
  padding-left: 11px;
  padding-right: 11px;
}
</style>
