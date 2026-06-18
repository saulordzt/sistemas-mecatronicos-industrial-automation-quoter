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
        <el-button :disabled="!hasRemoteQuote" @click="createRevision">Nueva Revision</el-button>
        <el-button :disabled="!hasRemoteQuote" @click="createVariant">Nueva Variante</el-button>
        <el-button :disabled="!hasRemoteQuote" @click="copyClientLink">Vista Cliente</el-button>
        <el-button :disabled="!hasRemoteQuote" @click="emailDialogVisible = true">Enviar Liga</el-button>
        <el-button :disabled="!hasRemoteQuote" @click="openRfqDialog">Solicitudes a Proveedores</el-button>
        <el-button @click="exportPdf">Exportar PDF</el-button>
        <el-button type="primary" @click="save">Guardar Borrador</el-button>
      </div>
    </div>

    <el-card class="section-card ai-review-card">
      <template #header>
        <div class="page-header" style="margin: 0">
          <strong>AI Review Chat</strong>
          <div class="table-actions">
            <el-button size="small" text @click="reviewCollapsed = !reviewCollapsed">
              {{ reviewCollapsed ? 'Mostrar' : 'Ocultar' }}
            </el-button>
            <el-button size="small" @click="startQuoteReview" :loading="reviewLoading">Analizar cotizacion</el-button>
            <el-button size="small" @click="clearReviewChat">Limpiar chat</el-button>
          </div>
        </div>
      </template>

      <div v-if="!reviewCollapsed" class="ai-review-layout">
        <div class="ai-review-thread">
          <div v-if="!reviewMessages.length" class="ai-review-empty">
            Pide al AI que revise alcance, materiales, servicios, pricing y riesgos. Solo te dara sugerencias; los cambios los haces tu manualmente.
          </div>
          <div
            v-for="(entry, index) in reviewMessages"
            :key="`${entry.role}-${index}-${entry.content.slice(0, 30)}`"
            class="assistant-message"
            :class="entry.role"
          >
            <small>{{ entry.role === 'assistant' ? 'AI reviewer' : 'Tu' }}</small>
            <p>{{ entry.content }}</p>
          </div>
        </div>

        <div class="ai-review-sidebar">
          <el-alert
            v-for="warning in reviewWarnings"
            :key="warning"
            :title="warning"
            type="warning"
            :closable="false"
          />
          <div v-if="reviewSuggestions.length" class="ai-review-suggestions">
            <div v-for="(suggestion, index) in reviewSuggestions" :key="`${suggestion.title}-${index}`" class="ai-review-suggestion">
              <div class="page-header" style="margin: 0">
                <strong>{{ suggestion.title }}</strong>
                <el-tag :type="suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warning' : 'info'" size="small">
                  {{ reviewPriorityLabel(suggestion.priority) }}
                </el-tag>
              </div>
              <small>{{ reviewCategoryLabel(suggestion.category) }}</small>
              <p>{{ suggestion.rationale }}</p>
              <p><strong>Cambio manual:</strong> {{ suggestion.changeHint }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!reviewCollapsed" class="assistant-composer">
        <el-input
          v-model="reviewPrompt"
          type="textarea"
          :rows="3"
          placeholder="Ejemplo: revisa si faltan materiales, si el alcance esta claro y si ves riesgos comerciales."
          @keydown.ctrl.enter.prevent="sendReviewPrompt"
        />
        <div class="table-actions" style="justify-content: flex-end">
          <el-button type="primary" :loading="reviewLoading" @click="sendReviewPrompt">Enviar al AI</el-button>
        </div>
      </div>
    </el-card>

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
        </div>
      </template>
      <div class="table-scroll"><el-table :data="quote.materials" stripe class="materials-table quote-line-items-table">
        <el-table-column label="" width="114" fixed="left">
          <template #default="{ $index }">
            <div
              class="reorder-cell"
              :class="{ 'is-drag-target': isDragTarget('materials', $index) }"
              @dragenter.prevent="setDragTarget('materials', $index)"
              @dragover.prevent="setDragTarget('materials', $index)"
              @drop.prevent="dropDraggedRow('materials', $index)"
            >
              <span
                class="drag-handle"
                draggable="true"
                title="Arrastrar material"
                aria-label="Arrastrar material"
                @dragstart="startRowDrag('materials', $index, $event)"
                @dragend="endRowDrag"
              >
                <el-icon><Rank /></el-icon>
              </span>
              <el-button
                size="small"
                circle
                :disabled="$index === 0"
                title="Subir material"
                aria-label="Subir material"
                @click="moveMaterial($index, -1)"
              >
                <el-icon><ArrowUp /></el-icon>
              </el-button>
              <el-button
                size="small"
                circle
                :disabled="$index === quote.materials.length - 1"
                title="Bajar material"
                aria-label="Bajar material"
                @click="moveMaterial($index, 1)"
              >
                <el-icon><ArrowDown /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="No. de parte" min-width="140"><template #default="{ row }"><el-input v-model="row.partNumber" /></template></el-table-column>
        <el-table-column label="Descripcion" min-width="380">
          <template #default="{ row, $index }">
            <div class="material-description-cell">
              <el-input
                v-model="row.description"
                class="material-nav-textarea"
                :data-material-row="$index"
                data-material-field="description"
                type="textarea"
                :rows="3"
                placeholder="Descripcion para presentar en la cotizacion"
                @keydown="handleMaterialFieldKeydown($event, $index, 'description')"
              />
              <el-button size="small" text @click="row.description = ''">Limpiar</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Imagen" width="150">
          <template #default="{ row, $index }">
            <div
              class="material-image-cell"
              tabindex="0"
              @paste="handleMaterialImagePaste($event, $index)"
              @dragover.prevent
              @drop.prevent="handleMaterialImageDrop($event, $index)"
            >
              <img
                v-if="row.imageUrl"
                :src="row.imageUrl"
                :alt="row.imageName || row.partNumber || 'Material'"
                title="Ver imagen"
                @click="openMaterialImagePreview(row)"
              />
              <div v-else class="material-image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>Pegar imagen</span>
              </div>
              <label class="material-image-upload">
                <input type="file" accept="image/*" @change="handleMaterialImageInput($event, $index)" />
                <span>{{ row.__imageUploading ? 'Subiendo...' : row.imageUrl ? 'Cambiar' : 'Subir' }}</span>
              </label>
              <el-button v-if="row.imageUrl" size="small" text type="danger" @click="clearMaterialImage(row)">Quitar</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Marca" min-width="120"><template #default="{ row }"><el-input v-model="row.brand" /></template></el-table-column>
        <el-table-column label="Proveedor" min-width="200">
          <template #default="{ row }">
            <div class="provider-cell">
              <el-radio-group v-model="row.__providerMode" size="small" @change="(value) => setProviderMode(row, value)">
                <el-radio-button label="saved">Lista</el-radio-button>
                <el-radio-button label="text">Texto</el-radio-button>
              </el-radio-group>
              <el-select
                v-if="row.__providerMode === 'saved'"
                v-model="row.providerId"
                filterable
                clearable
                @change="(value) => assignProviderToMaterial(row, value)"
              >
                <el-option v-for="provider in providerOptions" :key="provider.id" :label="providerLabel(provider)" :value="provider.id" :disabled="provider.active === false" />
              </el-select>
              <el-input v-else v-model="row.supplier" placeholder="Proveedor libre" @input="clearMaterialProviderId(row)" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Cant." width="110"><template #default="{ row }"><el-input-number v-model="row.quantity" :min="0" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Costo unitario" width="170">
          <template #default="{ row, $index }">
            <div class="unit-cost-cell">
              <el-input-number
                v-model="row.unitCost"
                class="material-nav-input"
                :data-material-row="$index"
                data-material-field="unitCost"
                :min="0"
                :precision="2"
                @keydown.capture="handleMaterialFieldKeydown($event, $index, 'unitCost')"
                @change="refreshTotals"
              />
              <el-button
                size="small"
                type="primary"
                plain
                :disabled="!canConvertMaterialCostToMxn(row)"
                @click="convertMaterialCostToMxn(row)"
              >
                Convertir a MXN
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Margen %" width="130">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.markupPercentage"
              class="material-nav-input"
              :data-material-row="$index"
              data-material-field="markupPercentage"
              :min="0"
              @keydown.capture="handleMaterialFieldKeydown($event, $index, 'markupPercentage')"
              @change="refreshTotals"
            />
          </template>
        </el-table-column>
        <el-table-column label="Total" width="130" align="right"><template #default="{ row }">{{ money(row.totalPrice) }}</template></el-table-column>
        <el-table-column label="" width="70">
          <template #default="{ $index }">
            <el-button size="small" type="danger" circle title="Eliminar material" aria-label="Eliminar material" @click="removeMaterial($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table></div>
      <div class="list-bottom-actions">
        <el-button size="small" @click="catalogDialogVisible = true">Seleccionar del Catalogo</el-button>
        <el-button size="small" @click="openMaterialUrlDialog()">Agregar desde liga</el-button>
        <el-button size="small" type="primary" @click="addMaterial">Agregar Material</el-button>
      </div>
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

    <el-dialog v-model="materialUrlDialogVisible" title="Agregar material desde liga" width="780px" @closed="resetMaterialUrlDialog">
      <el-form label-position="top">
        <el-form-item label="Liga del producto">
          <el-input v-model="materialUrlForm.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="Cantidad">
          <el-input-number v-model="materialUrlForm.quantity" :min="1" />
        </el-form-item>
      </el-form>
      <div class="table-actions" style="justify-content: flex-end; margin-bottom: 12px">
        <el-button type="primary" :loading="materialUrlLoading" @click="analyzeMaterialUrl">Analizar con AI</el-button>
      </div>
      <el-alert v-if="materialUrlError" :title="materialUrlError" type="error" :closable="false" style="margin-bottom: 12px" />
      <el-card v-if="materialUrlPreview" shadow="never" class="url-preview-card">
        <template #header>
          <div class="page-header" style="margin: 0">
            <strong>Vista previa</strong>
            <small class="muted">{{ materialUrlPreview.source?.title || materialUrlPreview.source?.url }}</small>
          </div>
        </template>
        <div class="form-grid">
          <el-form-item label="No. de parte"><el-input :model-value="materialUrlPreview.material.partNumber" disabled /></el-form-item>
          <el-form-item label="Marca"><el-input :model-value="materialUrlPreview.material.brand" disabled /></el-form-item>
          <el-form-item label="Proveedor"><el-input :model-value="materialUrlPreview.material.supplier" disabled /></el-form-item>
          <el-form-item label="Cantidad"><el-input :model-value="String(materialUrlPreview.material.quantity)" disabled /></el-form-item>
          <el-form-item class="full" label="Descripcion"><el-input :model-value="materialUrlPreview.material.description" type="textarea" :rows="3" disabled /></el-form-item>
          <el-form-item label="Costo"><el-input :model-value="`${materialUrlPreview.material.sourceCurrency || quote.commercial.currency} ${money(materialUrlPreview.material.unitCost)}`" disabled /></el-form-item>
          <el-form-item class="full" label="Notas"><el-input :model-value="materialUrlPreview.material.notes" type="textarea" :rows="2" disabled /></el-form-item>
        </div>
        <el-alert
          v-for="warning in materialUrlPreview.warnings"
          :key="warning"
          :title="warning"
          type="warning"
          :closable="false"
          style="margin-top: 8px"
        />
      </el-card>
      <template #footer>
        <el-button @click="materialUrlDialogVisible = false">Cerrar</el-button>
        <el-button type="primary" :disabled="!materialUrlPreview" @click="applyMaterialUrlPreview">Aplicar material</el-button>
      </template>
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
        </div>
      </template>
      <div class="table-scroll"><el-table :data="quote.services" stripe class="quote-line-items-table">
        <el-table-column label="" width="114" fixed="left">
          <template #default="{ $index }">
            <div
              class="reorder-cell"
              :class="{ 'is-drag-target': isDragTarget('services', $index) }"
              @dragenter.prevent="setDragTarget('services', $index)"
              @dragover.prevent="setDragTarget('services', $index)"
              @drop.prevent="dropDraggedRow('services', $index)"
            >
              <span
                class="drag-handle"
                draggable="true"
                title="Arrastrar servicio"
                aria-label="Arrastrar servicio"
                @dragstart="startRowDrag('services', $index, $event)"
                @dragend="endRowDrag"
              >
                <el-icon><Rank /></el-icon>
              </span>
              <el-button
                size="small"
                circle
                :disabled="$index === 0"
                title="Subir servicio"
                aria-label="Subir servicio"
                @click="moveService($index, -1)"
              >
                <el-icon><ArrowUp /></el-icon>
              </el-button>
              <el-button
                size="small"
                circle
                :disabled="$index === quote.services.length - 1"
                title="Bajar servicio"
                aria-label="Bajar servicio"
                @click="moveService($index, 1)"
              >
                <el-icon><ArrowDown /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Tipo" min-width="180">
          <template #default="{ row }"><el-select v-model="row.serviceType"><el-option v-for="type in serviceTypes" :key="type" :label="type" :value="type" /></el-select></template>
        </el-table-column>
        <el-table-column label="Descripcion" min-width="240"><template #default="{ row }"><el-input v-model="row.description" /></template></el-table-column>
        <el-table-column label="Horas" width="120"><template #default="{ row }"><el-input-number v-model="row.hours" :min="0" :precision="1" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Tarifa por hora" width="150"><template #default="{ row }"><el-input-number v-model="row.hourlyRate" :min="0" :precision="2" @change="refreshTotals" /></template></el-table-column>
        <el-table-column label="Total" width="130" align="right"><template #default="{ row }">{{ money(row.total) }}</template></el-table-column>
        <el-table-column label="" width="70">
          <template #default="{ $index }">
            <el-button size="small" type="danger" circle title="Eliminar servicio" aria-label="Eliminar servicio" @click="removeService($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table></div>
      <div class="list-bottom-actions">
        <el-button size="small" type="primary" @click="addService">Agregar Servicio</el-button>
      </div>
    </el-card>

    <el-card class="section-card">
      <template #header>Configuracion Comercial</template>
      <div class="form-grid">
        <el-form-item label="Modo de salida">
          <el-select v-model="quote.outputMode">
            <el-option label="Separado: materiales y servicios" value="separated" />
            <el-option label="Unificado: costo total del proyecto" value="unified" />
          </el-select>
        </el-form-item>
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

    <div class="floating-save">
      <el-button type="primary" round :loading="saveState === 'saving'" @click="save">
        <el-icon v-if="saveState === 'saved'"><Check /></el-icon>
        <el-icon v-else-if="saveState === 'pending'"><Clock /></el-icon>
        <el-icon v-else-if="saveState === 'error'"><Warning /></el-icon>
        <el-icon v-else-if="saveState === 'queued'"><Upload /></el-icon>
        <el-icon v-else><RefreshRight /></el-icon>
        <span>{{ saveLabel }}</span>
      </el-button>
    </div>

    <el-dialog v-model="materialImagePreviewVisible" :title="materialImagePreview.title || 'Imagen de material'" width="min(920px, 94vw)" class="material-image-preview-dialog">
      <img v-if="materialImagePreview.url" :src="materialImagePreview.url" :alt="materialImagePreview.title || 'Imagen de material'" />
      <p v-if="materialImagePreview.description" class="muted">{{ materialImagePreview.description }}</p>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Clock, Delete, Picture, Rank, RefreshRight, TopRight, Upload, Warning } from '@element-plus/icons-vue';
