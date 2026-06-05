export interface IptvSettings {
  server: string;
  username: string;
  password: string;
}

export const IPTV_SETTINGS_KEY = "smarthub:iptv-settings";
export const FAV_KEY = "smarthub:favorites";

export const DEFAULT_IPTV_SETTINGS: IptvSettings = {
  server: "",
  username: "",
  password: "",
};

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
