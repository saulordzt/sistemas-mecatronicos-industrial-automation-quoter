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
          <p>{{ recipientContact?.name || quote?.customerSnapshot?.contactName || '-' }}</p>
          <p>{{ recipientContact?.email || quote?.customerSnapshot?.email || '-' }}</p>
        </el-card>
        <el-card shadow="never">
          <template #header>Proyecto</template>
          <strong>{{ quote?.projectSnapshot?.projectName || '-' }}</strong>
          <p>{{ quote?.projectSnapshot?.projectType || '-' }}</p>
          <p>{{ quote?.projectSnapshot?.location || '-' }}</p>
        </el-card>
        <el-card shadow="never" class="public-total-card">
          <template #header>{{ isUnifiedOutput ? 'Precio total del proyecto' : 'Total' }}</template>
          <strong>{{ quote?.commercial?.currency }} {{ money(quote?.totals?.finalTotal) }}</strong>
          <p>Vigencia {{ quote?.commercial?.quoteValidityDays || 0 }} dias</p>
        </el-card>
      </section>

      <el-card class="section-card" shadow="never">
        <template #header>Alcance del Trabajo</template>
        <p class="notes-text">{{ quote?.scopeOfWork || 'Alcance por definir.' }}</p>
      </el-card>

      <el-card v-if="!isUnifiedOutput" class="section-card" shadow="never">
        <template #header>Lista de Materiales</template>
        <div class="table-scroll">
          <el-table :data="quote?.materials || []" stripe>
          <el-table-column v-if="hasMaterialImages" label="Imagen" width="110">
            <template #default="{ row }">
              <img
                v-if="row.imageUrl"
                class="public-material-thumb"
                :src="row.imageUrl"
                :alt="row.imageName || row.partNumber || 'Material'"
                title="Ver imagen"
                @click="openMaterialImagePreview(row)"
              />
              <span v-else class="muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="partNumber" label="Parte #" min-width="140" />
          <el-table-column prop="description" label="Descripcion" min-width="260" />
          <el-table-column prop="quantity" label="Cant." width="90" />
          <el-table-column label="Total" width="150" align="right">
            <template #default="{ row }">{{ quote?.commercial?.currency }} {{ money(row.totalPrice) }}</template>
          </el-table-column>
          </el-table>
        </div>
        <div class="public-category-total">
          <span>Total materiales con IVA</span>
          <strong>{{ quote?.commercial?.currency }} {{ money(materialsTotalWithTax) }}</strong>
        </div>
      </el-card>

      <el-card v-if="!isUnifiedOutput" class="section-card" shadow="never">
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
        <div class="public-category-total">
          <span>Total mano de obra con IVA</span>
          <strong>{{ quote?.commercial?.currency }} {{ money(laborTotalWithTax) }}</strong>
        </div>
      </el-card>

      <el-card v-if="isUnifiedOutput && hasMaterialImages" class="section-card" shadow="never">
        <template #header>Materiales de referencia</template>
        <div class="public-material-gallery">
          <article v-for="item in materialImages" :key="`${item.partNumber}-${item.imageUrl}`" class="public-material-card">
            <img
              :src="item.imageUrl"
              :alt="item.imageName || item.partNumber || 'Material'"
              title="Ver imagen"
              @click="openMaterialImagePreview(item)"
            />
            <div>
              <strong>{{ item.partNumber || 'Material' }}</strong>
              <p>{{ item.description || item.imageName || 'Imagen de referencia' }}</p>
            </div>
          </article>
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

      <el-dialog v-model="materialImagePreviewVisible" :title="materialImagePreview.title || 'Imagen de material'" width="min(920px, 94vw)" class="public-material-preview-dialog">
        <img v-if="materialImagePreview.url" :src="materialImagePreview.url" :alt="materialImagePreview.title || 'Imagen de material'" />
        <p v-if="materialImagePreview.description" class="muted">{{ materialImagePreview.description }}</p>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { publicQuotesApi } from '../services/api';
import { generateQuotePdf } from '../services/pdfService';
import { useSettingsStore } from '../stores/settingsStore';
import { getContactById } from '../utils/customerContacts';
import { quoteStatusLabels } from '../utils/quoteDefaults';

const route = useRoute();
const settings = useSettingsStore();
const quote = ref<any>(null);
const loading = ref(false);
const recipientContact = computed(() => getContactById(quote.value?.customerSnapshot, quote.value?.recipientContactId));
const isUnifiedOutput = computed(() => quote.value?.outputMode === 'unified');
const materialImages = computed(() => (quote.value?.materials || []).filter((item: any) => item.imageUrl));
const hasMaterialImages = computed(() => materialImages.value.length > 0);
const materialImagePreviewVisible = ref(false);
const materialImagePreview = ref({ url: '', title: '', description: '' });
const taxMultiplier = computed(() => 1 + Number(quote.value?.commercial?.taxPercentage || 0) / 100);
const materialsTotalWithTax = computed(() => roundMoney(Number(quote.value?.totals?.materialsSubtotal || 0) * taxMultiplier.value));
const laborTotalWithTax = computed(() => roundMoney(Number(quote.value?.totals?.laborSubtotal || 0) * taxMultiplier.value));

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quoteStatusLabel(status: string) {
  return quoteStatusLabels[status] || status;
}

function openMaterialImagePreview(material: any) {
  if (!material.imageUrl) return;
  materialImagePreview.value = {
    url: material.imageUrl,
    title: material.partNumber || material.imageName || 'Imagen de material',
    description: material.description || ''
  };
  materialImagePreviewVisible.value = true;
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

<style scoped>
.public-category-total {
  display: flex;
  justify-content: flex-end;
  gap: 18px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  color: #303133;
}

.public-material-thumb {
  width: 72px;
  height: 54px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #d7deea;
  background: #fff;
  cursor: zoom-in;
}

.public-material-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.public-material-card {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #dfe7d8;
  border-radius: 14px;
  background: rgba(123, 172, 66, 0.08);
}

.public-material-card img {
  width: 92px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid #d7deea;
  background: #fff;
  cursor: zoom-in;
}

.public-material-card p {
  margin: 6px 0 0;
  color: #667085;
}

.public-material-preview-dialog img {
  display: block;
  max-width: 100%;
  max-height: 72vh;
  margin: 0 auto 12px;
  object-fit: contain;
  border-radius: 14px;
  background: #f5f7fa;
}
</style>
