export type ContentType = "live" | "movie" | "series";

export interface M3UItem {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  type: ContentType;
}

export interface GroupedContent {
  group: string;
  items: M3UItem[];
}