import { useCustomerStore } from '../stores/customerStore';
import { useProjectStore } from '../stores/projectStore';
import { useQuoteStore } from '../stores/quoteStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useProviderStore } from '../stores/providerStore';
import { aiApi, materialsApi, productsApi, providersApi, quotesApi } from '../services/api';
import { generateProviderRfqPdf, generateQuotePdf } from '../services/pdfService';
import { getContactById, getPrimaryContact, normalizeCustomer } from '../utils/customerContacts';
import { isAutomationDirectProduct, openAutomationDirectProduct } from '../utils/automationDirect';
import { calculateQuoteTotals, updateMaterialTotals, updateServiceTotals } from '../utils/quoteCalculations';
import { createEmptyQuote, quoteStatusLabels, quoteStatuses, serviceTypes } from '../utils/quoteDefaults';
import { getLocalDraft, isLocalQuoteId } from '../utils/offlineQueue';
import type { MaterialUrlExtractionResult, QuoteReviewChatMessage, QuoteReviewSuggestion } from '../types';

type ReorderList = 'materials' | 'services';

const route = useRoute();
const router = useRouter();
const customers = useCustomerStore();
const projects = useProjectStore();
const quotes = useQuoteStore();
const settings = useSettingsStore();
const providers = useProviderStore();
const catalogDialogVisible = ref(false);
const materialUrlDialogVisible = ref(false);
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
const materialUrlLoading = ref(false);
const materialUrlPreview = ref<MaterialUrlExtractionResult | null>(null);
const materialUrlError = ref('');
const materialUrlTargetIndex = ref<number | null>(null);
const materialImagePreviewVisible = ref(false);
const materialImagePreview = reactive({
  url: '',
  title: '',
  description: ''
});
const reviewLoading = ref(false);
const reviewPrompt = ref('');
const reviewCollapsed = ref(false);
const reviewMessages = ref<QuoteReviewChatMessage[]>([]);
const reviewSuggestions = ref<QuoteReviewSuggestion[]>([]);
const reviewWarnings = ref<string[]>([]);
const draggedRow = ref<{ list: ReorderList; index: number } | null>(null);
const dragTarget = ref<{ list: ReorderList; index: number } | null>(null);
const saveState = ref<'saved' | 'saving' | 'pending' | 'error' | 'queued'>('saved');
const isHydrating = ref(true);
const quote = reactive<any>(createEmptyQuote());
const materialUrlForm = reactive({
  url: '',
  quantity: 1
});
const emailForm = reactive({
  contactIds: [] as string[],
  subject: '',
  message: ''
});
const rfqForm = reactive({
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  notes: 'Favor de enviar su mejor tiempo de entrega, vigencia, condiciones comerciales y disponibilidad.'
});
let autosaveTimer: number | undefined;
let catalogSearchTimer: number | undefined;
let saveQueued = false;
let suppressAutosave = false;
const lastSavedSnapshot = ref('');

