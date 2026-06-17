import { randomUUID } from 'node:crypto';
import { r, dbConfig, getConnection } from '../db/connection.js';
import { createRepository } from './baseRepository.js';

const base = createRepository('quotes');
const table = () => r.db(dbConfig.db).table('quotes');

function sortFamilyQuotes(quotes) {
  return [...quotes].sort((left, right) => {
    const variantDelta = Number(left.variantSequence || 1) - Number(right.variantSequence || 1);
    if (variantDelta !== 0) return variantDelta;
    return Number(left.revisionNumber || 1) - Number(right.revisionNumber || 1);
  });
}

function cloneQuotePayload(quote) {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    clientPdfDownloadCount: _clientPdfDownloadCount,
    lastClientPdfDownloadAt: _lastClientPdfDownloadAt,
    ...copy
  } = quote;
  return copy;
}

export const quoteRepository = {
  ...base,
  async createQuote(data) {
    const id = data.id || randomUUID();
    return base.create({
      ...data,
      id,
      outputMode: data.outputMode || 'separated',
      familyId: data.familyId || id,
      rootQuoteId: data.rootQuoteId || id,
      revisionNumber: Number(data.revisionNumber || 1),
      variantSequence: Number(data.variantSequence || 1),
      variantName: data.variantName || 'Base',
      sourceQuoteId: data.sourceQuoteId || null
    });
  },
  async listFamilyMembers(id) {
    const quote = await base.findById(id);
    if (!quote) return null;
    const conn = await getConnection();
    const cursor = await table().filter({ familyId: quote.familyId || quote.id }).run(conn);
    const items = await cursor.toArray();
    return sortFamilyQuotes(items);
  },
  async createRevision(id) {
    const quote = await base.findById(id);
    if (!quote) return null;

    const family = await this.listFamilyMembers(id);
    const sameVariant = (family || []).filter((item) => Number(item.variantSequence || 1) === Number(quote.variantSequence || 1));
    const nextRevision = sameVariant.reduce((max, item) => Math.max(max, Number(item.revisionNumber || 1)), 0) + 1;

    return this.createQuote({
      ...cloneQuotePayload(quote),
      status: 'Draft',
      revisionNumber: nextRevision,
      variantSequence: Number(quote.variantSequence || 1),
      variantName: quote.variantName || 'Base',
      familyId: quote.familyId || quote.id,
      rootQuoteId: quote.rootQuoteId || quote.id,
      sourceQuoteId: quote.id
    });
  },
  async createVariant(id, { variantName } = {}) {
    const quote = await base.findById(id);
    if (!quote) return null;

    const family = await this.listFamilyMembers(id);
    const nextVariantSequence = (family || []).reduce((max, item) => Math.max(max, Number(item.variantSequence || 1)), 0) + 1;

    return this.createQuote({
      ...cloneQuotePayload(quote),
      status: 'Draft',
      revisionNumber: 1,
      variantSequence: nextVariantSequence,
      variantName: String(variantName || `Opcion ${nextVariantSequence}`).trim() || `Opcion ${nextVariantSequence}`,
      familyId: quote.familyId || quote.id,
      rootQuoteId: quote.rootQuoteId || quote.id,
      sourceQuoteId: quote.id
    });
  },
  async duplicate(id) {
    const quote = await base.findById(id);
    if (!quote) return null;

    return this.createQuote({
      ...cloneQuotePayload(quote),
      quoteNumber: `${quote.quoteNumber || 'QUOTE'}-COPY`,
      status: 'Draft',
      familyId: undefined,
      rootQuoteId: undefined,
      revisionNumber: 1,
      variantSequence: 1,
      variantName: 'Base',
      sourceQuoteId: id
    });
  }
};
