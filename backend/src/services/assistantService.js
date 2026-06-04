import { PDFParse } from 'pdf-parse';
import { assistantAttachmentRepository } from '../repositories/assistantAttachmentRepository.js';
import { assistantMessageRepository } from '../repositories/assistantMessageRepository.js';
import { assistantSessionRepository } from '../repositories/assistantSessionRepository.js';
import { assistantActionRepository } from '../repositories/assistantActionRepository.js';
import { customerRepository } from '../repositories/customerRepository.js';
import { projectRepository } from '../repositories/projectRepository.js';
import { quoteRepository } from '../repositories/quoteRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { serviceRateRepository } from '../repositories/serviceRateRepository.js';
import { readAssistantFile } from '../utils/assistantStorage.js';
import { normalizeCustomer } from '../utils/customerContacts.js';
import { calculateQuoteTotals, updateMaterialTotals, updateServiceTotals } from '../utils/quoteCalculations.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_AUDIO_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const DEFAULT_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
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
const PROJECT_TYPES = ['PLC programming', 'HMI development', 'Electrical panel', 'Retrofit', 'Machine automation', 'Troubleshooting', 'Integration project'];
const PROJECT_TYPE_ALIASES = {
  'programacion plc': 'PLC programming',
  'plc programming': 'PLC programming',
  'desarrollo hmi': 'HMI development',
  'programacion hmi': 'HMI development',
  'hmi development': 'HMI development',
  'tablero electrico': 'Electrical panel',
  'electrical panel': 'Electrical panel',
  retrofit: 'Retrofit',
  'automatizacion de maquina': 'Machine automation',
  'machine automation': 'Machine automation',
  troubleshooting: 'Troubleshooting',
  'diagnostico de fallas': 'Troubleshooting',
  'integration project': 'Integration project',
  integracion: 'Integration project'
};

function sanitizeText(value, maxLength = 5000) {
  return String(value || '').trim().slice(0, maxLength);
}

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeServiceType(value) {
  const normalized = sanitizeText(value, 120).toLowerCase();
  const exact = SERVICE_TYPES.find((item) => item.toLowerCase() === normalized);
  if (exact) return exact;
  const aliasMap = {
    'plc programming': 'Programacion PLC',
    'programacion plc': 'Programacion PLC',
    'hmi programming': 'Programacion HMI',
    'programacion hmi': 'Programacion HMI',
    'electrical design': 'Diseno electrico',
    'diseno electrico': 'Diseno electrico',
    'panel assembly': 'Armado de tablero',
    'armado de tablero': 'Armado de tablero',
    'field installation': 'Instalacion en campo',
    'instalacion en campo': 'Instalacion en campo',
    commissioning: 'Puesta en marcha',
    'puesta en marcha': 'Puesta en marcha',
    troubleshooting: 'Diagnostico de fallas',
    'diagnostico de fallas': 'Diagnostico de fallas',
    'remote support': 'Soporte remoto',
    'soporte remoto': 'Soporte remoto',
    'project management': 'Gestion de proyecto',
    'gestion de proyecto': 'Gestion de proyecto',
    documentation: 'Documentacion',
    documentacion: 'Documentacion'
  };
  return aliasMap[normalized] || '';
}

function normalizeProjectType(value) {
  const normalized = sanitizeText(value, 120).toLowerCase();
  return PROJECT_TYPE_ALIASES[normalized] || 'Integration project';
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
    complexityLevel: normalizeEnum(input.complexityLevel, ['low', 'medium', 'high'], 'medium'),
    riskLevel: normalizeEnum(input.riskLevel, ['low', 'medium', 'high'], 'low')
  };
}

