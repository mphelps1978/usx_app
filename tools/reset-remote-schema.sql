-- Run on REMOTE database when pg_restore left orphan rows (FuelStops without Loads).
-- Then redeploy/restart the API (NODE_ENV=production uses sync without alter).
-- Then: node tools/migrate_postgres.js --import tools/usx-data.json --yes

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO usx;
GRANT ALL ON SCHEMA public TO public;
