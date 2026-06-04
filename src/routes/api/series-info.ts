import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_IPTV_SETTINGS, normalizeIptvSettings } from "@/utils/iptvSettings";

export interface SeriesEpisode {
  id: string;
  title: string;
  season: number;
  episode: number;
  url: string;
  cover?: string;
  duration?: string;
  plot?: string;
}

export interface SeriesInfoResponse {
  id: string;
  name: string;
  plot?: string;
  cover?: string;
  backdrop?: string;
  rating?: string;
  releaseDate?: string;
  genre?: string;
  cast?: string;
  director?: string;
  seasons: number[];
  episodes: SeriesEpisode[];
}

export const Route = createFileRoute("/api/series-info")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
          return new Response(JSON.stringify({ error: "missing id" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const settings = normalizeIptvSettings({
          server: url.searchParams.get("server") || DEFAULT_IPTV_SETTINGS.server,
          username: url.searchParams.get("username") || DEFAULT_IPTV_SETTINGS.username,
          password: url.searchParams.get("password") || DEFAULT_IPTV_SETTINGS.password,
        });

        try {
          const apiUrl = `${settings.server}/player_api.php?username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}&action=get_series_info&series_id=${encodeURIComponent(id)}`;
          const res = await fetch(apiUrl, {
            headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
            redirect: "follow",
          });
          if (!res.ok) throw new Error(`upstream ${res.status}`);
          const data = (await res.json()) as {
            info?: Record<string, string>;
            seasons?: Array<{ season_number?: number; cover?: string }>;
            episodes?: Record<string, Array<{
              id: string | number;
              title?: string;
              episode_num?: number | string;
              season?: number | string;
              container_extension?: string;
              info?: { movie_image?: string; duration?: string; plot?: string };
            }>>;
          };

          const out: SeriesEpisode[] = [];
          const seasonSet = new Set<number>();
          const eps = data.episodes || {};
          for (const seasonKey of Object.keys(eps)) {
            const seasonNum = Number(seasonKey) || 0;
            for (const ep of eps[seasonKey] || []) {
              const ext = (ep.container_extension || "mp4").replace(/^\./, "") || "mp4";
              const epUrl = `${settings.server}/series/${encodeURIComponent(settings.username)}/${encodeURIComponent(settings.password)}/${ep.id}.${ext}`;
              const season = Number(ep.season ?? seasonNum) || seasonNum;
              seasonSet.add(season);
              out.push({
                id: String(ep.id),
                title: ep.title || `Episódio ${ep.episode_num ?? ""}`.trim(),
                season,
                episode: Number(ep.episode_num) || 0,
                url: epUrl,
                cover: ep.info?.movie_image,
                duration: ep.info?.duration,
                plot: ep.info?.plot,
              });
            }
          }
          out.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));

          const info = data.info || {};
          const payload: SeriesInfoResponse = {
            id,
            name: info.name || "",
            plot: info.plot,
            cover: info.cover,
            backdrop: info.backdrop_path,
            rating: info.rating,
            releaseDate: info.releaseDate || info.release_date,
            genre: info.genre,
            cast: info.cast,
            director: info.director,
            seasons: [...seasonSet].sort((a, b) => a - b),
            episodes: out,
          };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
