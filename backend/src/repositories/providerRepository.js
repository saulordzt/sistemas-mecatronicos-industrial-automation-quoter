import { getConnection, r, dbConfig } from '../db/connection.js';
import { createRepository } from './baseRepository.js';

const base = createRepository('providers');
const table = () => r.db(dbConfig.db).table('providers');

export const providerRepository = {
  ...base,
  async findByCompanyName(companyName) {
    const conn = await getConnection();
    const cursor = await table().filter({ companyName: String(companyName || '').trim() }).limit(1).run(conn);
    const rows = await cursor.toArray();
    return rows[0] || null;
  }
};