function buildSearchTerms(text) {
  return sanitizeText(text, 3000)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

async function loadCatalogCandidates(text) {
  const terms = buildSearchTerms(text);
  if (!terms.length) {
    const fallback = await productRepository.listPaginated({ page: 1, pageSize: 20, search: '' });
    return (fallback.items || []).filter((item) => item.active !== false).slice(0, 20);
  }

  const responses = await Promise.all(terms.map((term) => productRepository.listPaginated({ page: 1, pageSize: 12, search: term })));
  const merged = new Map();
  for (const response of responses) {
    for (const item of response.items || []) {
      if (item.active === false) continue;
      merged.set(item.id || `${item.supplier}-${item.partNumber}`, item);
      if (merged.size >= 30) break;
    }
    if (merged.size >= 30) break;
  }
  return [...merged.values()];
}

async function callOpenAiJson(messages) {
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
      messages
    }),
    signal: AbortSignal.timeout(45000)
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

async function transcribeAudio(buffer, mimeType, filename) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.statusCode = 503;
    throw error;
  }

  const form = new FormData();
  form.append('model', DEFAULT_TRANSCRIPTION_MODEL);
  form.append('language', 'es');
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/mpeg' }), filename || 'audio.mp3');

  const response = await fetch(OPENAI_AUDIO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form,
    signal: AbortSignal.timeout(45000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI transcription failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }
  return sanitizeText(payload?.text, 12000);
}

