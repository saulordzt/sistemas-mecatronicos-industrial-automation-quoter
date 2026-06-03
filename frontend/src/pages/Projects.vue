<template>
  <div class="page">
    <div class="page-header">
      <h1>Proyectos</h1>
      <el-button type="primary" @click="$router.push('/projects/new')">Nuevo Proyecto</el-button>
    </div>

    <el-card>
      <el-table :data="store.projects" v-loading="store.loading" stripe>
        <el-table-column prop="projectName" label="Proyecto" min-width="190" />
        <el-table-column prop="projectType" label="Tipo" min-width="170" />
        <el-table-column prop="industry" label="Industria" min-width="130" />
        <el-table-column prop="location" label="Location" min-width="140" />
        <el-table-column prop="status" label="Estatus" width="120" />
        <el-table-column label="Acciones" width="170">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" @click="$router.push(`/projects/${row.id}/edit`)">Editar</el-button>
              <el-button size="small" type="danger" @click="store.deleteProject(row.id)">Eliminar</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useProjectStore } from '../stores/projectStore';

const store = useProjectStore();
onMounted(store.fetchProjects);
</script>
