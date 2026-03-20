import knex from 'knex';
import type { Knex } from 'knex';
import fs from 'fs';
import path from 'path';
import { Application } from './declarations';

function loadDatabasesFromFile(): Record<string, Knex.Config> {
  const databasesConfigPath = path.resolve(process.cwd(), 'config', 'databases.json');

  if (!fs.existsSync(databasesConfigPath)) {
    return {};
  }

  const raw = fs.readFileSync(databasesConfigPath, 'utf8');
  const parsed = JSON.parse(raw) as { databases?: Record<string, Knex.Config> };

  return parsed.databases || {};
}

export default function (app: Application) {
  const selectedDatabase = app.get('activeDatabase') || 'mdm';
  const appDatabaseMap = (app.get('databases') || {}) as Record<string, Knex.Config>;
  const fileDatabaseMap = loadDatabasesFromFile();
  const databaseMap = {
    ...fileDatabaseMap,
    ...appDatabaseMap
  };

  // Backward compatibility: allow legacy `postgres` config while migrating.
  const config = databaseMap[selectedDatabase] ?? app.get('postgres');

  if (!config) {
    const knownDatabases = Object.keys(databaseMap);
    throw new Error(
      `Database config not found for activeDatabase="${selectedDatabase}". ` +
      `Available databases: ${knownDatabases.length > 0 ? knownDatabases.join(', ') : 'none'}`
    );
  }

  // Preserve existing app.get('postgres') usage in the codebase.
  app.set('postgres', config);
  const db = knex(config);

  app.set('knexClient', db);
}