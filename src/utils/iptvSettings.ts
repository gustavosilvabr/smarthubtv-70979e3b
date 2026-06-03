export interface IptvSettings {
  server: string;
  username: string;
  password: string;
}

export const IPTV_SETTINGS_KEY = "flixtv:iptv-settings";

export const DEFAULT_IPTV_SETTINGS: IptvSettings = {
  server: "https://blckbr.shop",
  username: "janio798",
  password: "7338644862",
};

export function normalizeServerUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_IPTV_SETTINGS.server;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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