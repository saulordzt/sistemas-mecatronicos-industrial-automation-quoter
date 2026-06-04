import { customerRepository } from '../repositories/customerRepository.js';
import { projectRepository } from '../repositories/projectRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { serviceRateRepository } from '../repositories/serviceRateRepository.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const SERVICE_TYPES = [
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
const COMPLEXITY_LEVELS = ['low', 'medium', 'high'];
const RISK_LEVELS = ['low', 'medium', 'high'];

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function sanitizeText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeServiceType(value) {
  const normalized = sanitizeText(value, 120).toLowerCase();
  const match = SERVICE_TYPES.find((item) => item.toLowerCase() === normalized);
  if (match) return match;

  const aliases = [
    ['programacion plc', 'Programacion PLC'],
    ['plc programming', 'Programacion PLC'],
    ['programacion hmi', 'Programacion HMI'],
    ['hmi programming', 'Programacion HMI'],
    ['diseno electrico', 'Diseno electrico'],
    ['electrical design', 'Diseno electrico'],
    ['armado de tablero', 'Armado de tablero'],
    ['panel assembly', 'Armado de tablero'],
    ['instalacion en campo', 'Instalacion en campo'],
    ['field installation', 'Instalacion en campo'],
    ['puesta en marcha', 'Puesta en marcha'],
    ['commissioning', 'Puesta en marcha'],
    ['diagnostico de fallas', 'Diagnostico de fallas'],
    ['troubleshooting', 'Diagnostico de fallas'],
    ['soporte remoto', 'Soporte remoto'],
    ['remote support', 'Soporte remoto'],
    ['gestion de proyecto', 'Gestion de proyecto'],
    ['project management', 'Gestion de proyecto'],
    ['documentacion', 'Documentacion'],
    ['documentation', 'Documentacion']
  ];

  const alias = aliases.find(([key]) => key === normalized);
  return alias ? alias[1] : '';
}

function tokenizeText(value) {
  return sanitizeText(value, 3000)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function buildSearchTerms({ brief, quote, project, wizard }) {
  const baseTokens = tokenizeText([
    brief,
    quote?.scopeOfWork,
    project?.projectName,
    project?.projectType,
    project?.description,
    project?.industry
  ].filter(Boolean).join(' '));

  const stopWords = new Set(['para', 'with', 'from', 'that', 'this', 'automatizacion', 'automation', 'industrial', 'proyecto', 'project', 'cliente', 'client', 'sistema', 'system']);
  const scores = new Map();
  for (const token of baseTokens) {
    if (stopWords.has(token)) continue;
    scores.set(token, (scores.get(token) || 0) + 1);
  }

  const prioritized = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([token]) => token);

  if (wizard?.plcRequired) prioritized.push('PLC', 'Do-more', 'Productivity');
  if (wizard?.hmiRequired) prioritized.push('HMI', 'C-more');
  if (wizard?.electricalPanelRequired) prioritized.push('panel', 'enclosure', 'breaker');
  if ((Number(wizard?.digitalInputs || 0) + Number(wizard?.analogInputs || 0)) > 0) prioritized.push('input');
  if ((Number(wizard?.digitalOutputs || 0) + Number(wizard?.analogOutputs || 0)) > 0) prioritized.push('output');

  return [...new Set(prioritized)].slice(0, 10);
}

async function loadCatalogCandidates(context) {
  const terms = buildSearchTerms(context);
  if (!terms.length) {
    const fallback = await productRepository.listPaginated({ page: 1, pageSize: 25, search: '' });
    return (fallback.items || []).filter((item) => item.active !== false).slice(0, 25);
  }

  const responses = await Promise.all(terms.map((term) => productRepository.listPaginated({ page: 1, pageSize: 15, search: term })));
  const merged = new Map();
  for (const response of responses) {
    for (const item of response.items || []) {
      if (item.active === false) continue;
      if (!merged.has(item.id)) merged.set(item.id, item);
      if (merged.size >= 40) break;
    }
    if (merged.size >= 40) break;
  }
  return [...merged.values()];
}

function buildPrompt({ brief, quote, customer, project, wizard, serviceRates, candidateProducts }) {
  return [
    'Eres un ingeniero senior de automatizacion industrial que ayuda a preparar una cotizacion preliminar.',
    'Devuelve solo JSON valido. No uses markdown. No agregues texto fuera del JSON.',
    'No inventes numeros de parte. Solo puedes sugerir materiales que existan en candidateProducts.',
    'No incluyas margenes, markup, utilidad, costo directo ni totales finales.',
    'Usa exclusivamente estos tipos de servicio cuando propongas servicios:',
    JSON.stringify(SERVICE_TYPES),
    'Respuesta JSON requerida con esta estructura:',
    JSON.stringify({
      wizard: {
        digitalInputs: 0,
        digitalOutputs: 0,
        analogInputs: 0,
        analogOutputs: 0,
        plcRequired: true,
        hmiRequired: false,
        electricalPanelRequired: false,
        installationRequired: false,
        commissioningRequired: false,
        complexityLevel: 'medium',
        riskLevel: 'low'
      },
      scopeOfWork: '',
      exclusions: '',
      notes: '',
      services: [{ serviceType: 'Programacion PLC', description: '', hours: 8, hourlyRate: 1710, reason: '' }],
      materials: [{ partNumber: '', description: '', quantity: 1, reason: '' }],
      assumptions: [''],
      warnings: ['']
    }),
    'Contexto del cliente/proyecto/quote actual:',
    JSON.stringify({
      brief: sanitizeText(brief, 4000),
      quote: {
        customerId: quote?.customerId || '',
        projectId: quote?.projectId || '',
        currency: quote?.commercial?.currency || 'MXN',
        paymentTerms: quote?.commercial?.paymentTerms || '',
        deliveryTime: quote?.commercial?.deliveryTime || '',
        quoteValidityDays: quote?.commercial?.quoteValidityDays || '',
        scopeOfWork: quote?.scopeOfWork || '',
        exclusions: quote?.exclusions || '',
        notes: quote?.notes || ''
      },
      customer: customer ? (() => {
        const normalizedCustomer = normalizeCustomer(customer);
        return {
          companyName: normalizedCustomer.companyName,
          primaryContactName: normalizedCustomer.primaryContact?.name || '',
          address: normalizedCustomer.address,
          notes: normalizedCustomer.notes
        };
      })() : null,
      project: project ? {
        projectName: project.projectName,
        projectType: project.projectType,
        industry: project.industry,
        location: project.location,
        description: project.description,
        status: project.status
      } : null,
      wizard,
      serviceRates: serviceRates.map((rate) => ({
        serviceType: rate.serviceType,
        hourlyRate: rate.hourlyRate,
        currency: rate.currency,
        description: rate.description
      })),
      candidateProducts: candidateProducts.map((product) => ({
        partNumber: product.partNumber,
        description: product.description,
        brand: product.brand,
        supplier: product.supplier,
        category: product.category,
        unitCost: product.unitCost,
        currency: product.currency,
        notes: product.notes
      }))
    })
  ].join('\n');
}

async function callOpenAi(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente de preingenieria para cotizaciones de automatizacion industrial. Responde solo JSON valido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('OpenAI returned an empty response');
    error.statusCode = 502;
    throw error;
  }

  return JSON.parse(content);
}

