#!/usr/bin/env node
/**
 * Copy app data from local Postgres → remote Postgres (Dockploy).
 *
 * Usage (from repo root):
 *   $env:TARGET_DATABASE_URL="postgresql://usx:PASSWORD@HOST:5432/usx"
 *   $env:TARGET_DATABASE_SSL="true"   # if connecting over the internet
 *   node tools/migrate_postgres.js --dry-run
 *   node tools/migrate_postgres.js --yes
 *
 * If the VPS DB is not reachable from your PC, export then import on the server:
 *   node tools/migrate_postgres.js --export tools/usx-data.json
 *   scp tools/usx-data.json root@72.61.75.55:/tmp/
 *   TARGET_DATABASE_URL=... node tools/migrate_postgres.js --import /tmp/usx-data.json --yes
 *
 * SOURCE: api/.env DATABASE_URL (local IC_Books)
 * Only copies: Users, UserSettings, Vendors, Loads, FuelStops, OfficeExpenses, BugReports
 */

const fs = require('fs');
const path = require('path');
const apiDir = path.join(__dirname, '..', 'api');
require(path.join(apiDir, 'node_modules', 'dotenv')).config({ path: path.join(apiDir, '.env') });
const { Sequelize } = require(path.join(apiDir, 'node_modules', 'sequelize'));

const APP_TABLES = [
  'Users',
  'UserSettings',
  'Vendors',
  'Loads',
  'FuelStops',
  'OfficeExpenses',
  'BugReports',
];

function postgresTarget(url) {
  try {
    const normalized = url.replace(/^postgres(ql)?:/i, 'http:');
    const u = new URL(normalized);
    return { host: u.hostname || '', database: (u.pathname || '/').replace(/^\//, '') || 'postgres' };
  } catch {
    return { host: '', database: 'postgres' };
  }
}

function isPrivateOrLocalHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  const m = /^172\.(\d+)\.\d+\.\d+$/.exec(h);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function useSsl(url, explicitEnv) {
  if (explicitEnv === 'true' || explicitEnv === '1') return true;
  if (explicitEnv === 'false' || explicitEnv === '0') return false;
  const { host } = postgresTarget(url);
  return host && !isPrivateOrLocalHost(host);
}

function makeSequelize(url, label, sslEnv) {
  const ssl = useSsl(url, sslEnv);
  const { host, database } = postgresTarget(url);
  console.log(`[${label}] host=${host} database=${database} ssl=${ssl}`);
  return new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      connectionTimeoutMillis: 30000,
      ...(ssl
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {}),
    },
  });
}

