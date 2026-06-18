import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultUploadRoot = fileURLToPath(new URL('../../../.uploads/quote-images/', import.meta.url));
const uploadRoot = process.env.QUOTE_IMAGE_UPLOAD_DIR || defaultUploadRoot;
export const maxQuoteImageBytes = 8 * 1024 * 1024;

const mimeExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

const extensionMimes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif']
]);

function safeSegment(value, fallback = 'file') {
  const segment = basename(String(value || fallback)).replace(/[^a-zA-Z0-9._-]/g, '_');
  return segment || fallback;
}

export function isSupportedQuoteImageMime(mimeType = '') {
  return mimeExtensions.has(normalizeQuoteImageMime(mimeType));
}

export function normalizeQuoteImageMime(mimeType = '') {
  return String(mimeType).split(';')[0].trim().toLowerCase();
}

export function quoteImageMimeFromName(fileName = '') {
  return extensionMimes.get(extname(fileName).toLowerCase()) || 'application/octet-stream';
}

export async function saveQuoteMaterialImage({ quoteId, filename, mimeType, buffer }) {
  const safeQuoteId = safeSegment(quoteId, 'quote');
  const originalName = safeSegment(filename, 'material-image');
  const normalizedMimeType = normalizeQuoteImageMime(mimeType);
  const extension = mimeExtensions.get(normalizedMimeType) || extname(originalName) || '.img';
  const storedName = `${Date.now()}-${randomUUID()}${extension}`;
  const dir = join(uploadRoot, safeQuoteId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, storedName), buffer);
  return {
    imageFileId: `${safeQuoteId}/${storedName}`,
    imageUrl: `/api/public/quote-images/${safeQuoteId}/${storedName}`,
    imageName: originalName,
    imageMimeType: normalizedMimeType,
    storedName
  };
}

export async function readQuoteMaterialImage({ quoteId, fileName }) {
  const safeQuoteId = safeSegment(quoteId, 'quote');
  const safeFileName = safeSegment(fileName, 'material-image');
  return readFile(join(uploadRoot, safeQuoteId, safeFileName));
}
