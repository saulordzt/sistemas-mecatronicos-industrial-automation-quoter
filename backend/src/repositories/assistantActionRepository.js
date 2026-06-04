import { createRepository } from './baseRepository.js';
import { getConnection, r, dbConfig } from '../db/connection.js';

const base = createRepository('assistant_actions');
const table = () => r.db(dbConfig.db).table('assistant_actions');

export const assistantActionRepository = {
  ...base,
  async listBySession(sessionId) {
    const conn = await getConnection();
    const cursor = await table().filter({ sessionId }).orderBy('createdAt').run(conn);
    return cursor.toArray();
  }
};