async function tableExists(seq, table) {
  const rows = await seq.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = :table LIMIT 1`,
    { replacements: { table }, type: Sequelize.QueryTypes.SELECT },
  );
  return rows.length > 0;
}

async function fetchAll(seq, table) {
  return seq.query(`SELECT * FROM "${table}"`, { type: Sequelize.QueryTypes.SELECT });
}

async function insertRows(seq, table, rows) {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;
  let inserted = 0;
  for (const row of rows) {
    const values = cols.map((c) => row[c]);
    await seq.query(sql, { bind: values });
    inserted += 1;
  }
  return inserted;
}

async function syncSequences(seq) {
  const tables = [
    { table: 'Users', column: 'id' },
    { table: 'Loads', column: 'id' },
    { table: 'FuelStops', column: 'id' },
    { table: 'BugReports', column: 'id' },
    { table: 'Vendors', column: 'id' },
    { table: 'OfficeExpenses', column: 'id' },
  ];
  for (const { table, column } of tables) {
    const [rows] = await seq.query(`SELECT COALESCE(MAX("${column}"), 0) AS max_id FROM "${table}"`);
    const maxId = Number(rows[0]?.max_id ?? 0);
    const [seqRows] = await seq.query(
      `SELECT pg_get_serial_sequence('"${table}"', '${column}') AS seq`,
    );
    const seqName = seqRows[0]?.seq;
    if (!seqName) continue;
    if (maxId < 1) {
      await seq.query(`SELECT setval($1::regclass, 1, false)`, { bind: [seqName] });
    } else {
      await seq.query(`SELECT setval($1::regclass, $2, true)`, { bind: [seqName, maxId] });
    }
    console.log(`[target] sequence synced for "${table}" → max id ${maxId}`);
  }
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

async function loadPayloadFromSource(source) {
  const payload = { tables: {}, exportedAt: new Date().toISOString() };
  for (const table of APP_TABLES) {
    if (!(await tableExists(source, table))) {
      console.warn(`[skip] "${table}" not on source`);
      payload.tables[table] = [];
      continue;
    }
    payload.tables[table] = await fetchAll(source, table);
    console.log(`[export] "${table}": ${payload.tables[table].length} rows`);
  }
  return payload;
}

async function writePayloadToTarget(target, payload, { dryRun }) {
  const summary = APP_TABLES.map((table) => ({
    table,
    count: (payload.tables[table] || []).length,
  }));
  console.log('\nRows to load:');
  for (const { table, count } of summary) {
    console.log(`  ${table}: ${count}`);
  }
  if (dryRun) return;

  const truncateList = APP_TABLES.map((t) => `"${t}"`).join(', ');
  await target.query(`TRUNCATE ${truncateList} RESTART IDENTITY CASCADE`);
  console.log('[target] truncated app tables');

  for (const table of APP_TABLES) {
    const rows = payload.tables[table] || [];
    if (!rows.length) continue;
    if (!(await tableExists(target, table))) {
      console.warn(`[warn] "${table}" missing on target — deploy API once (sequelize sync) then retry`);
      continue;
    }
    const n = await insertRows(target, table, rows);
    console.log(`[copy] "${table}": ${n} rows`);
  }
  await syncSequences(target);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const yes = process.argv.includes('--yes');
  const exportPath = argValue('--export');
  const importPath = argValue('--import');
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;

  if (exportPath) {
    if (!sourceUrl) {
      console.error('Missing SOURCE: set DATABASE_URL in api/.env');
      process.exit(1);
    }
    const source = makeSequelize(sourceUrl, 'source', process.env.SOURCE_DATABASE_SSL);
    await source.authenticate();
    const payload = await loadPayloadFromSource(source);
    fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`\nWrote ${exportPath}`);
    await source.close();
    return;
  }

  if (importPath) {
    if (!targetUrl) {
      console.error('Missing TARGET_DATABASE_URL');
      process.exit(1);
    }
    if (!fs.existsSync(importPath)) {
      console.error(`File not found: ${importPath}`);
      process.exit(1);
    }
    const payload = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    const target = makeSequelize(targetUrl, 'target', process.env.TARGET_DATABASE_SSL);
    await target.authenticate();
    if (dryRun) {
      await writePayloadToTarget(target, payload, { dryRun: true });
      console.log('\nDry run only — re-run with --yes to import.');
      await target.close();
      return;
    }
    if (!yes) {
      console.error('\nRefusing to write without --yes');
      process.exit(1);
    }
    await writePayloadToTarget(target, payload, { dryRun: false });
    console.log('\nImport complete.');
    await target.close();
    return;
  }

  if (!sourceUrl) {
    console.error('Missing SOURCE: set DATABASE_URL in api/.env or SOURCE_DATABASE_URL');
    process.exit(1);
  }
  if (!targetUrl) {
    console.error('Missing TARGET_DATABASE_URL (remote Dockploy Postgres connection string)');
    process.exit(1);
  }

  const source = makeSequelize(sourceUrl, 'source', process.env.SOURCE_DATABASE_SSL);
  const target = makeSequelize(targetUrl, 'target', process.env.TARGET_DATABASE_SSL);

  await source.authenticate();
  await target.authenticate();

  const payload = await loadPayloadFromSource(source);

  if (dryRun) {
    await writePayloadToTarget(target, payload, { dryRun: true });
    console.log('\nDry run only — no changes on target. Re-run with --yes to migrate.');
    await source.close();
    await target.close();
    return;
  }

  if (!yes) {
    console.error('\nRefusing to write without --yes (this replaces all app data on the target).');
    process.exit(1);
  }

  await writePayloadToTarget(target, payload, { dryRun: false });
  console.log('\nMigration complete.');
  await source.close();
  await target.close();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  if (err.parent) console.error(err.parent.message || err.parent);
  process.exit(1);
});
