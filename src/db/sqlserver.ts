import sql from "mssql";
import { env } from "../config/env";
import { logger } from "../config/logger";

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;

  try {
    pool = await new sql.ConnectionPool({
      user: env.sql.user,
      password: env.sql.password,
      server: env.sql.host,
      port: env.sql.port,
      database: env.sql.database,
      options: {
        encrypt: env.sql.encrypt,
        trustServerCertificate: env.sql.trustServerCertificate,
        enableArithAbort: true,
        instanceName: env.sql.instance || undefined,
      },
      connectionTimeout: 15000,
      requestTimeout: 15000,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    }).connect();

    logger.info(
      {
        host: env.sql.host,
        port: env.sql.port,
        instance: env.sql.instance || null,
        database: env.sql.database,
      },
      "SQL Server pool connected"
    );

    return pool;
  } catch (error) {
    logger.error(
      {
        error,
        host: env.sql.host,
        port: env.sql.port,
        instance: env.sql.instance || null,
        database: env.sql.database,
      },
      "Could not connect to SQL Server"
    );
    pool = null;
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.close();
  pool = null;
}

export { sql };
