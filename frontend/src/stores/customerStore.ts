import { defineStore } from 'pinia';
import { customersApi } from '../services/api';
import type { Customer } from '../types';
import { normalizeCustomer } from '../utils/customerContacts';

export const useCustomerStore = defineStore('customers', {
  state: () => ({
    customers: [] as Customer[],
    loading: false
  }),
  actions: {
    async fetchCustomers() {
      this.loading = true;
      try {
        this.customers = (await customersApi.list()).map(normalizeCustomer);
      } finally {
        this.loading = false;
      }
    },
    async saveCustomer(customer: Customer) {
      const payload = normalizeCustomer(customer);
      const saved = customer.id
        ? await customersApi.update(customer.id, payload)
        : await customersApi.create(payload);
      await this.fetchCustomers();
      return normalizeCustomer(saved);
    },
    async deleteCustomer(id: string) {
      await customersApi.remove(id);
      await this.fetchCustomers();
    }
  }
});