async function describeImage(buffer, mimeType, filename) {
  const dataUrl = `data:${mimeType || 'image/png'};base64,${buffer.toString('base64')}`;
  const raw = await callOpenAiJson([
    {
      role: 'system',
      content: 'Eres un asistente para extraer informacion de imagenes de proyectos de automatizacion industrial. Responde solo JSON valido.'
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe brevemente la imagen, extrae numeros de parte, etiquetas, marcas, cantidades, y cualquier dato util para una cotizacion. Devuelve JSON con {summary, extractedText, partNumbers, warnings}.' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ]);
  return {
    summary: sanitizeText(raw?.summary || `Imagen procesada: ${filename}`, 4000),
    extractedText: sanitizeText(raw?.extractedText || '', 8000),
    partNumbers: Array.isArray(raw?.partNumbers) ? raw.partNumbers.map((item) => sanitizeText(item, 120)).filter(Boolean) : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item) => sanitizeText(item, 240)).filter(Boolean) : []
  };
}

async function extractPdf(buffer, filename) {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return {
      summary: `PDF procesado: ${filename}`,
      extractedText: sanitizeText(parsed?.text, 24000),
      partNumbers: [],
      warnings: []
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function emptyQuoteDraft() {
  return {
    quoteNumber: `Q-AI-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-4)}`,
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

function normalizeMaterials(materials = [], candidateProducts = [], defaultMarkup = 50) {
  const productMap = new Map(candidateProducts.map((product) => [String(product.partNumber || '').toLowerCase(), product]));
  const warnings = [];
  const normalized = [];
  for (const item of Array.isArray(materials) ? materials : []) {
    const requestedPart = sanitizeText(item?.partNumber, 120);
    const product = requestedPart ? productMap.get(requestedPart.toLowerCase()) : null;
    if (product) {
      normalized.push(updateMaterialTotals({
        partNumber: product.partNumber,
        description: product.description,
        brand: product.brand,
        supplier: product.supplier,
        providerId: product.providerId || null,
        quantity: clampNumber(item?.quantity, { min: 1, max: 100000, fallback: 1 }),
        unitCost: clampNumber(product.unitCost, { min: 0, max: 100000000, fallback: 0 }),
        markupPercentage: defaultMarkup,
        unitPrice: 0,
        totalPrice: 0,
        notes: sanitizeText(item?.reason || product.notes, 500),
        sourceCurrency: product.currency,
        sourceUnitCost: product.unitCost
      }, defaultMarkup));
      continue;
    }
    normalized.push(updateMaterialTotals({
      partNumber: requestedPart,
      description: sanitizeText(item?.description, 500),
      brand: sanitizeText(item?.brand, 120),
      supplier: sanitizeText(item?.supplier, 120),
      providerId: null,
      quantity: clampNumber(item?.quantity, { min: 1, max: 100000, fallback: 1 }),
      unitCost: clampNumber(item?.unitCost, { min: 0, max: 100000000, fallback: 0 }),
      markupPercentage: defaultMarkup,
      unitPrice: 0,
      totalPrice: 0,
      notes: sanitizeText(item?.reason || item?.notes, 500)
    }, defaultMarkup));
    if (!requestedPart && !item?.description) warnings.push('Se omitio un material vacio.');
  }
  return {
    materials: normalized.filter((item) => item.partNumber || item.description),
    warnings
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
    normalized.push(updateServiceTotals({
      serviceType,
      description: sanitizeText(item?.description, 500),
      hours: clampNumber(item?.hours, { min: 0, max: 10000, fallback: 0 }),
      hourlyRate: clampNumber(item?.hourlyRate, { min: 0, max: 1000000, fallback: Number(rate?.hourlyRate || 0) }),
      total: 0,
      notes: sanitizeText(item?.notes || item?.reason, 500)
    }));
  }
  return { services: normalized, warnings };
}

function normalizeAssistantResult(raw = {}, serviceRates = [], candidateProducts = [], commercial = {}) {
  const { services, warnings: serviceWarnings } = normalizeServices(raw?.quote?.services, serviceRates);
  const { materials, warnings: materialWarnings } = normalizeMaterials(raw?.quote?.materials, candidateProducts, Number(commercial.materialMarkupPercentage || 50));
  return {
    reply: sanitizeText(raw?.reply, 4000),
    customer: {
      companyName: sanitizeText(raw?.customer?.companyName, 240),
      contactName: sanitizeText(raw?.customer?.contactName, 240),
      email: sanitizeText(raw?.customer?.email, 240).toLowerCase(),
      phone: sanitizeText(raw?.customer?.phone, 120),
      address: sanitizeText(raw?.customer?.address, 500),
      taxId: sanitizeText(raw?.customer?.taxId, 120),
      notes: sanitizeText(raw?.customer?.notes, 500)
    },
    project: {
      projectName: sanitizeText(raw?.project?.projectName, 240),
      projectType: normalizeProjectType(raw?.project?.projectType),
      industry: sanitizeText(raw?.project?.industry, 240),
      location: sanitizeText(raw?.project?.location, 240),
      description: sanitizeText(raw?.project?.description, 1000),
      status: sanitizeText(raw?.project?.status, 120) || 'Nuevo'
    },
    quote: {
      wizard: normalizeWizard(raw?.quote?.wizard),
      scopeOfWork: sanitizeText(raw?.quote?.scopeOfWork, 6000),
      exclusions: sanitizeText(raw?.quote?.exclusions, 4000),
      notes: sanitizeText(raw?.quote?.notes, 4000),
      services,
      materials,
      assumptions: (Array.isArray(raw?.quote?.assumptions) ? raw.quote.assumptions : []).map((item) => sanitizeText(item, 500)).filter(Boolean),
      warnings: [
        ...(Array.isArray(raw?.quote?.warnings) ? raw.quote.warnings : []).map((item) => sanitizeText(item, 500)).filter(Boolean),
        ...serviceWarnings,
        ...materialWarnings
      ]
    }
  };
}

async function extractAttachment(attachment) {
  const buffer = await readAssistantFile(attachment.storagePath);
  const mimeType = String(attachment.mimeType || '').toLowerCase();
  if (mimeType.startsWith('text/') || attachment.originalName?.toLowerCase().endsWith('.txt')) {
    const text = sanitizeText(buffer.toString('utf-8'), 24000);
    return {
      summary: `Texto cargado: ${attachment.originalName}`,
      extractedText: text,
      partNumbers: [],
      warnings: []
    };
  }
  if (mimeType.includes('pdf')) return extractPdf(buffer, attachment.originalName);
  if (mimeType.startsWith('image/')) return describeImage(buffer, mimeType, attachment.originalName);
  if (mimeType.startsWith('audio/')) {
    const transcript = await transcribeAudio(buffer, mimeType, attachment.originalName);
    return {
      summary: `Audio transcrito: ${attachment.originalName}`,
      extractedText: transcript,
      partNumbers: [],
      warnings: []
    };
  }
  return {
    summary: `Archivo cargado: ${attachment.originalName}`,
    extractedText: '',
    partNumbers: [],
    warnings: [`Tipo de archivo no procesado automaticamente: ${attachment.mimeType || 'desconocido'}`]
  };
}

function buildAssistantPrompt({ messages, attachments, candidateProducts, serviceRates, currentDraft }) {
  return [
    'Eres un asistente de ventas e ingenieria para cotizaciones de automatizacion industrial.',
    'Responde solo JSON valido.',
    'Idioma principal: espanol.',
    'Tu trabajo es interpretar la conversacion y los archivos del cliente para poblar una cotizacion borrador.',
    'Si faltan datos, infiere solo lo razonable y agrega advertencias.',
    'Puedes proponer materiales no presentes en catalogo, pero si un numero de parte existe en candidateProducts debes usarlo.',
    `Tipos validos de servicio: ${JSON.stringify(SERVICE_TYPES)}`,
    'Estructura JSON requerida:',
    JSON.stringify({
      reply: 'Mensaje breve para el usuario indicando lo que entendiste y lo que actualizaste.',
      customer: { companyName: '', contactName: '', email: '', phone: '', address: '', taxId: '', notes: '' },
      project: { projectName: '', projectType: 'Integration project', industry: '', location: '', description: '', status: 'Nuevo' },
      quote: {
        wizard: {
          digitalInputs: 0,
          digitalOutputs: 0,
          analogInputs: 0,
          analogOutputs: 0,
          plcRequired: false,
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
        materials: [{ partNumber: '', description: '', brand: '', supplier: '', quantity: 1, unitCost: 0, reason: '' }],
        assumptions: [''],
        warnings: ['']
      }
    }),
    'Cotizacion actual:',
    JSON.stringify(currentDraft || {}),
    'Mensajes de la sesion:',
    JSON.stringify(messages.map((message) => ({ role: message.role, content: message.content }))),
    'Archivos procesados:',
    JSON.stringify(attachments.map((attachment) => ({
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
      summary: attachment.summary || '',
      extractedText: attachment.extractedText || ''
    }))),
    'Productos de catalogo candidatos:',
    JSON.stringify(candidateProducts.map((product) => ({
      partNumber: product.partNumber,
      description: product.description,
      brand: product.brand,
      supplier: product.supplier,
      category: product.category,
      unitCost: product.unitCost,
      currency: product.currency
    }))),
    'Tarifas de servicio:',
    JSON.stringify(serviceRates.map((rate) => ({
      serviceType: rate.serviceType,
      hourlyRate: rate.hourlyRate,
      currency: rate.currency
    })))
  ].join('\n');
}

function normalizeName(value) {
  return sanitizeText(value, 240).toLowerCase();
}

async function matchOrCreateCustomer(extractedCustomer) {
  const companyName = sanitizeText(extractedCustomer?.companyName, 240);
  if (!companyName) return null;
  const customers = await customerRepository.list();
  const existing = customers.find((item) => normalizeName(item.companyName) === normalizeName(companyName));
  if (existing) return existing;
  return customerRepository.create(normalizeCustomer({
    companyName,
    address: extractedCustomer?.address || '',
    taxId: extractedCustomer?.taxId || '',
    notes: extractedCustomer?.notes || '',
    contacts: [{
      name: extractedCustomer?.contactName || '',
      email: extractedCustomer?.email || '',
      phone: extractedCustomer?.phone || '',
      isPrimary: true
    }]
  }));
}

async function matchOrCreateProject(customerId, extractedProject) {
  const projectName = sanitizeText(extractedProject?.projectName, 240);
  if (!projectName) return null;
  const projects = await projectRepository.list();
  const existing = projects.find((item) => item.customerId === customerId && normalizeName(item.projectName) === normalizeName(projectName));
  if (existing) return existing;
  return projectRepository.create({
    customerId,
    projectName,
    projectType: extractedProject?.projectType || 'Integration project',
    industry: extractedProject?.industry || '',
    location: extractedProject?.location || '',
    description: extractedProject?.description || '',
    status: extractedProject?.status || 'Nuevo',
    createdDate: new Date().toISOString().slice(0, 10)
  });
}

function applyQuoteExtraction(baseQuote, extractedQuote) {
  const commercial = baseQuote.commercial || emptyQuoteDraft().commercial;
  const materials = (extractedQuote.materials?.length ? extractedQuote.materials : baseQuote.materials || []).map((item) => updateMaterialTotals(item, commercial.materialMarkupPercentage));
  const services = (extractedQuote.services?.length ? extractedQuote.services : baseQuote.services || []).map(updateServiceTotals);
  return {
    ...baseQuote,
    scopeOfWork: extractedQuote.scopeOfWork || baseQuote.scopeOfWork,
    exclusions: extractedQuote.exclusions || baseQuote.exclusions,
    notes: [baseQuote.notes, extractedQuote.notes, ...(extractedQuote.assumptions || []), ...(extractedQuote.warnings || [])].filter(Boolean).join('\n\n').slice(0, 10000),
    materials,
    services,
    wizard: extractedQuote.wizard,
    totals: calculateQuoteTotals(materials, services, commercial)
  };
}

export async function createAssistantSession({ userId, title = '' }) {
  return assistantSessionRepository.create({
    userId,
    title: sanitizeText(title, 240) || `Sesion ${new Date().toLocaleString('sv-SE')}`,
    status: 'pending',
    draftQuoteId: null,
    customerId: null,
    projectId: null,
    warnings: [],
    assumptions: [],
    structuredContext: null,
    lastAssistantReply: ''
  });
}

export async function getAssistantSessionDetail(sessionId, userId) {
  const session = await assistantSessionRepository.findById(sessionId);
  if (!session || session.userId !== userId) return null;
  const [messages, attachments, actions] = await Promise.all([
    assistantMessageRepository.listBySession(sessionId),
    assistantAttachmentRepository.listBySession(sessionId),
    assistantActionRepository.listBySession(sessionId)
  ]);
  return { ...session, messages, attachments, actions };
}

export async function addAssistantMessage({ sessionId, userId, content }) {
  const session = await assistantSessionRepository.findById(sessionId);
  if (!session || session.userId !== userId) return null;
  await assistantSessionRepository.update(sessionId, { status: 'pending' });
  return assistantMessageRepository.create({
    sessionId,
    userId,
    role: 'user',
    content: sanitizeText(content, 8000)
  });
}

export async function addAssistantReply({ sessionId, userId, content }) {
  return assistantMessageRepository.create({
    sessionId,
    userId,
    role: 'assistant',
    content: sanitizeText(content, 8000)
  });
}

export async function addAssistantAction({ sessionId, draftQuoteId, type, summary, payload = {} }) {
  return assistantActionRepository.create({
    sessionId,
    draftQuoteId: draftQuoteId || null,
    type,
    summary: sanitizeText(summary, 1000),
    payload
  });
}

export async function processAssistantSession({ sessionId, userId }) {
  const detail = await getAssistantSessionDetail(sessionId, userId);
  if (!detail) return null;

  await assistantSessionRepository.update(sessionId, { status: 'processing' });

  const pendingAttachments = detail.attachments.filter((item) => item.status === 'uploaded');
  for (const attachment of pendingAttachments) {
    try {
      const extracted = await extractAttachment(attachment);
      await assistantAttachmentRepository.update(attachment.id, {
        status: 'processed',
        summary: extracted.summary,
        extractedText: extracted.extractedText,
        partNumbers: extracted.partNumbers,
        warnings: extracted.warnings,
        processedAt: new Date()
      });
    } catch (error) {
      await assistantAttachmentRepository.update(attachment.id, {
        status: 'error',
        summary: `Error al procesar ${attachment.originalName}`,
        warnings: [sanitizeText(error.message, 500)],
        processedAt: new Date()
      });
    }
  }

  const refreshed = await getAssistantSessionDetail(sessionId, userId);
  const currentDraft = refreshed.draftQuoteId ? await quoteRepository.findById(refreshed.draftQuoteId) : emptyQuoteDraft();
  const serviceRates = await serviceRateRepository.list();
  const catalogText = [
    refreshed.messages.map((item) => item.content).join('\n'),
    refreshed.attachments.map((item) => [item.summary, item.extractedText].filter(Boolean).join('\n')).join('\n')
  ].filter(Boolean).join('\n');
  const candidateProducts = await loadCatalogCandidates(catalogText);
  const prompt = buildAssistantPrompt({
    messages: refreshed.messages,
    attachments: refreshed.attachments,
    candidateProducts,
    serviceRates,
    currentDraft
  });
  const raw = await callOpenAiJson([
    {
      role: 'system',
      content: 'Eres un asistente de preventa para automatizacion industrial. Responde solo JSON valido.'
    },
    {
      role: 'user',
      content: prompt
    }
  ]);

  const normalized = normalizeAssistantResult(raw, serviceRates, candidateProducts, currentDraft.commercial || emptyQuoteDraft().commercial);
  await assistantSessionRepository.update(sessionId, {
    status: 'draft_ready',
    structuredContext: normalized,
    warnings: normalized.quote.warnings,
    assumptions: normalized.quote.assumptions,
    lastAssistantReply: normalized.reply,
    lastProcessedAt: new Date()
  });
  await addAssistantReply({ sessionId, userId, content: normalized.reply || 'He analizado los archivos y actualice el borrador con la informacion disponible.' });
  return getAssistantSessionDetail(sessionId, userId);
}

export async function createOrUpdateDraftQuote({ sessionId, userId }) {
  const detail = await getAssistantSessionDetail(sessionId, userId);
  if (!detail) return null;
  const context = detail.structuredContext;
  if (!context) {
    const error = new Error('Assistant session has no processed context');
    error.statusCode = 400;
    throw error;
  }

  const customer = await matchOrCreateCustomer(context.customer);
  const project = customer ? await matchOrCreateProject(customer.id, context.project) : null;
  let quote = detail.draftQuoteId ? await quoteRepository.findById(detail.draftQuoteId) : null;
  if (!quote) {
    quote = await quoteRepository.createQuote(emptyQuoteDraft());
  }

  const recipientContact = customer?.primaryContact || null;
  const quoteBase = {
    ...quote,
    customerId: customer?.id || quote.customerId || '',
    projectId: project?.id || quote.projectId || '',
    recipientContactId: recipientContact?.id || quote.recipientContactId || null
  };
  if (customer) {
    quoteBase.customerSnapshot = {
      ...customer,
      selectedContact: recipientContact,
      recipientContact
    };
  } else if (quote.customerSnapshot) {
    quoteBase.customerSnapshot = quote.customerSnapshot;
  }
  if (project) quoteBase.projectSnapshot = project;
  else if (quote.projectSnapshot) quoteBase.projectSnapshot = quote.projectSnapshot;

  const updatedQuote = applyQuoteExtraction(quoteBase, context.quote);

  const savedQuote = quote.id
    ? await quoteRepository.update(quote.id, updatedQuote)
    : await quoteRepository.createQuote(updatedQuote);

  await assistantSessionRepository.update(sessionId, {
    draftQuoteId: savedQuote.id,
    customerId: customer?.id || null,
    projectId: project?.id || null,
    status: 'draft_ready'
  });

  await addAssistantAction({
    sessionId,
    draftQuoteId: savedQuote.id,
    type: detail.draftQuoteId ? 'quote_updated' : 'quote_created',
    summary: detail.draftQuoteId
      ? `Borrador ${savedQuote.quoteNumber} actualizado por el asistente`
      : `Borrador ${savedQuote.quoteNumber} creado por el asistente`,
    payload: {
      customerId: customer?.id || null,
      projectId: project?.id || null,
      warnings: context.quote.warnings,
      assumptions: context.quote.assumptions
    }
  });

  return { quote: savedQuote, session: await getAssistantSessionDetail(sessionId, userId) };
}