function normalizeWizard(input = {}) {
  return {
    digitalInputs: clampNumber(input.digitalInputs, { min: 0, max: 100000, fallback: 0 }),
    digitalOutputs: clampNumber(input.digitalOutputs, { min: 0, max: 100000, fallback: 0 }),
    analogInputs: clampNumber(input.analogInputs, { min: 0, max: 100000, fallback: 0 }),
    analogOutputs: clampNumber(input.analogOutputs, { min: 0, max: 100000, fallback: 0 }),
    plcRequired: Boolean(input.plcRequired),
    hmiRequired: Boolean(input.hmiRequired),
    electricalPanelRequired: Boolean(input.electricalPanelRequired),
    installationRequired: Boolean(input.installationRequired),
    commissioningRequired: Boolean(input.commissioningRequired),
    complexityLevel: normalizeEnum(input.complexityLevel, COMPLEXITY_LEVELS, 'medium'),
    riskLevel: normalizeEnum(input.riskLevel, RISK_LEVELS, 'low')
  };
}

function normalizeServices(services = [], serviceRates = []) {
  const rateMap = new Map(serviceRates.map((rate) => [rate.serviceType, rate]));
  const normalized = [];
  const warnings = [];

  for (const item of Array.isArray(services) ? services : []) {
    const serviceType = normalizeServiceType(item?.serviceType);
    if (!serviceType) {
      warnings.push(`Se omitio un servicio con tipo no reconocido: ${sanitizeText(item?.serviceType, 120) || 'sin tipo'}.`);
      continue;
    }

    const rate = rateMap.get(serviceType);
    normalized.push({
      serviceType,
      description: sanitizeText(item?.description, 500),
      hours: clampNumber(item?.hours, { min: 0, max: 10000, fallback: 0 }),
      hourlyRate: clampNumber(item?.hourlyRate, { min: 0, max: 1000000, fallback: Number(rate?.hourlyRate || 0) }),
      reason: sanitizeText(item?.reason, 500),
      notes: sanitizeText(item?.notes, 500)
    });
  }

  return { services: normalized, warnings };
}

