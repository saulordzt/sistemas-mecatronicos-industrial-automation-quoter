<template>
  <div class="page">
    <div class="page-header">
      <h1>Productos</h1>
      <div class="table-actions">
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx" :on-change="handleImport">
          <el-button>Importar XLSX</el-button>
        </el-upload>
        <el-button type="primary" @click="openProduct()">Nuevo Producto</el-button>
      </div>
    </div>

    <el-card class="section-card">
      <el-input v-model="search" placeholder="Buscar por numero de parte, descripcion, marca, proveedor o categoria" clearable @input="onSearchInput" />
    </el-card>

    <div class="products-layout">
      <el-card class="products-browser-card">
        <template #header>
          <div class="products-browser-header">
            <strong>Proveedores</strong>
            <el-button v-if="store.supplier || store.category" size="small" @click="clearHierarchyFilter">Limpiar</el-button>
          </div>
        </template>
        <div class="products-browser-list">
          <button
            v-for="provider in store.providers"
            :key="provider.key"
            type="button"
            class="products-browser-item"
            :class="{ active: store.supplier === provider.supplier }"
            @click="selectSupplier(provider)"
          >
            <span>{{ provider.label }}</span>
            <el-tag size="small" effect="plain">{{ provider.count }}</el-tag>
          </button>
        </div>
      </el-card>

      <el-card class="products-browser-card">
        <template #header><strong>Categorias</strong></template>
        <div v-if="store.supplier" class="products-browser-panel">
          <el-input
            v-model="categorySearch"
            placeholder="Buscar categoria"
            clearable
            class="products-browser-search"
          />
          <div class="products-browser-list products-browser-list-scroll">
          <button
            v-for="categoryNode in filteredCategories"
            :key="categoryNode.key"
            type="button"
            class="products-browser-item"
            :class="{ active: store.category === categoryNode.category }"
            @click="selectCategory(categoryNode)"
          >
            <span>{{ categoryNode.label }}</span>
            <el-tag size="small" effect="plain">{{ categoryNode.count }}</el-tag>
          </button>
          </div>
        </div>
        <el-empty v-else description="Selecciona un proveedor" :image-size="72" />
      </el-card>

      <el-card class="products-results-card">
        <div class="products-filter-summary" v-if="store.supplier || store.category">
          <el-tag v-if="store.supplier" effect="plain">Proveedor: {{ store.supplier }}</el-tag>
          <el-tag v-if="store.category" effect="plain">Categoria: {{ store.category }}</el-tag>
        </div>

        <el-empty
          v-if="!canShowProducts"
          description="Selecciona una categoria para ver los productos"
          :image-size="88"
        />

        <template v-else>
        <el-table :data="store.products" v-loading="store.loading" stripe>
          <el-table-column prop="partNumber" label="No. de parte" width="145" show-overflow-tooltip />
          <el-table-column prop="description" label="Descripcion" min-width="420" show-overflow-tooltip />
          <el-table-column label="Costo" width="130" align="right">
            <template #default="{ row }">{{ row.currency }} {{ money(row.unitCost) }}</template>
          </el-table-column>
          <el-table-column label="Status" width="100">
            <template #default="{ row }">
              <el-tag :type="row.active ? 'success' : 'info'">{{ row.active ? 'Activo' : 'Inactivo' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Acciones" width="150" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-tooltip v-if="isAutomationDirectProduct(row)" content="Ver en AutomationDirect" placement="top">
                  <el-button size="small" circle @click="openAutomationDirectProduct(row)">
                    <el-icon><TopRight /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-button size="small" circle @click="openProduct(row)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button size="small" circle type="danger" @click="store.deleteProduct(row.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-bar">
          <span class="muted">{{ store.total.toLocaleString() }} productos</span>
          <el-pagination
            v-model:current-page="store.page"
            v-model:page-size="store.pageSize"
            :total="store.total"
            :page-sizes="[25, 50, 100, 200]"
            layout="sizes, prev, pager, next, jumper"
            @size-change="onPageSizeChange"
            @current-change="onPageChange"
          />
        </div>
        </template>
      </el-card>
    </div>

    <el-dialog v-model="dialogVisible" title="Producto" width="760px">
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="No. de parte"><el-input v-model="form.partNumber" /></el-form-item>
          <el-form-item label="Descripcion"><el-input v-model="form.description" /></el-form-item>
          <el-form-item label="Marca"><el-input v-model="form.brand" /></el-form-item>
          <el-form-item label="Proveedor"><el-input v-model="form.supplier" /></el-form-item>
          <el-form-item label="Categoria"><el-input v-model="form.category" /></el-form-item>
          <el-form-item label="Costo unitario"><el-input-number v-model="form.unitCost" :min="0" :precision="2" /></el-form-item>
          <el-form-item label="Moneda"><el-select v-model="form.currency"><el-option label="USD" value="USD" /><el-option label="MXN" value="MXN" /></el-select></el-form-item>
          <el-form-item label="Inventario"><el-input-number v-model="form.stock" :min="0" /></el-form-item>
          <el-form-item label="Tiempo de entrega"><el-input v-model="form.leadTime" /></el-form-item>
          <el-form-item label="URL ficha tecnica"><el-input v-model="form.datasheetUrl" /></el-form-item>
          <el-form-item label="Activo"><el-switch v-model="form.active" /></el-form-item>
          <el-form-item class="full" label="Notas"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Cancelar</el-button>
        <el-button type="primary" @click="save">Guardar</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="Resumen de Importacion" width="640px">
      <div v-if="importSummary">
        <p><strong>Creados:</strong> {{ importSummary.created }} | <strong>Actualizados:</strong> {{ importSummary.updated }} | <strong>Omitidos:</strong> {{ importSummary.skipped }}</p>
        <el-table v-if="importSummary.errors?.length" :data="importSummary.errors" stripe>
          <el-table-column prop="row" label="Fila" width="90" />
          <el-table-column label="Errores"><template #default="{ row }">{{ row.errors.join(', ') }}</template></el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Delete, Edit, TopRight } from '@element-plus/icons-vue';
import { useProductStore } from '../stores/productStore';
import { isAutomationDirectProduct, openAutomationDirectProduct } from '../utils/automationDirect';

const store = useProductStore();
const search = ref('');
const categorySearch = ref('');
const dialogVisible = ref(false);
const importDialogVisible = ref(false);
const importSummary = ref<any>(null);
const form = reactive<any>({});

let searchTimer: number | undefined;

function loadProducts(page = store.page) {
  return store.fetchProducts({
    page,
    pageSize: store.pageSize,
    search: search.value,
    supplier: store.supplier,
    category: store.category
  });
}

function onSearchInput() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => loadProducts(1), 300);
}

function onPageChange(page: number) {
  loadProducts(page);
}

function onPageSizeChange(pageSize: number) {
  store.pageSize = pageSize;
  loadProducts(1);
}

function emptyProduct() {
  return { partNumber: '', description: '', brand: '', supplier: '', category: '', unitCost: 0, currency: 'USD', stock: null, leadTime: '', datasheetUrl: '', notes: '', active: true };
}

function openProduct(row?: any) {
  Object.keys(form).forEach((key) => delete form[key]);
  Object.assign(form, row || emptyProduct());
  dialogVisible.value = true;
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function save() {
  await store.saveProduct(form);
  dialogVisible.value = false;
  ElMessage.success('Producto guardado');
}

async function handleImport(uploadFile: any) {
  importSummary.value = await store.importXlsx(uploadFile.raw);
  importDialogVisible.value = true;
}

const canShowProducts = computed(() => Boolean(store.category) || Boolean(search.value.trim()));
const filteredCategories = computed(() => {
  const term = categorySearch.value.trim().toLowerCase();
  if (!term) return store.categories;
  return store.categories.filter((item: any) => String(item.label || '').toLowerCase().includes(term));
});

async function selectSupplier(node: any) {
  store.supplier = node.supplier || '';
  store.category = '';
  categorySearch.value = '';
  await store.fetchCategories(store.supplier);
  store.products = [];
  store.total = 0;
  store.page = 1;
}

async function selectCategory(node: any) {
  store.supplier = node.supplier || '';
  store.category = node.category || '';
  await loadProducts(1);
}

async function clearHierarchyFilter() {
  store.supplier = '';
  store.category = '';
  store.categories = [];
  categorySearch.value = '';
  if (search.value.trim()) await loadProducts(1);
  else {
    store.products = [];
    store.total = 0;
    store.page = 1;
  }
}

onMounted(async () => {
  await store.fetchProviders();
  if (search.value.trim()) await loadProducts(1);
});
</script>

<style scoped>
.products-layout {
  display: grid;
  grid-template-columns: 240px 240px minmax(0, 1fr);
  gap: 16px;
}

.products-browser-card,
.products-results-card {
  min-width: 0;
}

.products-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.products-browser-list {
  display: grid;
  gap: 8px;
}

.products-browser-panel {
  display: grid;
  gap: 12px;
}

.products-browser-search {
  flex: 0 0 auto;
}

.products-browser-list-scroll {
  max-height: 62vh;
  overflow: auto;
  padding-right: 4px;
}

.products-browser-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--sm-line);
  border-radius: 4px;
  background: var(--sm-panel-soft);
  color: var(--sm-graphite);
  cursor: pointer;
  text-align: left;
}

.products-browser-item.active {
  border-color: var(--sm-green);
  box-shadow: inset 3px 0 0 var(--sm-green);
}

.products-browser-item:hover {
  background: var(--sm-surface-muted);
}

.products-filter-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

@media (max-width: 960px) {
  .products-layout {
    grid-template-columns: 1fr;
  }
}
</style>
