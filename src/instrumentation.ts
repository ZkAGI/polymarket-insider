/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js when the application starts.
 * It initializes all background services using the StartupOrchestrator.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { startupOrchestrator } from "./services/startup";

/**
 * Called when the Next.js application starts.
 * Initializes all background services.
 */
export async function register() {
  // Only run on the server-side
  if (typeof window !== "undefined") {
    return;
  }

  // Determine if we should start services based on environment
  const shouldStartServices = process.env.ENABLE_BACKGROUND_SERVICES !== "false";

  if (!shouldStartServices) {
    console.log(
      "[Instrumentation] Background services disabled via ENABLE_BACKGROUND_SERVICES=false"
    );
    return;
  }

  console.log("[Instrumentation] Initializing background services...");

  try {
    // Set up graceful shutdown handlers
    startupOrchestrator.setupGracefulShutdown();

    // Start all services
    const status = await startupOrchestrator.startAllServices();

    if (status.allRunning) {
      console.log(
        `[Instrumentation] All services started successfully in ${status.startupTimeMs}ms`
      );
    } else if (status.hasErrors) {
      console.warn(
        "[Instrumentation] Some services failed to start:",
        status.services
          .filter((s) => s.status === "error")
          .map((s) => `${s.name}: ${s.error}`)
          .join(", ")
      );
    } else {
      console.log(
        "[Instrumentation] Services partially started:",
        status.services
          .filter((s) => s.status === "running")
          .map((s) => s.name)
          .join(", ")
      );
    }
  } catch (error) {
    console.error(
      "[Instrumentation] Critical error during startup:",
      error instanceof Error ? error.message : String(error)
    );
    // Don't throw - allow Next.js to continue even if services fail
  }
}
