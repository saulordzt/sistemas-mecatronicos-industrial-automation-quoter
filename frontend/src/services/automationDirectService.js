import { productsApi } from './api';

export async function searchProductByPartNumber(partNumber) {
  return {
    partNumber,
    source: 'AutomationDirect',
    status: 'not_implemented',
    message: 'Placeholder for future AutomationDirect Product API lookup. Use the product catalog XLSX import for Phase 2.'
  };
}

export async function getProductPrice(partNumber) {
  return {
    partNumber,
    price: null,
    currency: null,
    status: 'not_implemented'
  };
}

export async function getProductStock(partNumber) {
  return {
    partNumber,
    stock: null,
    status: 'not_implemented'
  };
}

export async function importPriceListFromXlsx(file) {
  return productsApi.importXlsx(file);
}
