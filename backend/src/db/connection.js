import rethinkdb from 'rethinkdb';

const config = {
  host: process.env.RETHINKDB_HOST || 'localhost',
  port: Number(process.env.RETHINKDB_PORT || 28015),
  db: process.env.RETHINKDB_DB || 'automation_quotes'
};

let connection;

export async function getConnection() {
  if (!connection || !connection.open) {
    connection = await rethinkdb.connect(config);
  }
  return connection;
}

export { rethinkdb as r, config as dbConfig };
