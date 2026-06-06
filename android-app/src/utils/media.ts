export function normalizeLogoUrl(server: string, icon?: string): string {
  const raw = (icon || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const base = server.replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${base}${raw}`;
  return `${base}/${raw.replace(/^\/+/, "")}`;
}
