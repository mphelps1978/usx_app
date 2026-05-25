const fs = require('fs');
const path = require('path');

const META_TABLE = 'SequelizeMeta';

async function ensureMetaTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "${META_TABLE}" (
      name VARCHAR(255) NOT NULL PRIMARY KEY
    );
  `);
}

async function getAppliedNames(sequelize) {
  const [rows] = await sequelize.query(`SELECT name FROM "${META_TABLE}" ORDER BY name`);
  return new Set(rows.map((r) => r.name));
}

/**
 * Run pending .js migrations in api/migrations/ (sorted by filename).
 * Each file exports: async function up(sequelize, { isSQLite })
 */
async function runMigrations(sequelize) {
  const migrationsDir = __dirname;
  const isSQLite = sequelize.getDialect() === 'sqlite';
  await ensureMetaTable(sequelize);
  const applied = await getAppliedNames(sequelize);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.js') && f !== 'runMigrations.js')
    .sort();

  for (const file of files) {
    const name = file.replace(/\.js$/, '');
    if (applied.has(name)) continue;

    const mod = require(path.join(migrationsDir, file));
    if (typeof mod.up !== 'function') {
      console.warn(`[MIGRATE] Skipping ${file} (no up export)`);
      continue;
    }

    console.log(`[MIGRATE] Running ${name}...`);
    await mod.up(sequelize, { isSQLite });
    await sequelize.query(`INSERT INTO "${META_TABLE}" (name) VALUES (:name)`, {
      replacements: { name },
    });
    console.log(`[MIGRATE] Completed ${name}`);
  }
}

module.exports = { runMigrations };
