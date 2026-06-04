import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const uploadRoot = process.env.ASSISTANT_UPLOAD_DIR || '/tmp/industrial-automation-quoter-assistant';

function safeName(name) {
  const base = basename(String(name || 'file')).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || `file-${Date.now()}`;
}

export async function saveAssistantFile({ sessionId, filename, buffer }) {
  const dir = join(uploadRoot, sessionId);
  await mkdir(dir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}${extname(filename || '') || ''}-${safeName(filename)}`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function readAssistantFile(filePath) {
  return readFile(filePath);
}