const filteredProjects = computed(() => projects.projects.filter((project) => !quote.customerId || project.customerId === quote.customerId));
const currentCustomer = computed(() => normalizeCustomer(customers.customers.find((customer) => customer.id === quote.customerId)));
const availableContacts = computed(() => currentCustomer.value.contacts || []);
const selectedRecipient = computed(() => getContactById(currentCustomer.value, quote.recipientContactId));
const providerOptions = computed(() => providers.providers);
const hasRemoteQuote = computed(() => Boolean(quote.id) && !isLocalQuoteId(quote.id));
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
const saveLabel = computed(() => {
  if (saveState.value === 'saved') return 'Guardado';
  if (saveState.value === 'saving') return 'Guardando';
  if (saveState.value === 'pending') return 'Pendiente';
  if (saveState.value === 'queued') return 'Sincronizacion pendiente';
  return 'Reintentar guardado';
});

const quoteSnapshot = computed(() => JSON.stringify(buildPersistableQuote(quote)));

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

function reviewPriorityLabel(value: QuoteReviewSuggestion['priority']) {
  return value === 'high' ? 'Alta' : value === 'medium' ? 'Media' : 'Baja';
}

function reviewCategoryLabel(value: QuoteReviewSuggestion['category']) {
  const labels: Record<QuoteReviewSuggestion['category'], string> = {
    scope: 'Alcance',
    materials: 'Materiales',
    services: 'Servicios',
    pricing: 'Pricing',
    risk: 'Riesgo',
    commercial: 'Comercial',
    client: 'Cliente',
    structure: 'Estructura'
  };
  return labels[value] || value;
}

