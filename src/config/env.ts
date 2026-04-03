import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return raw.toLowerCase() === "true";
}

function getNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

export const env = {
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: getNumber("PORT", 4000),
  jwtSecret: getEnv("JWT_SECRET"),
  jwtExpiresMinutes: getNumber("JWT_EXPIRES_MIN", 60),
  appSecretKey: process.env.APP_SECRET_KEY || "",
  corsOrigin: getEnv("CORS_ORIGIN", "http://localhost:5173"),
  sql: {
    host: getEnv("SQL_HOST"),
    port: getNumber("SQL_PORT", 1433),
    instance: process.env.SQL_INSTANCE || "",
    database: getEnv("SQL_DATABASE"),
    user: getEnv("SQL_USER"),
    password: getEnv("SQL_PASSWORD"),
    encrypt: getBoolean("SQL_ENCRYPT", false),
    trustServerCertificate: getBoolean("SQL_TRUST_CERT", true),
  },
  smtp: {
    host: getEnv("SMTP_HOST"),
    port: getNumber("SMTP_PORT", 587),
    user: getEnv("SMTP_USER"),
    pass: getEnv("SMTP_PASS"),
    from: getEnv("SMTP_FROM"),
  },
  appUrl: getEnv("APP_URL", "http://localhost:5173"),
};
