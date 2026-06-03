import { getConnection, r, dbConfig } from '../db/connection.js';
import { createRepository } from './baseRepository.js';

const base = createRepository('products');
const table = () => r.db(dbConfig.db).table('products');
let ensureIndexesPromise;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

async function ensureIndexes() {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const conn = await getConnection();
      const indexes = await table().indexList().run(conn);
      const definitions = [
        ['partNumberLower', r.row('partNumber').default('').coerceTo('string').downcase()],
        ['brandLower', r.row('brand').default('').coerceTo('string').downcase()],
        ['supplierLower', r.row('supplier').default('').coerceTo('string').downcase()],
        ['categoryLower', r.row('category').default('').coerceTo('string').downcase()]
      ];

      for (const [name, expression] of definitions) {
        if (!indexes.includes(name)) {
          await table().indexCreate(name, expression).run(conn);
        }
      }

      const updatedIndexes = await table().indexList().run(conn);
      for (const [name] of definitions) {
        if (updatedIndexes.includes(name)) {
          await table().indexWait(name).run(conn);
        }
      }
    })();
  }

  return ensureIndexesPromise;
}

async function queryPrefix(conn, index, term, limit) {
  const cursor = await table()
    .between(term, `${term}\uffff`, { index })
    .orderBy({ index })
    .limit(limit)
    .run(conn);
  return cursor.toArray();
}

function sortProducts(left, right) {
  return String(left.partNumber || '').localeCompare(String(right.partNumber || ''), undefined, { sensitivity: 'base' });
}

export const productRepository = {
  ...base,
  async assignProviderBySupplier(providerId, supplierName) {
    const conn = await getConnection();
    const normalizedSupplier = normalizeSearch(supplierName);
    const cursor = await table()
      .filter((row) => row('supplier').default('').coerceTo('string').downcase().eq(normalizedSupplier))
      .run(conn);
    const products = await cursor.toArray();
    let updated = 0;

    for (const product of products) {
      if (product.providerId === providerId) continue;
      await base.update(product.id, { providerId });
      updated += 1;
    }

    return { updated };
  },
  async listPaginated({ page = 1, pageSize = 50, search = '', supplier = '', category = '' } = {}) {
    await ensureIndexes();
    const conn = await getConnection();
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const start = (safePage - 1) * safePageSize;
    const term = normalizeSearch(search);
    const supplierTerm = normalizeSearch(supplier);
    const categoryTerm = normalizeSearch(category);
    const matchesHierarchy = (item) => {
      const supplierMatch = !supplierTerm || normalizeSearch(item.supplier) === supplierTerm;
      const categoryMatch = !categoryTerm || normalizeSearch(item.category) === categoryTerm;
      return supplierMatch && categoryMatch;
    };

    if (!term && !supplierTerm && !categoryTerm) {
      const total = await table().count().run(conn);
      const cursor = await table()
        .orderBy({ index: 'partNumberLower' })
        .slice(start, start + safePageSize)
        .run(conn);
      const items = await cursor.toArray();
      return { items, total, page: safePage, pageSize: safePageSize };
    }

    if (!term && (supplierTerm || categoryTerm)) {
      const cursor = await table()
        .orderBy({ index: 'partNumberLower' })
        .run(conn);
      const items = (await cursor.toArray()).filter(matchesHierarchy);
      return {
        items: items.slice(start, start + safePageSize),
        total: items.length,
        page: safePage,
        pageSize: safePageSize
      };
    }

    const fetchLimit = Math.min(600, safePageSize * Math.max(safePage, 1) + 120);
    const merged = new Map();
    const prefixQueries = [
      queryPrefix(conn, 'partNumberLower', term, fetchLimit),
      queryPrefix(conn, 'brandLower', term, fetchLimit),
      queryPrefix(conn, 'supplierLower', term, fetchLimit),
      queryPrefix(conn, 'categoryLower', term, fetchLimit)
    ];
    const prefixResults = await Promise.all(prefixQueries);

    for (const batch of prefixResults) {
      for (const item of batch) {
        if (matchesHierarchy(item) && !merged.has(item.id)) merged.set(item.id, item);
      }
    }

    if (!merged.size && term.length >= 3) {
      const pattern = `(?i)${escapeRegExp(search)}`;
      const cursor = await table()
        .filter((row) => row('description').default('').coerceTo('string').match(pattern))
        .limit(fetchLimit)
        .run(conn);
      const descriptionMatches = await cursor.toArray();
      for (const item of descriptionMatches) {
        if (matchesHierarchy(item) && !merged.has(item.id)) merged.set(item.id, item);
      }
    }

    const results = [...merged.values()].sort(sortProducts);
    return {
      items: results.slice(start, start + safePageSize),
      total: results.length,
      page: safePage,
      pageSize: safePageSize
    };
  },
  async getProviders() {
    const conn = await getConnection();
    const cursor = await table().pluck('supplier').run(conn);
    const items = await cursor.toArray();
    const supplierMap = new Map();

    for (const item of items) {
      const supplier = String(item.supplier || 'Sin proveedor').trim() || 'Sin proveedor';
      if (!supplierMap.has(supplier)) {
        supplierMap.set(supplier, { label: supplier, key: `supplier:${supplier}`, supplier, count: 0 });
      }
      supplierMap.get(supplier).count += 1;
    }

    return [...supplierMap.values()]
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  },
  async getCategoriesBySupplier(supplier) {
    await ensureIndexes();
    const conn = await getConnection();
    const normalizedSupplier = normalizeSearch(supplier);
    if (!normalizedSupplier) return [];

    const cursor = await table()
      .getAll(normalizedSupplier, { index: 'supplierLower' })
      .pluck('category')
      .run(conn);
    const items = await cursor.toArray();
    const categoryMap = new Map();

    for (const item of items) {
      const category = String(item.category || 'Sin categoria').trim() || 'Sin categoria';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          label: category,
          key: `category:${supplier}:${category}`,
          supplier,
          category,
          count: 0
        });
      }
      categoryMap.get(category).count += 1;
    }

    return [...categoryMap.values()]
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  },
  async upsertBySupplierPart(product) {
    const conn = await getConnection();
    const supplier = product.supplier || '';
    const partNumber = product.partNumber || '';
    const cursor = await table().filter({ supplier, partNumber }).limit(1).run(conn);
    const rows = await cursor.toArray();

    if (rows.length) {
      const existing = rows[0];
      const updated = await base.update(existing.id, product);
      return { action: 'updated', product: updated };
    }

    const created = await base.create(product);
    return { action: 'created', product: created };
  }
};