function convertedProductCost(product: any) {
  const cost = Number(product.unitCost || 0);
  if (quote.commercial.currency === 'MXN' && product.currency === 'USD') {
    return Math.round(cost * Number(quote.commercial.usdToMxnRate || 0) * 100) / 100;
  }
  return cost;
}

function hydrateMaterialRow(item: any) {
  const providerId = item.providerId || matchedProviderId(item.supplier);
  return {
    ...item,
    providerId: providerId || null,
    __providerMode: providerId ? 'saved' : 'text',
    __freeSupplierBackup: !providerId ? item.supplier || '' : item.__freeSupplierBackup || ''
  };
}

function sanitizeMaterialRow(item: any) {
  const providerId = item.__providerMode === 'saved' ? item.providerId || null : null;
  const provider = providers.providers.find((entry) => entry.id === providerId);
  return {
    partNumber: item.partNumber || '',
    description: item.description || '',
    brand: item.brand || '',
    supplier: providerId ? provider?.companyName || item.supplier || '' : item.supplier || item.__freeSupplierBackup || '',
    providerId,
    quantity: Number(item.quantity || 0),
    unitCost: Number(item.unitCost || 0),
    markupPercentage: Number(item.markupPercentage || 0),
    unitPrice: Number(item.unitPrice || 0),
    totalPrice: Number(item.totalPrice || 0),
    notes: item.notes || '',
    sourceCurrency: item.sourceCurrency,
    sourceUnitCost: item.sourceUnitCost,
    exchangeRateApplied: item.exchangeRateApplied,
    imageUrl: item.imageUrl || '',
    imageFileId: item.imageFileId || '',
    imageName: item.imageName || '',
    imageMimeType: item.imageMimeType || ''
  };
}

