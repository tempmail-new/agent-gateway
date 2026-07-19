import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createTelemetry } from "./observability/tracing.js";

const config = loadConfig();
const telemetry = createTelemetry(config);
telemetry.start();
const app = buildApp(config);

try {
  app.log.info({ telemetryEnabled: telemetry.enabled }, "telemetry_initialized");
  await app.listen({ host: "0.0.0.0", port: config.port });
} catch (error) {
  app.log.error(error);
  await telemetry.shutdown();
  process.exit(1);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "shutdown_started");

  try {
    await app.close();
    await telemetry.shutdown();
    app.log.info({ signal }, "shutdown_completed");
    process.exit(0);
  } catch (error) {
    app.log.error({ error, signal }, "shutdown_failed");
    process.exit(1);
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
