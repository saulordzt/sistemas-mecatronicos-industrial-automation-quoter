const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

function sanitizeText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeQuote(input = {}) {
  const materials = Array.isArray(input.materials) ? input.materials : [];
  const services = Array.isArray(input.services) ? input.services : [];
  const commercial = input.commercial || {};
  const totals = input.totals || {};

  return {
    id: sanitizeText(input.id, 120),
    quoteNumber: sanitizeText(input.quoteNumber, 120),
    status: sanitizeText(input.status, 60),
    variantName: sanitizeText(input.variantName, 120),
    revisionNumber: clampNumber(input.revisionNumber, { min: 0, max: 1000, fallback: 1 }),
    customerId: sanitizeText(input.customerId, 120),
    projectId: sanitizeText(input.projectId, 120),
    scopeOfWork: sanitizeText(input.scopeOfWork, 3000),
    exclusions: sanitizeText(input.exclusions, 1800),
    notes: sanitizeText(input.notes, 1800),
    materials: materials.slice(0, 25).map((item) => ({
      partNumber: sanitizeText(item?.partNumber, 120),
      description: sanitizeText(item?.description, 220),
      brand: sanitizeText(item?.brand, 120),
      supplier: sanitizeText(item?.supplier, 240),
      quantity: clampNumber(item?.quantity, { min: 0, max: 100000, fallback: 0 }),
      unitCost: clampNumber(item?.unitCost, { min: 0, max: 100000000, fallback: 0 }),
      markupPercentage: clampNumber(item?.markupPercentage, { min: 0, max: 1000, fallback: 0 }),
      totalPrice: clampNumber(item?.totalPrice, { min: 0, max: 100000000, fallback: 0 }),
      notes: sanitizeText(item?.notes, 220)
    })),
    services: services.slice(0, 20).map((item) => ({
      serviceType: sanitizeText(item?.serviceType, 120),
      description: sanitizeText(item?.description, 220),
      hours: clampNumber(item?.hours, { min: 0, max: 100000, fallback: 0 }),
      hourlyRate: clampNumber(item?.hourlyRate, { min: 0, max: 100000000, fallback: 0 }),
      total: clampNumber(item?.total, { min: 0, max: 100000000, fallback: 0 }),
      notes: sanitizeText(item?.notes, 220)
    })),
    commercial: {
      materialMarkupPercentage: clampNumber(commercial.materialMarkupPercentage, { min: 0, max: 1000, fallback: 0 }),
      laborMarkupPercentage: clampNumber(commercial.laborMarkupPercentage, { min: 0, max: 1000, fallback: 0 }),
      contingencyPercentage: clampNumber(commercial.contingencyPercentage, { min: 0, max: 1000, fallback: 0 }),
      discountPercentage: clampNumber(commercial.discountPercentage, { min: 0, max: 1000, fallback: 0 }),
      taxPercentage: clampNumber(commercial.taxPercentage, { min: 0, max: 1000, fallback: 0 }),
      currency: sanitizeText(commercial.currency, 12) || 'MXN',
      usdToMxnRate: clampNumber(commercial.usdToMxnRate, { min: 0, max: 1000000, fallback: 0 }),
      paymentTerms: sanitizeText(commercial.paymentTerms, 500),
      deliveryTime: sanitizeText(commercial.deliveryTime, 500),
      quoteValidityDays: clampNumber(commercial.quoteValidityDays, { min: 0, max: 3650, fallback: 0 })
    },
    totals: {
      materialsSubtotal: clampNumber(totals.materialsSubtotal, { min: 0, max: 1000000000, fallback: 0 }),
      laborSubtotal: clampNumber(totals.laborSubtotal, { min: 0, max: 1000000000, fallback: 0 }),
      directCost: clampNumber(totals.directCost, { min: 0, max: 1000000000, fallback: 0 }),
      markup: clampNumber(totals.markup, { min: 0, max: 1000000000, fallback: 0 }),
      contingency: clampNumber(totals.contingency, { min: 0, max: 1000000000, fallback: 0 }),
      discount: clampNumber(totals.discount, { min: 0, max: 1000000000, fallback: 0 }),
      tax: clampNumber(totals.tax, { min: 0, max: 1000000000, fallback: 0 }),
      finalTotal: clampNumber(totals.finalTotal, { min: 0, max: 1000000000, fallback: 0 })
    }
  };
}

function normalizeMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .slice(-12)
    .map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: sanitizeText(message?.content, 3000)
    }))
    .filter((message) => message.content);
}

function buildPrompt({ quote, messages }) {
  const materialSummary = {
    count: quote.materials.length,
    items: quote.materials
  };
  const serviceSummary = {
    count: quote.services.length,
    items: quote.services
  };

  return [
    'Eres un revisor senior de cotizaciones de automatizacion industrial.',
    'Tu trabajo es analizar la cotizacion actual y responder con sugerencias practicas para que el usuario haga los cambios manualmente.',
    'No reescribas ni modifiques la cotizacion directamente.',
    'No inventes numeros de parte, costos de proveedor ni datos de cliente.',
    'Evalua claridad tecnica, huecos comerciales, riesgos, consistencia de materiales/servicios y oportunidades de mejora.',
    'Si faltan datos, dilo explicitamente.',
    'Responde solo JSON valido con esta estructura:',
    JSON.stringify({
      reply: 'Resumen breve para el usuario.',
      suggestions: [
        {
          title: 'Accion sugerida',
          category: 'scope',
          priority: 'high',
          rationale: 'Por que conviene',
          changeHint: 'Que deberia editar manualmente'
        }
      ],
      warnings: ['']
    }),
    'Categorias permitidas: scope, materials, services, pricing, risk, commercial, client, structure.',
    'Prioridades permitidas: high, medium, low.',
    'Cotizacion actual:',
    JSON.stringify(quote),
    'Resumen compacto:',
    JSON.stringify({
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      scopeOfWork: quote.scopeOfWork,
      exclusions: quote.exclusions,
      notes: quote.notes,
      materialSummary,
      serviceSummary,
      commercial: quote.commercial,
      totals: quote.totals
    }),
    'Conversacion reciente:',
    JSON.stringify(messages)
  ].join('\n');
}

async function callOpenAi(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.statusCode = 503;
    throw error;
  }

  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Eres un revisor experto de cotizaciones industriales. Responde solo JSON valido y de forma concisa.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      const timeoutError = new Error('AI review timed out. Try a shorter prompt or retry.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  }

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

function normalizeSuggestions(suggestions = []) {
  const allowedCategories = new Set(['scope', 'materials', 'services', 'pricing', 'risk', 'commercial', 'client', 'structure']);
  const allowedPriorities = new Set(['high', 'medium', 'low']);

  return (Array.isArray(suggestions) ? suggestions : [])
    .slice(0, 8)
    .map((item) => ({
      title: sanitizeText(item?.title, 160),
      category: allowedCategories.has(item?.category) ? item.category : 'structure',
      priority: allowedPriorities.has(item?.priority) ? item.priority : 'medium',
      rationale: sanitizeText(item?.rationale, 500),
      changeHint: sanitizeText(item?.changeHint, 500)
    }))
    .filter((item) => item.title || item.rationale || item.changeHint);
}

export async function reviewQuoteWithAi(payload = {}) {
  const quote = normalizeQuote(payload.quote || {});
  const messages = normalizeMessages(payload.messages || []);
  const raw = await callOpenAi(buildPrompt({ quote, messages }));

  return {
    reply: sanitizeText(raw?.reply, 3000),
    suggestions: normalizeSuggestions(raw?.suggestions),
    warnings: (Array.isArray(raw?.warnings) ? raw.warnings : []).map((item) => sanitizeText(item, 300)).filter(Boolean)
  };
}