function buildPersistableQuote(source: any) {
  const cloned = JSON.parse(JSON.stringify(source || {}));
  return {
    ...cloned,
    outputMode: cloned.outputMode === 'unified' ? 'unified' : 'separated',
    materials: (source.materials || []).map((item: any) => sanitizeMaterialRow(item))
  };
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

function setProviderMode(material: any, mode: 'saved' | 'text') {
  material.__providerMode = mode;
  if (mode === 'saved') {
    const nextProviderId = material.providerId || matchedProviderId(material.supplier);
    material.providerId = nextProviderId;
    if (nextProviderId) {
      const provider = providers.providers.find((entry) => entry.id === nextProviderId);
      if (provider) material.supplier = provider.companyName;
    }
  } else {
    material.__freeSupplierBackup = material.__freeSupplierBackup || material.supplier || '';
    material.providerId = null;
    material.supplier = material.__freeSupplierBackup || material.supplier || '';
  }
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
  quote.materials.push(hydrateMaterialRow(updateMaterialTotals({ partNumber: '', description: '', brand: 'AutomationDirect', supplier: '', providerId: null, quantity: 1, unitCost: 0, markupPercentage: quote.commercial.materialMarkupPercentage, unitPrice: 0, totalPrice: 0, notes: '', imageUrl: '', imageFileId: '', imageName: '', imageMimeType: '' })));
}

function assignProviderToMaterial(material: any, providerId?: string | null) {
  material.providerId = providerId || null;
  const provider = providers.providers.find((entry) => entry.id === providerId);
  material.__providerMode = provider ? 'saved' : 'text';
  if (provider) {
    material.supplier = provider.companyName;
  } else {
    material.__freeSupplierBackup = material.__freeSupplierBackup || material.supplier || '';
  }
}

function clearMaterialProviderId(material: any) {
  material.providerId = null;
  material.__providerMode = 'text';
  material.__freeSupplierBackup = material.supplier || '';
}

function firstImageFile(files: FileList | File[] | null | undefined) {
  return Array.from(files || []).find((file) => file.type.startsWith('image/')) || null;
}

async function ensureRemoteQuoteForMaterialImage() {
  if (quote.id && !isLocalQuoteId(quote.id)) return quote.id;
  await persistQuote({ manual: true });
  if (quote.id && !isLocalQuoteId(quote.id)) return quote.id;
  throw new Error('La cotizacion debe guardarse en el servidor antes de subir imagenes.');
}

async function uploadMaterialImageFile(file: File | null, rowIndex: number) {
  if (!file) {
    ElMessage.warning('Selecciona una imagen valida.');
    return;
  }

  const currentRow = quote.materials[rowIndex];
  if (!currentRow) return;
  currentRow.__imageUploading = true;

  try {
    const quoteId = await ensureRemoteQuoteForMaterialImage();
    const targetRow = quote.materials[rowIndex] || currentRow;
    targetRow.__imageUploading = true;
    const uploaded = await quotesApi.uploadMaterialImage(quoteId, file);
    targetRow.imageUrl = uploaded.imageUrl;
    targetRow.imageFileId = uploaded.imageFileId;
    targetRow.imageName = uploaded.imageName || file.name;
    targetRow.imageMimeType = uploaded.imageMimeType || file.type;
    await persistQuote();
    ElMessage.success('Imagen de material guardada');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'No fue posible subir la imagen');
  } finally {
    const targetRow = quote.materials[rowIndex] || currentRow;
    if (targetRow) targetRow.__imageUploading = false;
  }
}

function handleMaterialImageInput(event: Event, rowIndex: number) {
  const input = event.target as HTMLInputElement;
  void uploadMaterialImageFile(firstImageFile(input.files), rowIndex);
  input.value = '';
}

function handleMaterialImagePaste(event: ClipboardEvent, rowIndex: number) {
  const file = firstImageFile(event.clipboardData?.files);
  if (!file) return;
  event.preventDefault();
  void uploadMaterialImageFile(file, rowIndex);
}

function handleMaterialImageDrop(event: DragEvent, rowIndex: number) {
  void uploadMaterialImageFile(firstImageFile(event.dataTransfer?.files), rowIndex);
}

function clearMaterialImage(material: any) {
  material.imageUrl = '';
  material.imageFileId = '';
  material.imageName = '';
  material.imageMimeType = '';
}

function openMaterialImagePreview(material: any) {
  if (!material.imageUrl) return;
  materialImagePreview.url = material.imageUrl;
  materialImagePreview.title = material.partNumber || material.imageName || 'Imagen de material';
  materialImagePreview.description = material.description || '';
  materialImagePreviewVisible.value = true;
}

function addProductToBom(product: any) {
  const unitCost = convertedProductCost(product);
  quote.materials.push(hydrateMaterialRow(updateMaterialTotals({
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
  })));
  refreshTotals();
}

function canConvertMaterialCostToMxn(material: any) {
  return Number(material.unitCost || 0) > 0 && Number(quote.commercial.usdToMxnRate || 0) > 0;
}

function convertMaterialCostToMxn(material: any) {
  const sourceUnitCost = Number(material.unitCost || 0);
  const exchangeRate = Number(quote.commercial.usdToMxnRate || 0);
  if (sourceUnitCost <= 0 || exchangeRate <= 0) {
    ElMessage.warning('Captura un costo y un tipo de cambio USD a MXN valido.');
    return;
  }
  material.unitCost = Math.round(sourceUnitCost * exchangeRate * 100) / 100;
  material.sourceCurrency = 'USD';
  material.sourceUnitCost = sourceUnitCost;
  material.exchangeRateApplied = exchangeRate;
  refreshTotals();
  ElMessage.success(`Convertido de USD ${money(sourceUnitCost)} a MXN ${money(material.unitCost)}.`);
}

