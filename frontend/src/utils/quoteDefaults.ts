import type { Quote } from '../types';

export const serviceTypes = [
  'Programacion PLC',
  'Programacion HMI',
  'Diseno electrico',
  'Armado de tablero',
  'Instalacion en campo',
  'Puesta en marcha',
  'Diagnostico de fallas',
  'Soporte remoto',
  'Gestion de proyecto',
  'Documentacion'
];

export const quoteStatuses = ['Draft', 'Sent', 'Approved', 'Rejected', 'Cancelled'];
export const quoteStatusLabels: Record<string, string> = {
  Draft: 'Borrador',
  Sent: 'Enviada',
  Approved: 'Aprobada',
  Rejected: 'Rechazada',
  Cancelled: 'Cancelada'
};

export function createEmptyQuote(): Quote {
  return {
    quoteNumber: `Q-${new Date().toISOString().slice(0, 10).split('-').join('')}-${Date.now().toString().slice(-4)}`,
    status: 'Draft',
    revisionNumber: 1,
    variantSequence: 1,
    variantName: 'Base',
    customerId: '',
    recipientContactId: null,
    projectId: '',
    scopeOfWork: '',
    exclusions: 'Obra civil, permisos, paros de servicios y elementos no listados explicitamente estan excluidos.',
    notes: '',
    materials: [],
    services: [],
    commercial: {
      materialMarkupPercentage: 50,
      laborMarkupPercentage: 15,
      contingencyPercentage: 5,
      discountPercentage: 0,
      taxPercentage: 16,
      currency: 'MXN',
      usdToMxnRate: 18,
      paymentTerms: '50% anticipo, 40% antes de entrega, 10% despues de puesta en marcha',
      deliveryTime: '4 a 6 semanas despues de orden de compra y anticipo',
      quoteValidityDays: 15
    },
    totals: {
      materialsSubtotal: 0,
      laborSubtotal: 0,
      directCost: 0,
      markup: 0,
      contingency: 0,
      discount: 0,
      tax: 0,
      finalTotal: 0
    }
  };
}
