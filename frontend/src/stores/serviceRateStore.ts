import { defineStore } from 'pinia';
import { serviceRatesApi } from '../services/api';
import type { ServiceRate } from '../types';
import { readCachedValue, writeCachedValue } from '../utils/localCache';

const cacheKey = 'automation-quoter-service-rates-cache';

export const useServiceRateStore = defineStore('serviceRates', {
  state: () => ({
    serviceRates: [] as ServiceRate[],
    loading: false
  }),
  actions: {
    async fetchServiceRates() {
      this.loading = true;
      try {
        this.serviceRates = await serviceRatesApi.list();
        writeCachedValue(cacheKey, this.serviceRates);
      } catch {
        this.serviceRates = readCachedValue<ServiceRate[]>(cacheKey, []);
      } finally {
        this.loading = false;
      }
    },
    async saveServiceRate(rate: ServiceRate) {
      const saved = rate.id
        ? await serviceRatesApi.update(rate.id, rate)
        : await serviceRatesApi.create(rate);
      await this.fetchServiceRates();
      return saved;
    },
    async deleteServiceRate(id: string) {
      await serviceRatesApi.remove(id);
      await this.fetchServiceRates();
    }
  }
});
