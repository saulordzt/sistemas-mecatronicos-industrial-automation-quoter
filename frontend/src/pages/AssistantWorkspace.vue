<template>
  <div class="page assistant-page">
    <div class="page-header">
      <h1>AI Chat</h1>
      <div class="table-actions">
        <el-button @click="createSession" :loading="creatingSession">Nueva sesion</el-button>
        <el-button v-if="currentSession?.draftQuoteId" type="primary" @click="openDraftQuote">Abrir borrador</el-button>
      </div>
    </div>

    <div class="assistant-layout">
      <el-card class="assistant-sessions-card">
        <template #header>Sesiones</template>
        <div class="assistant-sessions">
          <button
            v-for="session in sessions"
            :key="session.id"
            type="button"
            class="assistant-session-item"
            :class="{ active: session.id === currentSessionId }"
            @click="selectSession(session.id!)"
          >
            <strong>{{ session.title || 'Sesion sin titulo' }}</strong>
            <span>{{ statusLabel(session.status) }}</span>
            <small>{{ formatDate(session.updatedAt) }}</small>
          </button>
        </div>
      </el-card>

      <div class="assistant-main">
        <el-card v-if="currentSession" class="section-card">
          <template #header>
            <div class="page-header" style="margin: 0">
              <strong>{{ currentSession.title }}</strong>
              <div class="table-actions">
                <el-tag>{{ statusLabel(currentSession.status) }}</el-tag>
                <el-button size="small" :loading="processing" @click="runAssistant">Procesar y actualizar borrador</el-button>
              </div>
            </div>
          </template>

          <div class="assistant-summary">
            <div>
              <span>Borrador</span>
              <strong>{{ currentSession.draftQuoteId || 'Sin crear' }}</strong>
            </div>
            <div>
              <span>Cliente</span>
              <strong>{{ currentSession.structuredContext?.customer?.companyName || '-' }}</strong>
            </div>
            <div>
              <span>Proyecto</span>
              <strong>{{ currentSession.structuredContext?.project?.projectName || '-' }}</strong>
            </div>
          </div>

          <div v-if="currentSession.warnings?.length" class="assistant-warnings">
            <el-alert
              v-for="warning in currentSession.warnings"
              :key="warning"
              type="warning"
              :closable="false"
              :title="warning"
            />
          </div>

          <div class="assistant-chat">
            <div
              v-for="message in currentSession.messages || []"
              :key="message.id"
              class="assistant-message"
              :class="message.role"
            >
              <small>{{ message.role === 'assistant' ? 'Asistente' : 'Usuario' }}</small>
              <p>{{ message.content }}</p>
              <span>{{ formatDate(message.createdAt) }}</span>
            </div>
          </div>

          <div class="assistant-composer">
            <el-input
              v-model="message"
              type="textarea"
              :rows="4"
              placeholder="Describe el proyecto, pega texto del cliente o explica lo que necesita."
            />
            <div class="assistant-composer-actions">
              <input ref="fileInput" type="file" multiple accept=".pdf,image/*,audio/*,.txt" class="assistant-file-input" @change="handleFiles" />
              <div class="assistant-selected-files" v-if="pendingFiles.length">
                <el-tag v-for="file in pendingFiles" :key="file.name + file.size" size="small">{{ file.name }}</el-tag>
              </div>
              <div class="table-actions">
                <el-button @click="triggerFileInput">Adjuntar archivos</el-button>
                <el-button type="primary" :loading="sending" @click="sendMessageAndFiles">Enviar</el-button>
              </div>
            </div>
          </div>
        </el-card>

        <el-card v-if="currentSession?.structuredContext" class="section-card">
          <template #header>Extraccion actual</template>
          <div class="assistant-grid">
            <div>
              <h3>Cliente</h3>
              <p><strong>Empresa:</strong> {{ currentSession.structuredContext.customer.companyName || '-' }}</p>
              <p><strong>Contacto:</strong> {{ currentSession.structuredContext.customer.contactName || '-' }}</p>
              <p><strong>Correo:</strong> {{ currentSession.structuredContext.customer.email || '-' }}</p>
            </div>
            <div>
              <h3>Proyecto</h3>
              <p><strong>Nombre:</strong> {{ currentSession.structuredContext.project.projectName || '-' }}</p>
              <p><strong>Tipo:</strong> {{ currentSession.structuredContext.project.projectType || '-' }}</p>
              <p><strong>Industria:</strong> {{ currentSession.structuredContext.project.industry || '-' }}</p>
            </div>
            <div>
              <h3>Cotizacion</h3>
              <p><strong>Alcance:</strong> {{ currentSession.structuredContext.quote.scopeOfWork || '-' }}</p>
              <p><strong>Materiales:</strong> {{ currentSession.structuredContext.quote.materials.length }}</p>
              <p><strong>Servicios:</strong> {{ currentSession.structuredContext.quote.services.length }}</p>
            </div>
          </div>
        </el-card>

        <el-card v-if="currentSession?.attachments?.length" class="section-card">
          <template #header>Archivos</template>
          <el-table :data="currentSession.attachments" stripe>
            <el-table-column prop="originalName" label="Archivo" min-width="220" />
            <el-table-column prop="mimeType" label="Tipo" min-width="160" />
            <el-table-column prop="status" label="Estado" width="140" />
            <el-table-column prop="summary" label="Resumen" min-width="320" />
          </el-table>
        </el-card>

        <el-card v-if="currentSession?.actions?.length" class="section-card">
          <template #header>Acciones del asistente</template>
          <el-timeline>
            <el-timeline-item
              v-for="action in currentSession.actions"
              :key="action.id"
              :timestamp="formatDate(action.createdAt)"
              placement="top"
            >
              {{ action.summary }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { assistantApi } from '../services/api';
import type { AssistantSession } from '../types';

const router = useRouter();
const sessions = ref<AssistantSession[]>([]);
const currentSession = ref<AssistantSession | null>(null);
const currentSessionId = ref<string>('');
const message = ref('');
const pendingFiles = ref<File[]>([]);
const sending = ref(false);
const processing = ref(false);
const creatingSession = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function statusLabel(value?: string) {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'Procesando',
    awaiting_user: 'En espera',
    draft_ready: 'Borrador listo',
    error: 'Error'
  };
  return map[value || ''] || value || '-';
}

