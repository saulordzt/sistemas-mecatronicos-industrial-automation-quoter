import { defineStore } from 'pinia';
import { projectsApi } from '../services/api';
import type { Project } from '../types';
import { readCachedValue, writeCachedValue } from '../utils/localCache';

const cacheKey = 'automation-quoter-projects-cache';

export const useProjectStore = defineStore('projects', {
  state: () => ({
    projects: [] as Project[],
    loading: false
  }),
  actions: {
    async fetchProjects() {
      this.loading = true;
      try {
        this.projects = await projectsApi.list();
        writeCachedValue(cacheKey, this.projects);
      } catch {
        this.projects = readCachedValue<Project[]>(cacheKey, []);
      } finally {
        this.loading = false;
      }
    },
    async saveProject(project: Project) {
      const saved = project.id
        ? await projectsApi.update(project.id, project)
        : await projectsApi.create(project);
      await this.fetchProjects();
      return saved;
    },
    async deleteProject(id: string) {
      await projectsApi.remove(id);
      await this.fetchProjects();
    }
  }
});
