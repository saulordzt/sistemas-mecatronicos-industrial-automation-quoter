import { defineStore } from 'pinia';
import { productsApi } from '../services/api';
import type { Product } from '../types';

export const useProductStore = defineStore('products', {
  state: () => ({
    products: [] as Product[],
    providers: [] as any[],
    categories: [] as any[],
    loading: false,
    total: 0,
    page: 1,
    pageSize: 25,
    search: '',
    supplier: '',
    category: ''
  }),
  actions: {
    async fetchProducts(params: { page?: number; pageSize?: number; search?: string; supplier?: string; category?: string } = {}) {
      this.loading = true;
      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const supplier = params.supplier ?? this.supplier;
        const category = params.category ?? this.category;
        const response = await productsApi.list({ page, pageSize, search, supplier, category });
        this.products = response.items || [];
        this.total = response.total || 0;
        this.page = response.page || page;
        this.pageSize = response.pageSize || pageSize;
        this.search = search;
        this.supplier = supplier;
        this.category = category;
      } finally {
        this.loading = false;
      }
    },
    async fetchProviders() {
      this.providers = await productsApi.providers();
    },
    async fetchCategories(supplier?: string) {
      const selectedSupplier = supplier ?? this.supplier;
      if (!selectedSupplier) {
        this.categories = [];
        return;
      }
      this.categories = await productsApi.categories(selectedSupplier);
    },
    async saveProduct(product: Product) {
      const saved = product.id
        ? await productsApi.update(product.id, product)
        : await productsApi.create(product);
      await Promise.all([this.fetchProducts(), this.fetchProviders(), this.fetchCategories()]);
      return saved;
    },
    async deleteProduct(id: string) {
      await productsApi.remove(id);
      await Promise.all([this.fetchProducts(), this.fetchProviders(), this.fetchCategories()]);
    },
    async importXlsx(file: File) {
      const result = await productsApi.importXlsx(file);
      await Promise.all([this.fetchProducts({ page: 1 }), this.fetchProviders(), this.fetchCategories()]);
      return result;
    }
  }
});
