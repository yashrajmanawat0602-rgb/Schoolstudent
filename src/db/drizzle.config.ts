import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

const useCloudSql = Boolean(sqlHost && sqlDbName && user && password);

if (!useCloudSql && !databaseUrl) {
  throw new Error(
    'Database connection missing: set DATABASE_URL or SQL_HOST/SQL_DB_NAME/SQL_ADMIN_USER/SQL_ADMIN_PASSWORD.'
  );
}

const resolvedDatabaseUrl =
  databaseUrl &&
  databaseUrl.includes('.render.com') &&
  !databaseUrl.includes('sslmode=')
    ? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`
    : databaseUrl;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: useCloudSql
    ? {
        host: sqlHost!,
        user: user!,
        password: password!,
        database: sqlDbName!,
        ssl: false,
      }
    : {
        url: resolvedDatabaseUrl!,
      },
  verbose: true,
});