async function loadSessions() {
  sessions.value = await assistantApi.listSessions();
  if (!currentSessionId.value && sessions.value[0]?.id) {
    await selectSession(sessions.value[0].id);
  }
}

async function selectSession(id: string) {
  currentSessionId.value = id;
  currentSession.value = await assistantApi.getSession(id);
}

async function createSession() {
  creatingSession.value = true;
  try {
    const session = await assistantApi.createSession({});
    await loadSessions();
    await selectSession(session.id);
  } finally {
    creatingSession.value = false;
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFiles(event: Event) {
  const target = event.target as HTMLInputElement;
  pendingFiles.value = Array.from(target.files || []);
}

async function runAssistant() {
  if (!currentSessionId.value) return;
  processing.value = true;
  try {
    await assistantApi.processSession(currentSessionId.value);
    await assistantApi.createOrUpdateDraft(currentSessionId.value);
    await selectSession(currentSessionId.value);
    await loadSessions();
    ElMessage.success('Borrador actualizado');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'No fue posible procesar la sesion');
  } finally {
    processing.value = false;
  }
}

async function sendMessageAndFiles() {
  if (!currentSessionId.value) await createSession();
  if (!currentSessionId.value) return;
  if (!message.value.trim() && !pendingFiles.value.length) {
    ElMessage.warning('Agrega texto o archivos');
    return;
  }
  sending.value = true;
  try {
    if (message.value.trim()) {
      await assistantApi.addMessage(currentSessionId.value, { content: message.value });
    }
    if (pendingFiles.value.length) {
      await assistantApi.uploadAttachments(currentSessionId.value, pendingFiles.value);
    }
    message.value = '';
    pendingFiles.value = [];
    if (fileInput.value) fileInput.value.value = '';
    await runAssistant();
  } finally {
    sending.value = false;
  }
}

function openDraftQuote() {
  if (!currentSession.value?.draftQuoteId) return;
  router.push(`/quotes/${currentSession.value.draftQuoteId}/edit`);
}

onMounted(async () => {
  await loadSessions();
  if (!sessions.value.length) await createSession();
});
</script>

<style scoped>
.assistant-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
}

.assistant-sessions {
  display: grid;
  gap: 10px;
}

.assistant-session-item {
  width: 100%;
  text-align: left;
  border: 1px solid var(--sm-line);
  background: var(--sm-panel, #fff);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.assistant-session-item.active {
  border-color: var(--sm-blue, #20334a);
  background: rgba(32, 51, 74, 0.05);
}

.assistant-main {
  display: grid;
  gap: 16px;
}

.assistant-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.assistant-summary > div,
.assistant-grid > div {
  border: 1px solid var(--sm-line);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 6px;
}

.assistant-summary span {
  color: var(--sm-steel);
  font-size: 12px;
}

.assistant-chat {
  display: grid;
  gap: 12px;
  max-height: 520px;
  overflow: auto;
  padding-right: 4px;
}

.assistant-message {
  max-width: 78%;
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 6px;
  border: 1px solid var(--sm-line);
}

.assistant-message.user {
  margin-left: auto;
  background: rgba(32, 51, 74, 0.06);
}

.assistant-message.assistant {
  background: var(--sm-panel, #fff);
}

.assistant-message p {
  margin: 0;
  white-space: pre-wrap;
}

.assistant-message small,
.assistant-message span {
  color: var(--sm-steel);
}

.assistant-composer {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.assistant-composer-actions {
  display: grid;
  gap: 10px;
}

.assistant-file-input {
  display: none;
}

.assistant-selected-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.assistant-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.assistant-warnings {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

@media (max-width: 1080px) {
  .assistant-layout,
  .assistant-grid,
  .assistant-summary {
    grid-template-columns: 1fr;
  }
}
</style>
