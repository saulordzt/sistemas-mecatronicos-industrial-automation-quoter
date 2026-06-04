import type { Quote } from '../types';
import { readCachedValue, writeCachedValue } from './localCache';

const localDraftsKey = 'automation-quoter-local-drafts';
const pendingQueueKey = 'automation-quoter-pending-quote-queue';
const cachedQuotesKey = 'automation-quoter-cached-quotes';

type PendingMutation = {
  localId: string;
  serverId: string | null;
  kind: 'create' | 'update';
  quote: Quote;
  queuedAt: string;
};

function emitQueueChanged() {
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { pendingCount: getPendingQuoteCount() } }));
}

function emitDraftSynced(localId: string, remoteId: string) {
  window.dispatchEvent(new CustomEvent('offline-quote-synced', { detail: { localId, remoteId } }));
}

export function isLocalQuoteId(id?: string | null) {
  return String(id || '').startsWith('local-quote-');
}

export function createLocalQuoteId() {
  return `local-quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCachedQuotes(): Quote[] {
  return readCachedValue<Quote[]>(cachedQuotesKey, []);
}

export function setCachedQuotes(quotes: Quote[]) {
  writeCachedValue(cachedQuotesKey, quotes);
}

export function getLocalDrafts(): Quote[] {
  return readCachedValue<Quote[]>(localDraftsKey, []);
}

export function getLocalDraft(id: string) {
  return getLocalDrafts().find((item) => item.id === id) || null;
}

export function upsertLocalDraft(quote: Quote) {
  const drafts = getLocalDrafts().filter((item) => item.id !== quote.id);
  drafts.unshift(structuredClone(quote));
  writeCachedValue(localDraftsKey, drafts);
}

export function removeLocalDraft(id: string) {
  writeCachedValue(localDraftsKey, getLocalDrafts().filter((item) => item.id !== id));
}

export function getPendingQueue(): PendingMutation[] {
  return readCachedValue<PendingMutation[]>(pendingQueueKey, []);
}

export function getPendingQuoteCount() {
  return getPendingQueue().length;
}

export function queueQuoteSave(quote: Quote) {
  const workingQuote = structuredClone(quote);
  if (!workingQuote.id) workingQuote.id = createLocalQuoteId();
  const localId = workingQuote.id;
  const queue = getPendingQueue().filter((item) => item.localId !== localId);
  queue.push({
    localId,
    serverId: isLocalQuoteId(localId) ? null : localId,
    kind: isLocalQuoteId(localId) ? 'create' : 'update',
    quote: workingQuote,
    queuedAt: new Date().toISOString()
  });
  writeCachedValue(pendingQueueKey, queue);
  upsertLocalDraft(workingQuote);
  emitQueueChanged();
  return workingQuote;
}

export function mergeQuotesWithLocalDrafts(remoteQuotes: Quote[]) {
  const byId = new Map(remoteQuotes.map((quote) => [quote.id, quote]));
  for (const localDraft of getLocalDrafts()) {
    byId.set(localDraft.id, localDraft);
  }
  return [...byId.values()];
}

export async function syncQueuedQuotes(
  createQuote: (quote: Quote) => Promise<Quote>,
  updateQuote: (id: string, quote: Quote) => Promise<Quote>
) {
  if (!navigator.onLine) return [];
  const queue = getPendingQueue();
  const remaining: PendingMutation[] = [];
  const synced: Array<{ localId: string; remoteId: string }> = [];

  for (const item of queue) {
    try {
      if (item.kind === 'create') {
        const payload = structuredClone(item.quote);
        delete payload.id;
        const saved = await createQuote(payload);
        removeLocalDraft(item.localId);
        synced.push({ localId: item.localId, remoteId: saved.id! });
        emitDraftSynced(item.localId, saved.id!);
        continue;
      }

      const serverId = item.serverId || item.localId;
      await updateQuote(serverId, item.quote);
      removeLocalDraft(item.localId);
    } catch {
      remaining.push(item);
    }
  }

  writeCachedValue(pendingQueueKey, remaining);
  emitQueueChanged();
  return synced;
}