function matchedProviderId(supplier: string) {
  const provider = providers.providers.find((entry) => String(entry.companyName || '').trim().toLowerCase() === String(supplier || '').trim().toLowerCase());
  return provider?.id || null;
}

function normalizeMaterialProviders() {
  quote.materials = quote.materials.map((item: any) => hydrateMaterialRow(sanitizeMaterialRow(item)));
}

function removeMaterial(index: number) {
  quote.materials.splice(index, 1);
  refreshTotals();
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
  const [item] = items.splice(index, 1);
  items.splice(nextIndex, 0, item);
}

function moveArrayItemTo<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return;
  const [item] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, item);
}

function reorderRows(list: ReorderList) {
  return list === 'materials' ? quote.materials : quote.services;
}

function startRowDrag(list: ReorderList, index: number, event: DragEvent) {
  draggedRow.value = { list, index };
  dragTarget.value = { list, index };
  event.dataTransfer?.setData('text/plain', `${list}:${index}`);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function setDragTarget(list: ReorderList, index: number) {
  if (draggedRow.value?.list !== list) return;
  dragTarget.value = { list, index };
}

function isDragTarget(list: ReorderList, index: number) {
  return draggedRow.value?.list === list && dragTarget.value?.list === list && dragTarget.value.index === index;
}

function dropDraggedRow(list: ReorderList, targetIndex: number) {
  const state = draggedRow.value;
  if (!state || state.list !== list) return;
  moveArrayItemTo(reorderRows(list), state.index, targetIndex);
  draggedRow.value = null;
  dragTarget.value = null;
}

function endRowDrag() {
  draggedRow.value = null;
  dragTarget.value = null;
}

function moveMaterial(index: number, direction: -1 | 1) {
  moveArrayItem(quote.materials, index, direction);
}

async function focusMaterialField(rowIndex: number, field: 'description' | 'unitCost' | 'markupPercentage') {
  if (rowIndex < 0 || rowIndex >= quote.materials.length) return;
  await nextTick();
  const fieldElement = document.querySelector<HTMLElement>(
    `[data-material-row="${rowIndex}"][data-material-field="${field}"]`
  );
  const input = fieldElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') || null;
  input?.focus();
  input?.select();
}

function handleMaterialFieldKeydown(event: KeyboardEvent, rowIndex: number, field: 'description' | 'unitCost' | 'markupPercentage') {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  event.stopPropagation();
  void focusMaterialField(rowIndex + (event.key === 'ArrowDown' ? 1 : -1), field);
}

function addService() {
  quote.services.push(updateServiceTotals({ serviceType: 'PLC programming', description: '', hours: 1, hourlyRate: 1710, total: 0, notes: '' }));
}

function removeService(index: number) {
  quote.services.splice(index, 1);
  refreshTotals();
}

function moveService(index: number, direction: -1 | 1) {
  moveArrayItem(quote.services, index, direction);
}

async function loadFamilyQuotes() {
  if (!quote.id || isLocalQuoteId(quote.id)) {
    familyQuotes.value = [];
    return;
  }
  familyQuotes.value = await quotesApi.family(quote.id);
}

function updateSaveState(nextState: 'saved' | 'saving' | 'pending' | 'error' | 'queued') {
  saveState.value = nextState;
}

async function persistQuote(options: { manual?: boolean } = {}) {
  if (isHydrating.value) return;
  if (saveState.value === 'saving') {
    saveQueued = true;
    return;
  }

  window.clearTimeout(autosaveTimer);
  updateSaveState('saving');
  const previousId = quote.id;

  try {
    normalizeMaterialProviders();
    syncSnapshots();
    refreshTotals();
    const saved = await quotes.saveQuote(buildPersistableQuote(quote), { refreshList: false });
    suppressAutosave = true;
    Object.assign(quote, saved);
    normalizeMaterialProviders();
    refreshTotals();
    syncSnapshots();
    await loadFamilyQuotes();
    lastSavedSnapshot.value = quoteSnapshot.value;
    updateSaveState(!navigator.onLine || String(saved.id || '').startsWith('local-quote-') ? 'queued' : 'saved');
    if (saved.id && saved.id !== previousId && route.params.id !== saved.id) {
      router.replace(`/quotes/${saved.id}/edit`);
    }
    if (options.manual) ElMessage.success(navigator.onLine ? 'Cotizacion guardada' : 'Cotizacion guardada localmente');
  } catch (error: any) {
    updateSaveState('error');
    if (options.manual) throw error;
  } finally {
    window.setTimeout(() => {
      suppressAutosave = false;
    }, 0);
    if (saveQueued) {
      saveQueued = false;
      queueAutosave();
    }
  }
}

function queueAutosave() {
  if (isHydrating.value || suppressAutosave) return;
  updateSaveState('pending');
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    void persistQuote();
  }, 1400);
}

async function save() {
  try {
    await persistQuote({ manual: true });
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || 'No fue posible guardar la cotizacion');
  }
}

function openMaterialUrlDialog(index: number | null = null) {
  materialUrlTargetIndex.value = index;
  materialUrlDialogVisible.value = true;
}

function resetMaterialUrlDialog() {
  materialUrlForm.url = '';
  materialUrlForm.quantity = 1;
  materialUrlPreview.value = null;
  materialUrlError.value = '';
  materialUrlTargetIndex.value = null;
}

