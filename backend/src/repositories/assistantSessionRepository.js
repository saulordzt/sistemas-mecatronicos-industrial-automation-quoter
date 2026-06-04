import { createRepository } from './baseRepository.js';
import { getConnection, r, dbConfig } from '../db/connection.js';

const base = createRepository('assistant_sessions');
const table = () => r.db(dbConfig.db).table('assistant_sessions');

export const assistantSessionRepository = {
  ...base,
  async listByUser(userId) {
    const conn = await getConnection();
    const cursor = await table().filter({ userId }).orderBy(r.desc('updatedAt')).run(conn);
    return cursor.toArray();
  }
};

