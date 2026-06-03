import * as XLSX from 'xlsx';
import { productRepository } from '../repositories/productRepository.js';
import { providerRepository } from '../repositories/providerRepository.js';

const fieldAliases = {
  partNumber: ['partNumber', 'part number', 'part_number', 'part', 'sku', 'catalog'],
  description: ['description', 'desc'],
  brand: ['brand', 'manufacturer', 'make'],
  supplier: ['supplier', 'vendor'],
  category: ['category', 'type'],
  unitCost: ['unitCost', 'unit cost', 'unit_cost', 'cost', 'price'],
  currency: ['currency', 'moneda'],
  stock: ['stock', 'inventory', 'qty available'],
  leadTime: ['leadTime', 'lead time', 'lead_time'],
  datasheetUrl: ['datasheetUrl', 'datasheet url', 'datasheet_url', 'datasheet'],
  notes: ['notes', 'note']
};

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase();
}

function readAliased(row, field) {
  const aliases = fieldAliases[field].map(normalizeKey);
  const match = Object.keys(row).find((key) => aliases.includes(normalizeKey(key)));
  return match ? row[match] : undefined;
}

async function normalizeProduct(row, rowNumber) {
  const partNumber = String(readAliased(row, 'partNumber') || '').trim();
  const supplier = String(readAliased(row, 'supplier') || '').trim() || 'Unknown';
  const unitCostRaw = readAliased(row, 'unitCost');
  const unitCost = unitCostRaw === undefined || unitCostRaw === '' ? 0 : Number(unitCostRaw);
  const stockRaw = readAliased(row, 'stock');
  const provider = supplier ? await providerRepository.findByCompanyName(supplier) : null;

  const errors = [];
  if (!partNumber) errors.push('Missing part number');
  if (Number.isNaN(unitCost)) errors.push('Invalid unit cost');

  return {
    rowNumber,
    errors,
    product: {
      partNumber,
      description: String(readAliased(row, 'description') || '').trim(),
      brand: String(readAliased(row, 'brand') || '').trim(),
      supplier,
      providerId: provider?.id || null,
      category: String(readAliased(row, 'category') || '').trim(),
      unitCost: Number.isNaN(unitCost) ? 0 : unitCost,
      currency: String(readAliased(row, 'currency') || 'USD').trim().toUpperCase(),
      stock: stockRaw === undefined || stockRaw === '' ? null : Number(stockRaw),
      leadTime: String(readAliased(row, 'leadTime') || '').trim(),
      datasheetUrl: String(readAliased(row, 'datasheetUrl') || '').trim(),
      notes: String(readAliased(row, 'notes') || '').trim(),
      active: true
    }
  };
}

export async function importProductsFromXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet] || {}, { defval: '' });
  const summary = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const [index, row] of rows.entries()) {
    const normalized = await normalizeProduct(row, index + 2);
    if (normalized.errors.length) {
      summary.skipped += 1;
      summary.errors.push({ row: normalized.rowNumber, errors: normalized.errors });
      continue;
    }

    const result = await productRepository.upsertBySupplierPart(normalized.product);
    summary[result.action] += 1;
  }

  return summary;
}
