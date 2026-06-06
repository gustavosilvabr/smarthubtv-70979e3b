import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept-Encoding",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Cache-Control": "public, max-age=0",
  "Connection": "keep-alive",
  "Accept-Ranges": "bytes",
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

    // Bypass SSL certificate validation for IPTV servers with self-signed/invalid certs
    const prevReject = typeof process !== "undefined" ? process.env.NODE_TLS_REJECT_UNAUTHORIZED : undefined;
    if (typeof process !== "undefined") {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
      "Accept": "*/*",
      "Connection": "keep-alive",
      "Accept-Encoding": "gzip, deflate",
      "Cache-Control": "max-age=0",
    };
    const range = request.headers.get("range");
    if (range) upstreamHeaders["Range"] = range;

    let res: Response;
    try {
      res = await fetch(t, {
        method,
        headers: upstreamHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(28000),
      });
    } finally {
      // Restore original TLS setting after the request
      if (typeof process !== "undefined") {
        if (prevReject === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevReject;
        }
      }
    }

    const contentType = res.headers.get("content-type")?.toLowerCase() || "";
    const isVideoOrAudio = contentType.includes("video/") || contentType.includes("audio/");
    
    // Some cheap panels ignore the .m3u8 request and return a continuous .ts stream.
    // If we call await res.text() on an infinite video stream, the server hangs forever.
    // We only treat it as a playlist if it doesn't explicitly declare itself as video/audio.
    const isPlaylist = 
      /mpegurl|application\/vnd\.apple/i.test(contentType) || 
      (!isVideoOrAudio && /\.m3u8(\?|$)/i.test(t));

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
    return new Response(`Fetch failed: ${(e as Error).message}`, { status: 502, headers: CORS_HEADERS });
  }
}

function rewritePlaylist(text: string, baseUrl: string) {
  // Only rewrite segment/sub-playlist URLs so they pass through the proxy.
  // Do NOT mutate #EXT-X-TARGETDURATION or other tags — lying to the
  // player about segment duration breaks its buffer math and causes stalls.
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    try {
      const absolute = new URL(trimmed, baseUrl).toString();
      return `/api/stream?u=${encodeURIComponent(absolute)}`;
    } catch {
      return line;
    }
  }).join("\n");
}

