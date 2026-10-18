export interface DatabaseConfig {
  connectionString: string;
}

export interface AppConfig {
  database: DatabaseConfig;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  return { database: { connectionString }, port };
}
