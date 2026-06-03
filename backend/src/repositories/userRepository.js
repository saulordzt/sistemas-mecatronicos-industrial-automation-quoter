import { getConnection, r, dbConfig } from '../db/connection.js';
import { createRepository } from './baseRepository.js';

const base = createRepository('users');
const table = () => r.db(dbConfig.db).table('users');

export const userRepository = {
  ...base,
  async findByEmail(email) {
    const conn = await getConnection();
    const cursor = await table().filter({ email: String(email || '').toLowerCase() }).limit(1).run(conn);
    const rows = await cursor.toArray();
    return rows[0] || null;
  }
};
