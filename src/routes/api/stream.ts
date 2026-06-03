import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Cache-Control": "no-store",
};

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      }),
      HEAD: async ({ request }) => handle(request, "HEAD"),
      GET: async ({ request }) => handle(request, "GET"),
    },
  },
});

async function handle(request: Request, method: "GET" | "HEAD") {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  if (!target) return new Response("Missing u", { status: 400, headers: CORS_HEADERS });
  try {
    const t = decodeURIComponent(target);
    if (!/^https?:\/\//i.test(t)) return new Response("Bad url", { status: 400, headers: CORS_HEADERS });

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

    const contentType = res.headers.get("content-type") || "";
    const isPlaylist = /mpegurl|application\/vnd\.apple/i.test(contentType) || /\.m3u8(\?|$)/i.test(t);

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
    Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));

    if (method === "GET" && isPlaylist) {
      headers.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      headers.delete("content-length");
      const playlist = rewritePlaylist(await res.text(), t);
      return new Response(playlist, { status: res.status, headers });
    }

    return new Response(method === "HEAD" ? null : res.body, {
      status: res.status,
      headers,
    });
  } catch (e) {
    return new Response(`Fetch failed: ${(e as Error).message}`, { status: 500, headers: CORS_HEADERS });
  }
}

function rewritePlaylist(text: string, baseUrl: string) {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const absolute = new URL(trimmed, baseUrl).toString();
    return `/api/stream?u=${encodeURIComponent(absolute)}`;
  }).join("\n");
}
