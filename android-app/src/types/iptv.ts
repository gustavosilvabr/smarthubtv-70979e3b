export interface M3UItem {
  id: string;
  name: string;
  url: string;
  group: string;
  logo: string;
  type: 'live' | 'movie' | 'series';
  fallbackUrl?: string;
  streamId?: string | number;
  info?: SeriesInfo;
}

export interface SeriesInfo {
  plot?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  year?: number;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: string;
}

export interface XtreamStream {
  num: string;
  name: string;
  stream_type: string;
  stream_id: string;
  stream_icon: string;
  epg_channel_id?: string;
  added: string;
  is_adult: string;
  category_id: string;
  custom_sid?: string;
  tv_archive?: string;
  direct_source?: string;
  tv_archive_duration?: string;
}

export interface XtreamVOD {
  stream_id: string;
  name: string;
  o_name?: string;
  added: string;
  is_adult: string;
  category_id: string;
  container_extension: string;
  custom_sid?: string;
  stream_icon: string;
  rating?: string;
  rating_5based?: string;
  plot?: string;
  back_drop?: string[];
  duration_secs?: number;
}

export interface XtreamSeries {
  series_id: string;
  name: string;
  o_name?: string;
  added: string;
  is_adult: string;
  category_id: string;
  cover: string;
  backdrop?: string;
  plot?: string;
  rating?: string;
  rating_5based?: string;
}

export interface XtreamSeriesEpisodes {
  episodes: Record<string, XtreamEpisode[]>;
  info?: {
    name?: string;
    plot?: string;
    rating?: string;
    poster?: string;
    backdrop?: string;
  };
}

export interface XtreamEpisode {
  id: string;
  title: string;
  container_extension: string;
  added: string;
  season: string;
  episode_num: string;
  duration?: string;
  plot?: string;
  air_date?: string;
}

export interface IptvSettings {
  server: string;
  username: string;
  password: string;
  protocol?: 'http' | 'https';
  port?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FetchProgress {
  stage: 'live' | 'vod' | 'series' | 'complete';
  itemsLoaded?: number;
  total?: number;
}
