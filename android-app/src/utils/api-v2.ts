import { Platform } from 'react-native';
import type {
  IptvSettings,
  M3UItem,
  XtreamCategory,
  XtreamStream,
  XtreamVOD,
  XtreamSeries,
  XtreamSeriesEpisodes,
  FetchProgress,
} from '../types/iptv';

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function b64decode(str: string): string {
  if (!str) return '';
  try {
    return decodeURIComponent(
      Buffer.from(str, 'base64')
        .toString('utf8')
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return str;
  }
}

async function xtreamFetch<T = any>(
  settings: IptvSettings,
  action: string,
  extraParams: string = ''
): Promise<T> {
  const server = cleanUrl(settings.server);
  const username = encodeURIComponent(settings.username);
  const password = encodeURIComponent(settings.password);

  const url = `${server}/player_api.php?username=${username}&password=${password}&action=${action}${extraParams}`;

  const headers: Record<string, string> = {
    'Connection': 'keep-alive',
  };

  if (Platform.OS !== 'web') {
    headers['User-Agent'] = 'VLC/3.0.20 LibVLC/3.0.20';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, { headers, signal: controller.signal });

    if (!res.ok) {
      throw new Error(`Xtream API respondeu com ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateCredentials(settings: IptvSettings): Promise<boolean> {
  try {
    const server = cleanUrl(settings.server);
    const username = encodeURIComponent(settings.username);
    const password = encodeURIComponent(settings.password);

    const url = `${server}/player_api.php?username=${username}&password=${password}`;

    const headers: Record<string, string> = {};
    if (Platform.OS !== 'web') {
      headers['User-Agent'] = 'VLC/3.0.20 LibVLC/3.0.20';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) return false;

      const data = await res.json();
      return !!(data?.user_info?.auth === 1 || data?.user_info?.status === 'Active');
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error('Credential validation failed:', e);
    return false;
  }
}

export async function fetchIptvData(
  settings: IptvSettings,
  onProgress: (progress: FetchProgress) => void
): Promise<M3UItem[]> {
  const items: M3UItem[] = [];
  const server = cleanUrl(settings.server);
  const { username, password } = settings;

  // Phase 1: Live TV
  try {
    onProgress({ stage: 'live' });

    const [liveCats, liveStreams] = await Promise.all([
      xtreamFetch<XtreamCategory[]>(settings, 'get_live_categories'),
      xtreamFetch<XtreamStream[]>(settings, 'get_live_streams'),
    ]);

    const liveCatMap = new Map<string, string>(
      (liveCats || []).map((c) => [String(c.category_id), c.category_name])
    );

    if (Array.isArray(liveStreams)) {
      for (const ch of liveStreams) {
        if (!ch.stream_id) continue;

        const group = liveCatMap.get(String(ch.category_id)) || 'Live Channels';
        const hlsUrl = `${server}/live/${username}/${password}/${ch.stream_id}.m3u8`;
        const tsUrl = `${server}/live/${username}/${password}/${ch.stream_id}.ts`;

        items.push({
          name: ch.name || `Channel ${ch.stream_id}`,
          url: hlsUrl,
          group,
          logo: ch.stream_icon || undefined,
          type: 'live',
          fallbackUrl: tsUrl,
        });
      }
    }

    onProgress({ stage: 'live', itemsLoaded: items.length, total: items.length });
  } catch (err) {
    console.error('Live channels fetch error:', err);
  }

  // Phase 2: VOD
  const vodStartCount = items.length;
  try {
    onProgress({ stage: 'vod', itemsLoaded: vodStartCount });

    const [vodCats, vodStreams] = await Promise.all([
      xtreamFetch<XtreamCategory[]>(settings, 'get_vod_categories'),
      xtreamFetch<XtreamVOD[]>(settings, 'get_vod_streams'),
    ]);

    const vodCatMap = new Map<string, string>(
      (vodCats || []).map((c) => [String(c.category_id), c.category_name])
    );

    if (Array.isArray(vodStreams)) {
      for (const m of vodStreams) {
        if (!m.stream_id) continue;

        const ext = (m.container_extension || 'mp4').replace(/^\./, '');
        const group = vodCatMap.get(String(m.category_id)) || 'Movies';
        const movieUrl = `${server}/movie/${username}/${password}/${m.stream_id}.${ext}`;

        items.push({
          name: m.name || `Movie ${m.stream_id}`,
          url: movieUrl,
          group,
          logo: m.stream_icon || undefined,
          type: 'vod',
        });
      }
    }

    onProgress({ stage: 'vod', itemsLoaded: items.length, total: items.length });
  } catch (err) {
    console.error('VOD fetch error:', err);
  }

  // Phase 3: Series
  const seriesStartCount = items.length;
  try {
    onProgress({ stage: 'series', itemsLoaded: seriesStartCount });

    const [seriesCats, seriesList] = await Promise.all([
      xtreamFetch<XtreamCategory[]>(settings, 'get_series_categories'),
      xtreamFetch<XtreamSeries[]>(settings, 'get_series'),
    ]);

    const seriesCatMap = new Map<string, string>(
      (seriesCats || []).map((c) => [String(c.category_id), c.category_name])
    );

    if (Array.isArray(seriesList)) {
      for (const s of seriesList) {
        if (!s.series_id) continue;

        const group = seriesCatMap.get(String(s.category_id)) || 'Series';
        const placeholderUrl = `xtream-series://${s.series_id}`;

        items.push({
          name: s.name || `Series ${s.series_id}`,
          url: placeholderUrl,
          group,
          logo: s.cover || undefined,
          type: 'series',
          info: {
            plot: s.plot,
            poster: s.cover,
            backdrop: s.backdrop,
            rating: s.rating_5based ? parseFloat(s.rating_5based) : undefined,
          },
        });
      }
    }

    onProgress({ stage: 'series', itemsLoaded: items.length, total: items.length });
  } catch (err) {
    console.error('Series fetch error:', err);
  }

  onProgress({ stage: 'complete', itemsLoaded: items.length, total: items.length });
  return items;
}

