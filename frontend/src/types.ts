export type Currency = 'MXN' | 'USD';
export type QuoteStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Cancelled';

export interface CustomerContact {
  id?: string;
  name: string;
  email: string;
  phone: string;
  title?: string;
  notes?: string;
  isPrimary?: boolean;
}

export interface Customer {
  id?: string;
  companyName: string;
  contacts: CustomerContact[];
  primaryContactId?: string | null;
  primaryContact?: CustomerContact | null;
  contactName?: string;
  email?: string;
  phone?: string;
  address: string;
  taxId: string;
  notes: string;
}

export interface Project {
  id?: string;
  customerId: string;
  projectName: string;
  projectType: string;
  industry: string;
  location: string;
  description: string;
  status: string;
  createdDate: string;
}

export interface MaterialItem {
  partNumber: string;
  description: string;
  brand: string;
  supplier: string;
  providerId?: string | null;
  quantity: number;
  unitCost: number;
  markupPercentage: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  sourceCurrency?: Currency;
  sourceUnitCost?: number;
  exchangeRateApplied?: number;
}

export interface ServiceItem {
  serviceType: string;
  description: string;
  hours: number;
  hourlyRate: number;
  total: number;
  notes: string;
}

export interface CommercialSettings {
  materialMarkupPercentage: number;
  laborMarkupPercentage: number;
  contingencyPercentage: number;
  discountPercentage: number;
  taxPercentage: number;
  currency: Currency;
  usdToMxnRate?: number;
  paymentTerms: string;
  deliveryTime: string;
  quoteValidityDays: number;
}

export interface QuoteTotals {
  materialsSubtotal: number;
  laborSubtotal: number;
  directCost: number;
  markup: number;
  contingency: number;
  discount: number;
  tax: number;
  finalTotal: number;
}

export interface Quote {
  id?: string;
  quoteNumber: string;
  status: QuoteStatus;
  familyId?: string;
  rootQuoteId?: string;
  sourceQuoteId?: string | null;
  revisionNumber?: number;
  variantSequence?: number;
  variantName?: string;
  customerId: string;
  projectId: string;
  customerSnapshot?: Customer;
  recipientContactId?: string | null;
  projectSnapshot?: Project;
  scopeOfWork: string;
  exclusions: string;
  notes: string;
  materials: MaterialItem[];
  services: ServiceItem[];
  commercial: CommercialSettings;
  totals: QuoteTotals;
  wizard?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  clientPdfDownloadCount?: number;
  lastClientPdfDownloadAt?: string;
  clientEmailSendCount?: number;
  lastClientEmailSentAt?: string;
  lastClientEmailRecipients?: Array<{ id?: string; name: string; email: string }>;
}


export interface Product {
  id?: string;
  partNumber: string;
  description: string;
  brand: string;
  supplier: string;
  providerId?: string | null;
  category: string;
  unitCost: number;
  currency: Currency;
  stock: number | null;
  leadTime: string;
  availability?: string;
  availabilityStatus?: string;
  availabilityNote?: string;
  automationDirectStatus?: string;
  lastAvailabilityCheckAt?: string;
  datasheetUrl: string;
  notes: string;
  active: boolean;
}

export interface ServiceRate {
  id?: string;
  serviceType: string;
  description: string;
  hourlyRate: number;
  currency: Currency;
  active: boolean;
}

export interface Provider {
  id?: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  address?: string;
  website?: string;
  taxId?: string;
  notes?: string;
  active: boolean;
}

export interface QuoteAssistantWizard {
  digitalInputs: number;
  digitalOutputs: number;
  analogInputs: number;
  analogOutputs: number;
  plcRequired: boolean;
  hmiRequired: boolean;
  electricalPanelRequired: boolean;
  installationRequired: boolean;
  commissioningRequired: boolean;
  complexityLevel: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface QuoteAssistantPreviewService {
  serviceType: string;
  description: string;
  hours: number;
  hourlyRate: number;
  reason?: string;
  notes?: string;
}

export interface QuoteAssistantPreviewMaterial {
  partNumber: string;
  description: string;
  brand: string;
  supplier: string;
  quantity: number;
  reason?: string;
  sourceProduct?: Product;
}

export interface QuoteAssistantPreview {
  wizard: QuoteAssistantWizard;
  scopeOfWork: string;
  exclusions: string;
  notes: string;
  services: QuoteAssistantPreviewService[];
  materials: QuoteAssistantPreviewMaterial[];
  assumptions: string[];
  warnings: string[];
}
