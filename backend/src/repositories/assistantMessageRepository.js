import { createRepository } from './baseRepository.js';
import { getConnection, r, dbConfig } from '../db/connection.js';

const base = createRepository('assistant_messages');
const table = () => r.db(dbConfig.db).table('assistant_messages');

export const assistantMessageRepository = {
  ...base,
  async listBySession(sessionId) {
    const conn = await getConnection();
    const cursor = await table().filter({ sessionId }).orderBy('createdAt').run(conn);
    return cursor.toArray();
  }
};

