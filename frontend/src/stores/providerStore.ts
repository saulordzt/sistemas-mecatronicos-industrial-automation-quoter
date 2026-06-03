import { defineStore } from 'pinia';
import { providersApi } from '../services/api';
import type { Provider } from '../types';

export const useProviderStore = defineStore('providers', {
  state: () => ({
    providers: [] as Provider[],
    loading: false
  }),
  actions: {
    async fetchProviders() {
      this.loading = true;
      try {
        this.providers = await providersApi.list();
      } finally {
        this.loading = false;
      }
    },
    async saveProvider(provider: Provider) {
      const saved = provider.id
        ? await providersApi.update(provider.id, provider)
        : await providersApi.create(provider);
      await this.fetchProviders();
      return saved;
    },
    async deleteProvider(id: string) {
      await providersApi.remove(id);
      await this.fetchProviders();
    }
  }
});
