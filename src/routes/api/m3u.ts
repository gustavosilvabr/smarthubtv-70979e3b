import { createFileRoute } from "@tanstack/react-router";

const M3U_URL =
  "http://bydhold.shop/get.php?username=janio798&password=7338644862&type=m3u_plus&output=mpegts";

export const Route = createFileRoute("/api/m3u")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await fetch(M3U_URL, {
            headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
            redirect: "follow",
          });
          if (!res.ok || !res.body) {
            return new Response(`Upstream error: ${res.status}`, { status: 502 });
          }
          const headers = new Headers({
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          });
          const len = res.headers.get("content-length");
          if (len) headers.set("Content-Length", len);
          // stream directly, no buffering
          return new Response(res.body, { status: 200, headers });
        } catch (e) {
          return new Response(`Fetch failed: ${(e as Error).message}`, { status: 500 });
        }
      },
    },
  },
});
