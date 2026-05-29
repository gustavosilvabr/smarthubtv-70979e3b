export type ContentType = "live" | "movie" | "series";

export interface M3UItem {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  fallbackUrl?: string;
  type: ContentType;
  streamId?: string | number;
}

export interface GroupedContent {
  group: string;
  items: M3UItem[];
}
