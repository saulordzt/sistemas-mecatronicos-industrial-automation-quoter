import type { CommercialSettings, MaterialItem, QuoteTotals, ServiceItem } from '../types';

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function updateMaterialTotals(item: MaterialItem, defaultMarkup = 0): MaterialItem {
  const markup = Number(item.markupPercentage ?? defaultMarkup);
  const unitPrice = roundMoney(Number(item.unitCost || 0) * (1 + markup / 100));
  return {
    ...item,
    markupPercentage: markup,
    unitPrice,
    totalPrice: roundMoney(unitPrice * Number(item.quantity || 0))
  };
}

export function updateServiceTotals(item: ServiceItem): ServiceItem {
  return {
    ...item,
    total: roundMoney(Number(item.hours || 0) * Number(item.hourlyRate || 0))
  };
}

export function getRiskContingencySuggestion(riskLevel: string) {
  if (riskLevel === 'high') return 20;
  if (riskLevel === 'medium') return 10;
  return 5;
}

export function calculateQuoteTotals(
  materials: MaterialItem[],
  services: ServiceItem[],
  commercial: CommercialSettings
): QuoteTotals {
  const materialsSubtotal = roundMoney(materials.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0));
  const laborCost = services.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const laborSubtotal = roundMoney(laborCost * (1 + Number(commercial.laborMarkupPercentage || 0) / 100));
  const directCost = roundMoney(materialsSubtotal + laborSubtotal);
  const markup = roundMoney(
    materials.reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 0) * Number(item.markupPercentage || 0) / 100, 0) +
      laborCost * Number(commercial.laborMarkupPercentage || 0) / 100
  );
  const contingency = roundMoney(directCost * Number(commercial.contingencyPercentage || 0) / 100);
  const discount = roundMoney((directCost + contingency) * Number(commercial.discountPercentage || 0) / 100);
  const taxable = roundMoney(directCost + contingency - discount);
  const tax = roundMoney(taxable * Number(commercial.taxPercentage || 0) / 100);

  return {
    materialsSubtotal,
    laborSubtotal,
    directCost,
    markup,
    contingency,
    discount,
    tax,
    finalTotal: roundMoney(taxable + tax)
  };
}
