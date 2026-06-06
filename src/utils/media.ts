import type { ContentType } from "@/types/iptv";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function normalizeLogoUrl(server: string, icon?: string): string {
  const raw = decodeHtmlEntities((icon || "").trim());
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const base = server.replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${base}${raw}`;
  return `${base}/${raw.replace(/^\/+/, "")}`;
}

export function getDisplayImageUrl(url: string, serverBase?: string) {
  let clean = decodeHtmlEntities(url.trim());
  if (!clean) return "";
  if (/^(data|blob):/i.test(clean)) return clean;

  if (clean.startsWith("//")) {
    clean = `https:${clean}`;
  } else if (!/^https?:\/\//i.test(clean) && serverBase) {
    clean = normalizeLogoUrl(serverBase, clean);
  }

  if (!/^https?:\/\//i.test(clean)) return "";

  if (typeof window !== "undefined") {
    const isLocal = clean.startsWith(window.location.origin) || clean.startsWith("/");
    if (!isLocal && window.location.protocol === "https:" && clean.startsWith("http:")) {
      return `/api/stream?u=${encodeURIComponent(clean)}`;
    }
  }

  return clean;
}

export function imageKindLabel(type: ContentType) {
  if (type === "live") return "CANAL";
  if (type === "series") return "SÉRIE";
  return "FILME";
}
