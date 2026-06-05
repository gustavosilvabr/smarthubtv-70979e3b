export interface IptvSettings {
  server: string;
  username: string;
  password: string;
}

export const IPTV_SETTINGS_KEY = "flixtv:iptv-settings";

export const DEFAULT_IPTV_SETTINGS: IptvSettings = {
  server: "",
  username: "",
  password: "",
};

export function hasStoredIptvSettings(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(IPTV_SETTINGS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<IptvSettings>;
    return Boolean(parsed?.server && parsed?.username && parsed?.password);
  } catch {
    return false;
  }
}

export function normalizeServerUrl(value: string) {
  let trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_IPTV_SETTINGS.server;

  // Force http:// protocol, replacing any existing http/https prefix
  trimmed = trimmed.replace(/^(https?):?\/*(.*)$/i, (_, __, rest) => {
    return `http://${rest}`;
  });

  // If there is still no protocol, prefix with http://
  if (!/^http:\/\//.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }

  return trimmed;
}

export function normalizeIptvSettings(settings: IptvSettings): IptvSettings {
  return {
    server: normalizeServerUrl(settings.server),
    username: settings.username.trim(),
    password: settings.password.trim(),
  };
}

export function settingsToQuery(settings: IptvSettings) {
  const clean = normalizeIptvSettings(settings);
  const params = new URLSearchParams({
    server: clean.server,
    username: clean.username,
    password: clean.password,
  });
  return params.toString();
}