import { parseTriggerInvocation } from "@neon/functions/triggers";

export default {
  async fetch(request: Request): Promise<Response> {
    const invocation = await parseTriggerInvocation(request);
    if (!invocation.ok) {
      return new Response("Unauthorized trigger", { status: 401 });
    }

    const target = process.env.ESCROW_CRON_URL;
    const secret = process.env.NEON_TRIGGER_SECRET;
    if (!target || !secret) {
      console.error("Escrow cron configuration is incomplete.");
      return new Response("Cron configuration unavailable", { status: 500 });
    }

    try {
      const response = await fetch(target, {
        method: "GET",
        headers: { "x-neon-cron-secret": secret },
        signal: AbortSignal.timeout(55_000),
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { "content-type": response.headers.get("content-type") ?? "text/plain" },
      });
    } catch (error) {
      console.error("Escrow cron request failed:", error);
      return new Response("Escrow cron request failed", { status: 502 });
    }
  },
};
