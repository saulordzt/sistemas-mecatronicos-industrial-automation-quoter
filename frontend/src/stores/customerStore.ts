import { defineStore } from 'pinia';
import { customersApi } from '../services/api';
import type { Customer } from '../types';

export const useCustomerStore = defineStore('customers', {
  state: () => ({
    customers: [] as Customer[],
    loading: false
  }),
  actions: {
    async fetchCustomers() {
      this.loading = true;
      try {
        this.customers = await customersApi.list();
      } finally {
        this.loading = false;
      }
    },
    async saveCustomer(customer: Customer) {
      const saved = customer.id
        ? await customersApi.update(customer.id, customer)
        : await customersApi.create(customer);
      await this.fetchCustomers();
      return saved;
    },
    async deleteCustomer(id: string) {
      await customersApi.remove(id);
      await this.fetchCustomers();
    }
  }
});