export async function fetchSeriesEpisodes(
  settings: IptvSettings,
  seriesId: string | number
): Promise<Map<number, Array<{ id: string; title: string; url: string }>>> {
  try {
    const server = cleanUrl(settings.server);
    const { username, password } = settings;

    const data = await xtreamFetch<XtreamSeriesEpisodes>(
      settings,
      'get_series_info',
      `&series_id=${seriesId}`
    );

    const episodeMap = new Map<number, Array<{ id: string; title: string; url: string }>>();

    if (data?.episodes) {
      for (const [seasonStr, episodes] of Object.entries(data.episodes)) {
        const season = parseInt(seasonStr, 10);
        const eps: Array<{ id: string; title: string; url: string }> = [];

        for (const ep of episodes) {
          if (ep.id) {
            eps.push({
              id: ep.id,
              title: ep.title || `Episode ${ep.episode_num}`,
              url: `${server}/series/${username}/${password}/${ep.id}.${ep.container_extension || 'mkv'}`,
            });
          }
        }

        if (eps.length > 0) {
          episodeMap.set(season, eps);
        }
      }
    }

    return episodeMap;
  } catch (err) {
    console.error('Fetch series episodes error:', err);
    return new Map();
  }
}

export function buildStreamUrl(
  settings: IptvSettings,
  streamId: string | number,
  type: 'live' | 'vod' | 'series',
  extension: string = 'mp4'
): string {
  const server = cleanUrl(settings.server);
  const { username, password } = settings;

  switch (type) {
    case 'live':
      return `${server}/live/${username}/${password}/${streamId}.m3u8`;
    case 'vod':
      return `${server}/movie/${username}/${password}/${streamId}.${extension}`;
    case 'series':
      return `${server}/series/${username}/${password}/${streamId}.${extension}`;
    default:
      return '';
  }
}
