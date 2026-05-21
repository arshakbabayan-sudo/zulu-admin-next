/**
 * Next.js instrumentation hook for the admin. Loads the runtime-specific
 * Sentry config (Node vs Edge) on process boot, plus exports
 * onRequestError so the App Router error API auto-captures.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
