import bcrypt from 'bcryptjs';
import { r, dbConfig } from './connection.js';

const tables = ['users', 'customers', 'projects', 'quotes', 'products', 'providers', 'service_rates'];

const defaultServiceRates = [
  { serviceType: 'PLC programming', hourlyRate: 1710, currency: 'MXN' },
  { serviceType: 'HMI programming', hourlyRate: 1530, currency: 'MXN' },
  { serviceType: 'Electrical design', hourlyRate: 1620, currency: 'MXN' },
  { serviceType: 'Panel assembly', hourlyRate: 1170, currency: 'MXN' },
  { serviceType: 'Field installation', hourlyRate: 1350, currency: 'MXN' },
  { serviceType: 'Commissioning', hourlyRate: 1710, currency: 'MXN' },
  { serviceType: 'Troubleshooting', hourlyRate: 1800, currency: 'MXN' },
  { serviceType: 'Remote support', hourlyRate: 1440, currency: 'MXN' },
  { serviceType: 'Project management', hourlyRate: 1620, currency: 'MXN' },
  { serviceType: 'Documentation', hourlyRate: 1260, currency: 'MXN' }
];

async function ensureDatabase(conn) {
  const dbs = await r.dbList().run(conn);
  if (!dbs.includes(dbConfig.db)) {
    await r.dbCreate(dbConfig.db).run(conn);
  }
}

async function ensureTables(conn) {
  const existing = await r.db(dbConfig.db).tableList().run(conn);
  for (const table of tables) {
    if (!existing.includes(table)) {
      await r.db(dbConfig.db).tableCreate(table, { primaryKey: 'id' }).run(conn);
    }
  }
}

async function seedServiceRates(conn) {
  const table = r.db(dbConfig.db).table('service_rates');
  for (const rate of defaultServiceRates) {
    const existing = await table.filter({ serviceType: rate.serviceType }).limit(1).run(conn);
    const rows = await existing.toArray();
    if (!rows.length) {
      await table.insert({
        ...rate,
        id: r.uuid(),
        description: rate.serviceType,
        active: true,
        createdAt: r.now(),
        updatedAt: r.now()
      }).run(conn);
    }
  }
}


async function seedInitialUser(conn) {
  const table = r.db(dbConfig.db).table('users');
  const email = (process.env.INITIAL_USER_EMAIL || 'admin@sistemasmecatronicos.com').toLowerCase();
  const password = process.env.INITIAL_USER_PASSWORD || 'ChangeMe123!';
  const existing = await table.filter({ email }).limit(1).run(conn);
  const rows = await existing.toArray();

  if (!rows.length) {
    const passwordHash = await bcrypt.hash(password, 12);
    await table.insert({
      id: r.uuid(),
      email,
      name: 'Administrator',
      passwordHash,
      active: true,
      createdAt: r.now(),
      updatedAt: r.now()
    }).run(conn);
    console.log(`Seeded initial user: ${email}`);
  }
}

async function initDb() {
  const conn = await r.connect({
    host: dbConfig.host,
    port: dbConfig.port
  });

  await ensureDatabase(conn);
  await ensureTables(conn);
  await seedServiceRates(conn);
  await seedInitialUser(conn);
  await conn.close();

  console.log(`RethinkDB initialized: ${dbConfig.db}`);
}

initDb().catch((error) => {
  console.error('Failed to initialize RethinkDB', error);
  process.exit(1);
});
