/**
 * Metrics API Endpoint (MONITOR-002)
 *
 * Exposes application metrics for monitoring systems.
 * Supports both JSON and Prometheus exposition formats.
 *
 * GET /api/metrics - Returns metrics in JSON format (default)
 * GET /api/metrics?format=prometheus - Returns metrics in Prometheus format
 * GET /api/metrics?format=json - Returns metrics in JSON format (explicit)
 *
 * Response includes:
 * - Trade processing statistics
 * - Alert generation statistics
 * - Wallet profiler statistics
 * - Market sync statistics
 * - WebSocket connection statistics
 * - API request statistics
 * - System metrics (memory, uptime)
 */

import { NextRequest, NextResponse } from "next/server";
import { metrics, type ApplicationMetrics, type MetricsFormat } from "@/utils/metrics";

// ============================================================================
// Types
// ============================================================================

/**
 * Metrics response wrapper for JSON format
 */
export interface MetricsResponse {
  /** Response status */
  status: "ok" | "error";
  /** Format of the metrics data */
  format: MetricsFormat;
  /** The collected metrics */
  data: ApplicationMetrics;
}

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * GET /api/metrics
 *
 * Returns application metrics in the requested format.
 *
 * Query Parameters:
 * - format: "json" (default) or "prometheus"
 *
 * Response Headers:
 * - Content-Type: application/json (for JSON format)
 * - Content-Type: text/plain; version=0.0.4; charset=utf-8 (for Prometheus format)
 *
 * Response:
 * - 200: Metrics retrieved successfully
 * - 400: Invalid format parameter
 * - 500: Error collecting metrics
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<MetricsResponse | string | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const formatParam = searchParams.get("format")?.toLowerCase() || "json";

    // Validate format parameter
    if (formatParam !== "json" && formatParam !== "prometheus") {
      return NextResponse.json(
        { error: `Invalid format: ${formatParam}. Supported formats: json, prometheus` },
        { status: 400 }
      );
    }

    const format: MetricsFormat = formatParam as MetricsFormat;

    // Get metrics
    const metricsData = metrics.getFormattedMetrics(format);

    // Return based on format
    if (format === "prometheus") {
      // Prometheus format - return as plain text
      return new NextResponse(metricsData as string, {
        status: 200,
        headers: {
          // Prometheus exposition format content type
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // JSON format - return wrapped response
    const response: MetricsResponse = {
      status: "ok",
      format: "json",
      data: metricsData as ApplicationMetrics,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error collecting metrics:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to collect metrics",
      },
      { status: 500 }
    );
  }
}
