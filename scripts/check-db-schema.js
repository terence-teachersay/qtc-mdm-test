const fs = require('fs')
const path = require('path')
const knex = require('knex')

const CERTIFICATE_TABLES = [
  'certificates',
  'certificate_types',
  'certificate_requests',
  'certificate_request_types',
  'certificate_request_statuses'
]

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function resolveActiveDatabase(rootDir) {
  const localConfig = readJsonIfExists(path.join(rootDir, 'config', 'local.json'))
  const defaultConfig = readJsonIfExists(path.join(rootDir, 'config', 'default.json'))
  return localConfig.activeDatabase || defaultConfig.activeDatabase || 'mdm'
}

function resolveDatabaseConfig(rootDir, activeDatabase) {
  const databasesConfig = readJsonIfExists(path.join(rootDir, 'config', 'databases.json'))
  const config = databasesConfig.databases?.[activeDatabase]

  if (!config) {
    throw new Error(
      `Database config not found for activeDatabase="${activeDatabase}" in config/databases.json`
    )
  }

  return config
}

async function getTables(db, tableNames) {
  if (tableNames.length === 0) {
    return []
  }

  return db('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public' })
    .whereIn('table_name', tableNames)
    .orderBy('table_name')
}

async function getAllPublicTables(db) {
  return db('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public', table_type: 'BASE TABLE' })
    .orderBy('table_name')
}

async function getColumns(db, tableName) {
  return db('information_schema.columns')
    .select('column_name', 'data_type', 'is_nullable', 'column_default')
    .where({ table_schema: 'public', table_name: tableName })
    .orderBy('ordinal_position')
}

async function getPrimaryKeys(db, tableName) {
  return db('information_schema.table_constraints as tc')
    .join('information_schema.key_column_usage as kcu', function joinPrimaryKeyUsage() {
      this.on('tc.constraint_name', '=', 'kcu.constraint_name')
        .andOn('tc.table_schema', '=', 'kcu.table_schema')
    })
    .select('kcu.column_name')
    .where({
      'tc.table_schema': 'public',
      'tc.table_name': tableName,
      'tc.constraint_type': 'PRIMARY KEY'
    })
    .orderBy('kcu.ordinal_position')
}

async function getForeignKeys(db, tableName) {
  return db('information_schema.table_constraints as tc')
    .join('information_schema.key_column_usage as kcu', function joinForeignKeyUsage() {
      this.on('tc.constraint_name', '=', 'kcu.constraint_name')
        .andOn('tc.table_schema', '=', 'kcu.table_schema')
    })
    .join('information_schema.constraint_column_usage as ccu', function joinConstraintColumns() {
      this.on('ccu.constraint_name', '=', 'tc.constraint_name')
        .andOn('ccu.table_schema', '=', 'tc.table_schema')
    })
    .select(
      'tc.constraint_name',
      'kcu.column_name',
      'ccu.table_name as references_table',
      'ccu.column_name as references_column'
    )
    .where({
      'tc.table_schema': 'public',
      'tc.table_name': tableName,
      'tc.constraint_type': 'FOREIGN KEY'
    })
    .orderBy('kcu.ordinal_position')
}

function parseArguments(argv) {
  const args = argv.slice(2)
  const flags = new Set(args.filter((arg) => arg.startsWith('--')))
  const positional = args.filter((arg) => !arg.startsWith('--'))
  const tablesArg = args.find((arg) => arg.startsWith('--tables='))

  const activeDatabase = positional[0]
  const positionalTables = positional.slice(1)
  const tablesFromFlag = tablesArg
    ? tablesArg
        .replace('--tables=', '')
        .split(',')
        .map((table) => table.trim())
        .filter(Boolean)
    : []

  return {
    help: flags.has('--help') || flags.has('-h'),
    certOnly: flags.has('--cert-only'),
    showRelations: !flags.has('--no-relations'),
    activeDatabase,
    positionalTables,
    tablesFromFlag
  }
}

function printUsage() {
  console.log('Usage: node scripts/check-db-schema.js [database] [table1 table2 ...] [--tables=a,b,c] [--cert-only] [--no-relations]')
  console.log('Examples:')
  console.log('  node scripts/check-db-schema.js')
  console.log('  node scripts/check-db-schema.js qc1-personal users roles groups')
  console.log('  node scripts/check-db-schema.js --tables=users,roles,groups')
  console.log('  node scripts/check-db-schema.js --cert-only')
}

async function main() {
  const rootDir = path.resolve(__dirname, '..')
  const args = parseArguments(process.argv)
  if (args.help) {
    printUsage()
    return
  }

  const activeDatabase = args.activeDatabase || resolveActiveDatabase(rootDir)

  const dbConfig = resolveDatabaseConfig(rootDir, activeDatabase)
  const db = knex(dbConfig)

  try {
    let targetTables = []
    if (args.certOnly) {
      targetTables = CERTIFICATE_TABLES
    } else if (args.positionalTables.length > 0) {
      targetTables = args.positionalTables
    } else if (args.tablesFromFlag.length > 0) {
      targetTables = args.tablesFromFlag
    } else {
      const allTables = await getAllPublicTables(db)
      targetTables = allTables.map((row) => row.table_name)
    }

    console.log(`Active database: ${activeDatabase}`)
    console.log(`Mode: ${args.certOnly ? 'cert-only' : targetTables.length > 0 ? 'custom/all' : 'empty'}`)
    console.log('Tables requested:')
    console.table(targetTables.map((table_name) => ({ table_name })))

    const tables = await getTables(db, targetTables)
    console.log('Tables found:')
    console.table(tables)

    const foundTableNames = new Set(tables.map((row) => row.table_name))
    const missingTables = targetTables.filter((tableName) => !foundTableNames.has(tableName))
    if (missingTables.length > 0) {
      console.log('Tables missing:')
      console.table(missingTables.map((table_name) => ({ table_name })))
    }

    for (const tableName of targetTables) {
      const columns = await getColumns(db, tableName)
      console.log(`Columns for ${tableName}:`)
      if (columns.length === 0) {
        console.log('  Table not found or has no visible columns.')
        continue
      }
      console.table(columns)

      if (args.showRelations) {
        const primaryKeys = await getPrimaryKeys(db, tableName)
        const foreignKeys = await getForeignKeys(db, tableName)

        console.log(`Primary keys for ${tableName}:`)
        if (primaryKeys.length === 0) {
          console.log('  No primary key found.')
        } else {
          console.table(primaryKeys)
        }

        console.log(`Foreign keys for ${tableName}:`)
        if (foreignKeys.length === 0) {
          console.log('  No foreign keys found.')
        } else {
          console.table(foreignKeys)
        }
      }
    }
  } finally {
    await db.destroy()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
