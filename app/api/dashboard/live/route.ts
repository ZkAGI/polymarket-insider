/**
 * Dashboard Live Updates API Endpoint (UI-WS-001)
 *
 * Server-Sent Events (SSE) endpoint that pushes real-time updates to the dashboard.
 * This enables live updates without page refresh.
 *
 * Event types:
 * - alert:new - New alert created
 * - trade:whale - Whale trade detected
 * - stats:update - Dashboard stats changed significantly
 * - heartbeat - Connection keep-alive (every 30 seconds)
 *
 * Usage:
 * const eventSource = new EventSource('/api/dashboard/live');
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *   // Handle update
 * };
 */

import {
  getDashboardEventBus,
  type DashboardEvent,
} from "@/lib/dashboard-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heartbeat interval in milliseconds
 */
const HEARTBEAT_INTERVAL = 30000;

/**
 * GET /api/dashboard/live
 *
 * Establishes an SSE connection for real-time dashboard updates.
 */
export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const eventBus = getDashboardEventBus();

      /**
       * Send an SSE event to the client
       */
      const sendEvent = (eventType: string, data: unknown): void => {
        try {
          const payload = JSON.stringify(data);
          // SSE format: event: type\ndata: payload\n\n
          const message = `event: ${eventType}\ndata: ${payload}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream may be closed
        }
      };

      /**
       * Send a generic message (no event type)
       */
      const sendMessage = (data: unknown): void => {
        try {
          const payload = JSON.stringify(data);
          const message = `data: ${payload}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream may be closed
        }
      };

      // Send initial connection confirmation
      sendEvent("connected", {
        status: "connected",
        timestamp: new Date().toISOString(),
        message: "Dashboard live updates connected",
      });

      // Subscribe to dashboard events
      const unsubscribe = eventBus.subscribe((event: DashboardEvent) => {
        // Send the event type and data
        sendMessage({
          type: event.type,
          id: event.id,
          timestamp: event.timestamp,
          data: "data" in event ? event.data : undefined,
        });
      });

      // Heartbeat to keep connection alive and detect disconnections
      const heartbeatInterval = setInterval(() => {
        sendEvent("heartbeat", {
          timestamp: new Date().toISOString(),
          subscriberCount: eventBus.getSubscriberCount(),
        });
      }, HEARTBEAT_INTERVAL);

      // Cleanup on abort/close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