function normalizeMaterials(materials = [], candidateProducts = []) {
  const productMap = new Map(candidateProducts.map((product) => [String(product.partNumber || '').toLowerCase(), product]));
  const normalized = [];
  const warnings = [];

  for (const item of Array.isArray(materials) ? materials : []) {
    const requestedPart = sanitizeText(item?.partNumber, 120);
    const product = productMap.get(requestedPart.toLowerCase());
    if (!product) {
      if (requestedPart) warnings.push(`Se omitio el material ${requestedPart} porque no existe en el catalogo filtrado.`);
      continue;
    }

    normalized.push({
      partNumber: product.partNumber,
      description: product.description,
      brand: product.brand,
      supplier: product.supplier,
      quantity: clampNumber(item?.quantity, { min: 1, max: 100000, fallback: 1 }),
      reason: sanitizeText(item?.reason, 500),
      sourceProduct: product
    });
  }

  return { materials: normalized, warnings };
}

function normalizePreview(raw, serviceRates, candidateProducts) {
  const { services, warnings: serviceWarnings } = normalizeServices(raw?.services, serviceRates);
  const { materials, warnings: materialWarnings } = normalizeMaterials(raw?.materials, candidateProducts);

  return {
    wizard: normalizeWizard(raw?.wizard),
    scopeOfWork: sanitizeText(raw?.scopeOfWork, 5000),
    exclusions: sanitizeText(raw?.exclusions, 4000),
    notes: sanitizeText(raw?.notes, 4000),
    services,
    materials,
    assumptions: (Array.isArray(raw?.assumptions) ? raw.assumptions : []).map((item) => sanitizeText(item, 500)).filter(Boolean),
    warnings: [
      ...(Array.isArray(raw?.warnings) ? raw.warnings : []).map((item) => sanitizeText(item, 500)).filter(Boolean),
      ...serviceWarnings,
      ...materialWarnings
    ]
  };
}

export async function generateQuoteAssistantPreview({ brief, quote = {}, wizard = {} }) {
  const safeBrief = sanitizeText(brief, 4000);
  if (!safeBrief) {
    const error = new Error('Project brief is required');
    error.statusCode = 400;
    throw error;
  }

  const [customer, project, serviceRates] = await Promise.all([
    quote?.customerId ? customerRepository.findById(quote.customerId) : Promise.resolve(null),
    quote?.projectId ? projectRepository.findById(quote.projectId) : Promise.resolve(null),
    serviceRateRepository.list()
  ]);

  const normalizedWizard = normalizeWizard(wizard);
  const candidateProducts = await loadCatalogCandidates({ brief: safeBrief, quote, project, wizard: normalizedWizard });
  const prompt = buildPrompt({
    brief: safeBrief,
    quote,
    customer,
    project,
    wizard: normalizedWizard,
    serviceRates,
    candidateProducts
  });

  const raw = await callOpenAi(prompt);
  return {
    preview: normalizePreview(raw, serviceRates, candidateProducts)
  };
}
import { normalizeCustomer } from '../utils/customerContacts.js';
