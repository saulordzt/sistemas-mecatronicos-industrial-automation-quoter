import { defineStore } from 'pinia';
import { quotesApi } from '../services/api';
import type { Quote } from '../types';
import {
  getCachedQuotes,
  getPendingQuoteCount,
  mergeQuotesWithLocalDrafts,
  queueQuoteSave,
  setCachedQuotes,
  syncQueuedQuotes
} from '../utils/offlineQueue';

export const useQuoteStore = defineStore('quotes', {
  state: () => ({
    quotes: [] as Quote[],
    loading: false,
    pendingSyncCount: 0
  }),
  actions: {
    isOfflineError(error: any) {
      return !navigator.onLine || !error?.response;
    },
    async syncPendingQuotes() {
      const synced = await syncQueuedQuotes(
        (quote) => quotesApi.create(quote),
        (id, quote) => quotesApi.update(id, quote)
      );
      this.pendingSyncCount = getPendingQuoteCount();
      return synced;
    },
    async fetchQuotes() {
      this.loading = true;
      try {
        if (navigator.onLine) await this.syncPendingQuotes();
        this.quotes = mergeQuotesWithLocalDrafts(await quotesApi.list());
        setCachedQuotes(this.quotes.filter((quote) => !String(quote.id || '').startsWith('local-quote-')));
      } catch {
        this.quotes = mergeQuotesWithLocalDrafts(getCachedQuotes());
      } finally {
        this.pendingSyncCount = getPendingQuoteCount();
        this.loading = false;
      }
    },
    async saveQuote(quote: Quote, options: { refreshList?: boolean } = {}) {
      try {
        if (!navigator.onLine) throw new Error('offline');
        const saved = quote.id && !String(quote.id).startsWith('local-quote-')
          ? await quotesApi.update(quote.id, quote)
          : await quotesApi.create(quote);
        if (options.refreshList !== false) await this.fetchQuotes();
        else this.pendingSyncCount = getPendingQuoteCount();
        return saved;
      } catch (error) {
        if (!this.isOfflineError(error)) throw error;
        const saved = queueQuoteSave(quote);
        this.pendingSyncCount = getPendingQuoteCount();
        if (options.refreshList !== false) this.quotes = mergeQuotesWithLocalDrafts(getCachedQuotes());
        return saved;
      }
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
