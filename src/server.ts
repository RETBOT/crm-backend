import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { closePool } from "./db/sqlserver";

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`CRM backend running on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down backend...");
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  logger.error({ error }, "Failed to bootstrap application");
  process.exit(1);
});