async function analyzeMaterialUrl() {
  materialUrlError.value = '';
  materialUrlPreview.value = null;
  if (!materialUrlForm.url.trim()) {
    materialUrlError.value = 'Ingresa una liga de producto.';
    return;
  }
  materialUrlLoading.value = true;
  try {
    materialUrlPreview.value = await materialsApi.extractFromUrl({
      url: materialUrlForm.url.trim(),
      quantity: materialUrlForm.quantity,
      commercial: quote.commercial
    });
  } catch (error: any) {
    materialUrlError.value = error?.response?.data?.message || 'No fue posible analizar la liga';
  } finally {
    materialUrlLoading.value = false;
  }
}

async function runQuoteReview(prompt: string) {
  reviewLoading.value = true;
  reviewWarnings.value = [];
  try {
    const response = await aiApi.reviewQuoteChat({
      quote: buildPersistableQuote(quote),
      messages: [
        ...reviewMessages.value,
        { role: 'user', content: prompt }
      ]
    });
    reviewMessages.value.push({ role: 'user', content: prompt });
    reviewMessages.value.push({ role: 'assistant', content: response.reply || 'Sin observaciones por ahora.' });
    reviewSuggestions.value = response.suggestions || [];
    reviewWarnings.value = response.warnings || [];
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || 'No fue posible analizar la cotizacion con AI');
  } finally {
    reviewLoading.value = false;
  }
}

async function startQuoteReview() {
  await runQuoteReview('Analiza la cotizacion actual completa y dame sugerencias priorizadas. No cambies nada automaticamente.');
}

async function sendReviewPrompt() {
  const prompt = reviewPrompt.value.trim();
  if (!prompt) {
    ElMessage.warning('Escribe una instruccion para el AI');
    return;
  }
  reviewPrompt.value = '';
  await runQuoteReview(prompt);
}

function clearReviewChat() {
  reviewPrompt.value = '';
  reviewMessages.value = [];
  reviewSuggestions.value = [];
  reviewWarnings.value = [];
}

function applyMaterialUrlPreview() {
  if (!materialUrlPreview.value) return;
  const previewMaterial = structuredClone(materialUrlPreview.value.material);
  const sourceCurrency = previewMaterial.sourceCurrency || quote.commercial.currency;
  const convertedCost = quote.commercial.currency === 'MXN' && sourceCurrency === 'USD'
    ? Math.round(Number(previewMaterial.unitCost || 0) * Number(quote.commercial.usdToMxnRate || 0) * 100) / 100
    : Number(previewMaterial.unitCost || 0);
  const nextItem = hydrateMaterialRow(updateMaterialTotals({
    ...previewMaterial,
    providerId: previewMaterial.providerId || matchedProviderId(previewMaterial.supplier),
    unitCost: convertedCost,
    markupPercentage: quote.commercial.materialMarkupPercentage
  }, quote.commercial.materialMarkupPercentage));
  if (quote.commercial.currency === 'MXN' && sourceCurrency === 'USD') {
    nextItem.notes = [
      nextItem.notes,
      `Costo origen: USD ${money(previewMaterial.unitCost)}. Convertido a ${quote.commercial.usdToMxnRate} MXN/USD.`
    ].filter(Boolean).join(' ').trim();
    nextItem.exchangeRateApplied = quote.commercial.usdToMxnRate;
  }
  if (materialUrlTargetIndex.value !== null && quote.materials[materialUrlTargetIndex.value]) {
    quote.materials.splice(materialUrlTargetIndex.value, 1, nextItem);
  } else {
    quote.materials.push(nextItem);
  }
  refreshTotals();
  materialUrlDialogVisible.value = false;
  ElMessage.success('Material aplicado');
}

