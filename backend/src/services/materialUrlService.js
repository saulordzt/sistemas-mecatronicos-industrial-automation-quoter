import { PDFParse } from 'pdf-parse';
import { productRepository } from '../repositories/productRepository.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

function sanitizeText(value, maxLength = 8000) {
  return String(value || '').trim().slice(0, maxLength);
}

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeCurrency(value) {
  const normalized = sanitizeText(value, 10).toUpperCase();
  return normalized === 'MXN' ? 'MXN' : 'USD';
}

function stripHtml(html) {
  return sanitizeText(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' '),
    32000
  );
}

function readMetaTag(html, attribute, key) {
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return sanitizeText(String(html || '').match(pattern)?.[1] || '', 1000);
}

function buildSearchTerms(url, sourceText) {
  const hostPath = `${url.hostname} ${url.pathname}`;
  return sanitizeText(`${hostPath} ${sourceText}`, 4000)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/_-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 10);
}

async function loadCatalogCandidates(url, sourceText) {
  const terms = buildSearchTerms(url, sourceText);
  if (!terms.length) return [];

  const responses = await Promise.all(terms.map((term) => productRepository.listPaginated({ page: 1, pageSize: 10, search: term })));
  const merged = new Map();

  for (const response of responses) {
    for (const item of response.items || []) {
      if (item.active === false) continue;
      merged.set(item.id || `${item.supplier}-${item.partNumber}`, item);
      if (merged.size >= 25) break;
    }
    if (merged.size >= 25) break;
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
      temperature: 0.1,
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

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return sanitizeText(parsed?.text, 24000);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function fetchUrlContent(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    const error = new Error('URL invalida');
    error.statusCode = 400;
    throw error;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    const error = new Error('Solo se permiten URLs http o https');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(parsedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SistemasMecatronicosBot/1.0; +https://cotizar.sistemasmecatronicos.com)'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const error = new Error(`No fue posible consultar la liga: ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const contentType = sanitizeText(response.headers.get('content-type') || '', 120).toLowerCase();
  const finalUrl = new URL(response.url);

  if (contentType.includes('pdf') || finalUrl.pathname.toLowerCase().endsWith('.pdf')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const extractedText = await extractPdfText(buffer);
    return {
      url: finalUrl,
      contentType,
      title: '',
      description: '',
      extractedText,
      sourceLabel: 'pdf'
    };
  }

  const html = await response.text();
  const title = sanitizeText(String(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''), 500);
  const description = readMetaTag(html, 'name', 'description') || readMetaTag(html, 'property', 'og:description');
  const ogTitle = readMetaTag(html, 'property', 'og:title');
  const extractedText = stripHtml(html);

  return {
    url: finalUrl,
    contentType,
    title: ogTitle || title,
    description,
    extractedText,
    sourceLabel: 'html'
  };
}

function domainHints(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host.includes('mcmaster.com')) return 'McMaster-Carr suele mostrar el numero de parte y descripcion en la pagina del producto.';
  if (host.includes('automationdirect.com')) return 'AutomationDirect suele incluir numero de parte, descripcion, marca, precio y proveedor AutomationDirect.';
  return 'Extrae solo datos visibles y evita inventar valores.';
}

function normalizeExtractedMaterial(raw, quantity, commercial = {}) {
  const unitCost = clampNumber(raw?.unitCost, { min: 0, max: 100000000, fallback: 0 });
  return {
    partNumber: sanitizeText(raw?.partNumber, 120),
    description: sanitizeText(raw?.description, 500),
    brand: sanitizeText(raw?.brand, 120),
    supplier: sanitizeText(raw?.supplier, 240),
    providerId: null,
    quantity: clampNumber(quantity ?? raw?.quantity, { min: 1, max: 100000, fallback: 1 }),
    unitCost,
    markupPercentage: clampNumber(commercial?.materialMarkupPercentage, { min: 0, max: 1000, fallback: 50 }),
    unitPrice: 0,
    totalPrice: 0,
    notes: sanitizeText(raw?.notes, 1000),
    sourceCurrency: normalizeCurrency(raw?.currency || commercial?.currency || 'USD'),
    sourceUnitCost: unitCost
  };
}

export async function extractMaterialFromUrl({ url, quantity = 1, commercial = {} }) {
  const fetched = await fetchUrlContent(url);
  const sourceText = [
    fetched.title,
    fetched.description,
    fetched.extractedText.slice(0, 18000)
  ].filter(Boolean).join('\n\n');
  const candidateProducts = await loadCatalogCandidates(fetched.url, sourceText);

  const raw = await callOpenAiJson([
    {
      role: 'system',
      content: 'Eres un asistente de compras para automatizacion industrial. Responde solo JSON valido.'
    },
    {
      role: 'user',
      content: [
        'Analiza esta pagina de producto y extrae un material para una cotizacion.',
        'No inventes datos. Si un dato no esta claro, dejalo vacio y agrega una advertencia.',
        domainHints(fetched.url.hostname),
        'Responde con JSON de esta forma:',
        JSON.stringify({
          partNumber: '',
          description: '',
          brand: '',
          supplier: '',
          quantity: 1,
          unitCost: 0,
          currency: 'USD',
          notes: '',
          warnings: [''],
          confidence: 'high'
        }),
        `URL final: ${fetched.url.href}`,
        `Titulo: ${fetched.title}`,
        `Descripcion meta: ${fetched.description}`,
        `Tipo fuente: ${fetched.sourceLabel}`,
        'Texto extraido:',
        sourceText,
        'Productos de catalogo candidatos:',
        JSON.stringify(candidateProducts.map((product) => ({
          partNumber: product.partNumber,
          description: product.description,
          brand: product.brand,
          supplier: product.supplier,
          providerId: product.providerId || null,
          unitCost: product.unitCost,
          currency: product.currency
        })))
      ].join('\n')
    }
  ]);

  const extractedMaterial = normalizeExtractedMaterial(raw, quantity, commercial);
  const matchedProduct = extractedMaterial.partNumber
    ? candidateProducts.find((product) => String(product.partNumber || '').trim().toLowerCase() === extractedMaterial.partNumber.toLowerCase()) || null
    : null;

  if (matchedProduct) {
    extractedMaterial.brand = matchedProduct.brand || extractedMaterial.brand;
    extractedMaterial.supplier = matchedProduct.supplier || extractedMaterial.supplier;
    extractedMaterial.providerId = matchedProduct.providerId || null;
    extractedMaterial.unitCost = clampNumber(matchedProduct.unitCost, { min: 0, max: 100000000, fallback: extractedMaterial.unitCost });
    extractedMaterial.sourceCurrency = normalizeCurrency(matchedProduct.currency || extractedMaterial.sourceCurrency);
    extractedMaterial.sourceUnitCost = clampNumber(matchedProduct.unitCost, { min: 0, max: 100000000, fallback: extractedMaterial.sourceUnitCost });
    extractedMaterial.notes = sanitizeText([extractedMaterial.notes, 'Coincidencia encontrada en catalogo local.'].filter(Boolean).join(' '), 1000);
  }

  return {
    material: extractedMaterial,
    matchedProduct,
    warnings: (Array.isArray(raw?.warnings) ? raw.warnings : []).map((item) => sanitizeText(item, 300)).filter(Boolean),
    source: {
      url: fetched.url.href,
      title: fetched.title,
      contentType: fetched.contentType
    }
  };
}
