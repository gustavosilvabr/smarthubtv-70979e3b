import type { ContentType } from "@/types/iptv";

export function getDisplayImageUrl(url: string) {
  const clean = url.trim();
  if (!clean) return "";
  if (/^(data|blob):/i.test(clean)) return clean;
  if (!/^https?:\/\//i.test(clean)) return "";

  if (typeof window !== "undefined" && window.location.protocol === "https:" && clean.startsWith("http:")) {
    return `/api/stream?u=${encodeURIComponent(clean)}`;
  }

  return clean;
}

export function imageKindLabel(type: ContentType) {
  if (type === "live") return "CANAL";
  if (type === "series") return "SÉRIE";
  return "FILME";
}