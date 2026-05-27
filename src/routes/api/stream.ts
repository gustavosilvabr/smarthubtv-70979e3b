import { createFileRoute } from "@tanstack/react-router";

// Proxy for stream URLs to bypass mixed-content / CORS for HLS playlists.
// Only proxies http/https URLs.
export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("u");
        if (!target) return new Response("Missing u", { status: 400 });
        try {
          const t = decodeURIComponent(target);
          if (!/^https?:\/\//i.test(t)) return new Response("Bad url", { status: 400 });
          const res = await fetch(t, {
            headers: { "User-Agent": "VLC/3.0.0 LibVLC/3.0.0" },
            redirect: "follow",
          });
          const headers = new Headers();
          const ct = res.headers.get("content-type");
          if (ct) headers.set("Content-Type", ct);
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Cache-Control", "no-store");
          return new Response(res.body, { status: res.status, headers });
        } catch (e) {
          return new Response(`Fetch failed: ${(e as Error).message}`, { status: 500 });
        }
      },
    },
  },
});
