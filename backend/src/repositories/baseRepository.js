import { getConnection, r, dbConfig } from '../db/connection.js';

export function createRepository(tableName) {
  const table = () => r.db(dbConfig.db).table(tableName);

  return {
    async list() {
      const conn = await getConnection();
      const cursor = await table().orderBy(r.desc('createdAt')).run(conn);
      return cursor.toArray();
    },

    async findById(id) {
      const conn = await getConnection();
      return table().get(id).run(conn);
    },

    async create(data) {
      const conn = await getConnection();
      const document = {
        ...data,
        id: data.id || r.uuid(),
        createdAt: r.now(),
        updatedAt: r.now()
      };
      const result = await table().insert(document, { returnChanges: true }).run(conn);
      return result.changes?.[0]?.new_val;
    },

    async update(id, data) {
      const conn = await getConnection();
      const result = await table().get(id).update(
        {
          ...data,
          updatedAt: r.now()
        },
        { returnChanges: true }
      ).run(conn);
      return result.changes?.[0]?.new_val || table().get(id).run(conn);
    },

    async remove(id) {
      const conn = await getConnection();
      return table().get(id).delete().run(conn);
    }
  };
}
