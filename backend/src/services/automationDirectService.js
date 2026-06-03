const baseUrl = 'https://www.automationdirect.com/rest/v1/products';

export async function fetchAutomationDirectProduct(partNumber) {
  const cleanPartNumber = String(partNumber || '').trim();
  if (!cleanPartNumber) throw new Error('Part number is required');

  const response = await fetch(`${baseUrl}/${encodeURIComponent(cleanPartNumber)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Sistemas-Mecatronicos-Quoter/1.0'
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`AutomationDirect API returned ${response.status}`);
  return response.json();
}

export function mapAutomationDirectProduct(apiProduct) {
  if (!apiProduct) return null;
  const availability = apiProduct.availability || {};
  const pricing = apiProduct.pricing || {};
  const unitPrice = pricing.unit_price || {};

  return {
    partNumber: apiProduct.part_number || apiProduct.sku || apiProduct.id,
    description: apiProduct.description || apiProduct.name || '',
    brand: apiProduct.brand || 'AutomationDirect',
    category: apiProduct.category?.name || '',
    unitCost: Number(unitPrice.amount || 0),
    currency: unitPrice.currency || 'USD',
    availabilityStatus: availability.stock_status || '',
    availabilityNote: availability.shipping_note || '',
    leadTime: availability.shipping_note || availability.stock_status || '',
    status: apiProduct.status || '',
    weight: apiProduct.weight || null,
    lastAvailabilityCheckAt: new Date()
  };
}
