import { createRepository } from './baseRepository.js';
import { getConnection, r, dbConfig } from '../db/connection.js';

const base = createRepository('assistant_attachments');
const table = () => r.db(dbConfig.db).table('assistant_attachments');

export const assistantAttachmentRepository = {
  ...base,
  async listBySession(sessionId) {
    const conn = await getConnection();
    const cursor = await table().filter({ sessionId }).orderBy('createdAt').run(conn);
    return cursor.toArray();
  },
  async listPendingBySession(sessionId) {
    const conn = await getConnection();
    const cursor = await table().filter({ sessionId, status: 'uploaded' }).orderBy('createdAt').run(conn);
    return cursor.toArray();
  }
};

