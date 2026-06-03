<template>
  <div class="page">
    <div class="page-header"><h1>{{ form.id ? 'Editar Cliente' : 'Nuevo Cliente' }}</h1></div>
    <el-card>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="Empresa"><el-input v-model="form.companyName" /></el-form-item>
          <el-form-item label="RFC o tax ID"><el-input v-model="form.taxId" /></el-form-item>
          <el-form-item class="full" label="Direccion"><el-input v-model="form.address" /></el-form-item>
          <el-form-item class="full" label="Notas"><el-input v-model="form.notes" type="textarea" :rows="4" /></el-form-item>
        </div>

        <div class="page-header contact-header" style="margin-top: 24px;">
          <strong>Contactos</strong>
          <el-button size="small" @click="addContact">Agregar Contacto</el-button>
        </div>

        <div class="contact-stack">
          <el-card v-for="(contact, index) in form.contacts" :key="contact.id" shadow="never" class="contact-card">
            <template #header>
              <div class="contact-card-header">
                <strong>{{ contact.name || `Contacto ${index + 1}` }}</strong>
                <div class="table-actions">
                  <el-radio :model-value="form.primaryContactId" :label="contact.id" @change="setPrimary(contact.id)">
                    Principal
                  </el-radio>
                  <el-button size="small" type="danger" @click="removeContact(index)">Eliminar</el-button>
                </div>
              </div>
            </template>
            <div class="form-grid">
              <el-form-item label="Nombre"><el-input v-model="contact.name" /></el-form-item>
              <el-form-item label="Puesto"><el-input v-model="contact.title" /></el-form-item>
              <el-form-item label="Correo"><el-input v-model="contact.email" /></el-form-item>
              <el-form-item label="Telefono"><el-input v-model="contact.phone" /></el-form-item>
              <el-form-item class="full" label="Notas"><el-input v-model="contact.notes" type="textarea" :rows="2" /></el-form-item>
            </div>
          </el-card>
        </div>

        <div class="toolbar">
          <el-button @click="$router.push('/customers')">Cancelar</el-button>
          <el-button type="primary" @click="save">Guardar Cliente</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { customersApi } from '../services/api';
import { useCustomerStore } from '../stores/customerStore';
import { emptyCustomerContact, normalizeCustomer } from '../utils/customerContacts';

const route = useRoute();
const router = useRouter();
const store = useCustomerStore();
const form = reactive(normalizeCustomer({ companyName: '', address: '', taxId: '', notes: '', contacts: [] }) as any);

function addContact() {
  const contact = emptyCustomerContact();
  form.contacts.push(contact);
  if (!form.primaryContactId) form.primaryContactId = contact.id;
}

function removeContact(index: number) {
  const [removed] = form.contacts.splice(index, 1);
  if (removed?.id === form.primaryContactId) {
    form.primaryContactId = form.contacts[0]?.id || null;
  }
}

function setPrimary(contactId: string) {
  form.primaryContactId = contactId;
}

onMounted(async () => {
  if (route.params.id) Object.assign(form, normalizeCustomer(await customersApi.get(route.params.id as string)));
  if (!form.contacts.length) addContact();
});

async function save() {
  await store.saveCustomer(normalizeCustomer(form));
  router.push('/customers');
}
</script>

<style scoped>
.contact-stack {
  display: grid;
  gap: 16px;
}

.contact-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.contact-header {
  align-items: center;
}
</style>
