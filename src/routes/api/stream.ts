import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
        },
      }),
      HEAD: async ({ request }) => handle(request, "HEAD"),
      GET: async ({ request }) => handle(request, "GET"),
    },
  },
});

async function handle(request: Request, method: "GET" | "HEAD") {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  if (!target) return new Response("Missing u", { status: 400 });
  try {
    const t = decodeURIComponent(target);
    if (!/^https?:\/\//i.test(t)) return new Response("Bad url", { status: 400 });

    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
    };
    const range = request.headers.get("range");
    if (range) upstreamHeaders["Range"] = range;

    const res = await fetch(t, {
      method,
      headers: upstreamHeaders,
      redirect: "follow",
    });

    const headers = new Headers();
    const forward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "last-modified",
      "etag",
    ];
    for (const h of forward) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("accept-ranges")) headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    headers.set("Cache-Control", "no-store");

    return new Response(method === "HEAD" ? null : res.body, {
      status: res.status,
      headers,
    });
  } catch (e) {
    return new Response(`Fetch failed: ${(e as Error).message}`, { status: 500 });
  }
}
