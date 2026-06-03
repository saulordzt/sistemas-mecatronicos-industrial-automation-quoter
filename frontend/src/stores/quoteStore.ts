import { defineStore } from 'pinia';
import { quotesApi } from '../services/api';
import type { Quote } from '../types';

export const useQuoteStore = defineStore('quotes', {
  state: () => ({
    quotes: [] as Quote[],
    loading: false
  }),
  actions: {
    async fetchQuotes() {
      this.loading = true;
      try {
        this.quotes = await quotesApi.list();
      } finally {
        this.loading = false;
      }
    },
    async saveQuote(quote: Quote) {
      const saved = quote.id
        ? await quotesApi.update(quote.id, quote)
        : await quotesApi.create(quote);
      await this.fetchQuotes();
      return saved;
    },
    async deleteQuote(id: string) {
      await quotesApi.remove(id);
      await this.fetchQuotes();
    },
    async duplicateQuote(id: string) {
      const quote = await quotesApi.duplicate(id);
      await this.fetchQuotes();
      return quote;
    },
    async reviseQuote(id: string) {
      const quote = await quotesApi.revise(id);
      await this.fetchQuotes();
      return quote;
    },
    async createQuoteVariant(id: string, variantName?: string) {
      const quote = await quotesApi.createVariant(id, { variantName });
      await this.fetchQuotes();
      return quote;
    }
  }
});