async function ensureProviderDraftsForRfq() {
  const missingSuppliers = [...new Set<string>(
    quote.materials
      .filter((item: any) => !item.providerId && String(item.supplier || '').trim())
      .map((item: any) => String(item.supplier || '').trim())
  )];

  if (!missingSuppliers.length) return;

  try {
    await ElMessageBox.confirm(
      `Hay ${missingSuppliers.length} proveedores en texto libre. Se crearan registros borrador para continuar.`,
      'Crear proveedores borrador',
      { confirmButtonText: 'Crear', cancelButtonText: 'Cancelar', type: 'warning' }
    );
  } catch {
    return;
  }

  for (const supplierName of missingSuppliers) {
    let provider = providers.providers.find((entry) => String(entry.companyName || '').trim().toLowerCase() === supplierName.toLowerCase());
    if (!provider) {
      provider = await providersApi.create({
        companyName: supplierName,
        primaryContactName: '',
        primaryContactEmail: '',
        primaryContactPhone: '',
        notes: 'Proveedor creado automaticamente desde materiales de cotizacion.',
        active: true
      });
      providers.providers.unshift(provider);
    }

    quote.materials = quote.materials.map((item: any) => {
      if (item.providerId || String(item.supplier || '').trim().toLowerCase() !== supplierName.toLowerCase()) return item;
      return hydrateMaterialRow({
        ...item,
        providerId: provider.id,
        supplier: provider.companyName
      });
    });
  }
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

async function openRfqDialog() {
  normalizeMaterialProviders();
  await ensureProviderDraftsForRfq();
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

async function handleOnlineReconnect() {
  try {
    await quotes.syncPendingQuotes();
    if (!String(quote.id || '').startsWith('local-quote-') && quotes.pendingSyncCount === 0) {
      updateSaveState('saved');
    }
  } catch {
    updateSaveState('error');
  }
}

onMounted(async () => {
  settings.load();
  await Promise.all([customers.fetchCustomers(), projects.fetchProjects(), providers.fetchProviders()]);
  if (route.params.id) {
    const quoteId = route.params.id as string;
    if (isLocalQuoteId(quoteId)) {
      Object.assign(quote, getLocalDraft(quoteId) || createEmptyQuote());
    } else {
      try {
        Object.assign(quote, await quotesApi.get(quoteId));
      } catch {
        const fallback = getLocalDraft(quoteId);
        if (fallback) Object.assign(quote, fallback);
      }
    }
  } else quote.recipientContactId = null;
  quote.outputMode = quote.outputMode === 'unified' ? 'unified' : 'separated';
  normalizeMaterialProviders();
  refreshTotals();
  syncSnapshots();
  lastSavedSnapshot.value = quoteSnapshot.value;
  isHydrating.value = false;
  await loadFamilyQuotes();
  window.addEventListener('offline-quote-synced', handleOfflineQuoteSynced as EventListener);
  window.addEventListener('online', handleOnlineReconnect);
});

watch(emailDialogVisible, (visible) => {
  if (visible) prepareEmailDialog();
});

watch(quoteSnapshot, (nextSnapshot) => {
  if (isHydrating.value || suppressAutosave) return;
  if (nextSnapshot !== lastSavedSnapshot.value) queueAutosave();
});

function handleOfflineQuoteSynced(event: Event) {
  const detail = (event as CustomEvent).detail || {};
  if (detail.localId && detail.localId === quote.id && detail.remoteId) {
    updateSaveState('saved');
    router.replace(`/quotes/${detail.remoteId}/edit`);
    ElMessage.success('La cotizacion local se sincronizo con el servidor');
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(autosaveTimer);
  window.removeEventListener('online', handleOnlineReconnect);
  window.removeEventListener('offline-quote-synced', handleOfflineQuoteSynced as EventListener);
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

.ai-review-card {
  overflow: hidden;
}

.ai-review-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.9fr);
  gap: 16px;
  margin-bottom: 16px;
}

.ai-review-thread {
  display: grid;
  gap: 12px;
  min-height: 220px;
  max-height: 420px;
  overflow: auto;
  padding-right: 4px;
}

.ai-review-empty {
  border: 1px dashed rgba(107, 122, 144, 0.35);
  border-radius: 14px;
  padding: 18px;
  color: #667085;
  background: #fbfcfe;
}

.ai-review-sidebar {
  display: grid;
  align-content: start;
  gap: 12px;
}

.ai-review-suggestions {
  display: grid;
  gap: 12px;
}

.ai-review-suggestion {
  border: 1px solid #d7deea;
  border-radius: 14px;
  padding: 14px;
  background: #f8fbff;
}

.ai-review-suggestion small {
  display: block;
  margin-top: 4px;
  color: #667085;
}

.ai-review-suggestion p {
  margin: 10px 0 0;
}

.provider-cell {
  display: grid;
  gap: 8px;
}

.list-bottom-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.list-bottom-actions .el-button + .el-button {
  margin-left: 0;
}

.quote-line-items-table :deep(.el-table__row:hover > td.el-table__cell) {
  background-color: rgba(123, 172, 66, 0.12) !important;
}

.quote-line-items-table :deep(.el-table__row:hover > td.el-table__cell.el-table-fixed-column--left),
.quote-line-items-table :deep(.el-table__row:hover > td.el-table__cell.el-table-fixed-column--right) {
  background-color: rgba(123, 172, 66, 0.14) !important;
}

.reorder-cell {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  padding: 2px;
  transition: background-color 0.15s ease;
}

.reorder-cell.is-drag-target {
  background: rgba(46, 117, 182, 0.12);
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid #d7deea;
  border-radius: 999px;
  color: #5f6f86;
  cursor: grab;
  background: #fff;
}

.drag-handle:active {
  cursor: grabbing;
}

.reorder-cell .el-button + .el-button {
  margin-left: 0;
}

.material-description-cell {
  display: grid;
  gap: 6px;
}

.material-description-cell .el-button {
  justify-self: end;
}

.material-image-cell {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px dashed #c9d6c1;
  border-radius: 12px;
  background: rgba(123, 172, 66, 0.07);
  outline: none;
}

.material-image-cell:focus-within,
.material-image-cell:focus {
  border-color: #7bac42;
  box-shadow: 0 0 0 2px rgba(123, 172, 66, 0.16);
}

.material-image-cell img {
  width: 76px;
  height: 58px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #d7deea;
  background: #fff;
  cursor: zoom-in;
}

.material-image-placeholder {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-height: 58px;
  color: #5f6f46;
  font-size: 12px;
}

.material-image-upload {
  cursor: pointer;
  color: #2f6f1f;
  font-size: 12px;
  font-weight: 600;
}

.material-image-upload input {
  display: none;
}

.material-image-preview-dialog img {
  display: block;
  max-width: 100%;
  max-height: 72vh;
  margin: 0 auto 12px;
  object-fit: contain;
  border-radius: 14px;
  background: #f5f7fa;
}

.unit-cost-cell {
  display: grid;
  gap: 6px;
}

.unit-cost-cell .el-button {
  justify-self: stretch;
}

.url-preview-card :deep(.el-card__header) {
  padding-bottom: 12px;
}

.floating-save {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
}

.floating-save .el-button {
  box-shadow: 0 12px 28px rgba(32, 51, 74, 0.22);
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

@media (max-width: 768px) {
  .ai-review-layout {
    grid-template-columns: 1fr;
  }

  .ai-review-thread {
    max-height: none;
  }

  .floating-save {
    right: 16px;
    bottom: 16px;
  }

  .floating-save .el-button {
    width: auto;
    max-width: calc(100vw - 32px);
  }
}
</style>
