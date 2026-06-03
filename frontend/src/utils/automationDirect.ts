export function isAutomationDirectProduct(product: { supplier?: string; partNumber?: string }) {
  return Boolean(product.partNumber) && String(product.supplier || '').trim().toLowerCase() === 'automationdirect';
}

export function buildAutomationDirectProductUrl(partNumber: string) {
  const normalizedPartNumber = encodeURIComponent(String(partNumber || '').trim());
  return `https://www.automationdirect.com/adc/shopping/catalog/${normalizedPartNumber}`;
}

export function openAutomationDirectProduct(product: { supplier?: string; partNumber?: string }) {
  if (!isAutomationDirectProduct(product)) return;
  window.open(buildAutomationDirectProductUrl(String(product.partNumber || '')), '_blank', 'noopener,noreferrer');
}
