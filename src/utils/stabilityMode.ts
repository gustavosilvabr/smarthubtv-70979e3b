export type StoredQualityLevel = "low" | "medium" | "high" | "auto";

export interface StoredStabilityModeConfig {
  enabled: boolean;
  qualityLevel: StoredQualityLevel;
}

export const STABILITY_MODE_STORAGE_KEY = "iptv-stability-mode";
export const STABILITY_QUALITY_STORAGE_KEY = "iptv-stability-quality";
export const STABILITY_MODE_CHANGE_EVENT = "iptv:stability-mode-change";

const LEGACY_CONFIG_KEY = "iptv_stability_mode";
const LEGACY_BOOLEAN_KEY = "smarthub:stability-mode";
const DEFAULT_CONFIG: StoredStabilityModeConfig = {
  enabled: true,
  qualityLevel: "auto",
};

function isQualityLevel(value: unknown): value is StoredQualityLevel {
  return value === "low" || value === "medium" || value === "high" || value === "auto";
}

function readLegacyConfig(): StoredStabilityModeConfig | null {
  const legacyConfig = localStorage.getItem(LEGACY_CONFIG_KEY);
  if (legacyConfig) {
    try {
      const parsed = JSON.parse(legacyConfig) as Partial<StoredStabilityModeConfig>;
      if (typeof parsed.enabled === "boolean") {
        return {
          enabled: parsed.enabled,
          qualityLevel: isQualityLevel(parsed.qualityLevel) ? parsed.qualityLevel : "auto",
        };
      }
    } catch {
      // Continue with the legacy boolean value.
    }
  }

  const legacyBoolean = localStorage.getItem(LEGACY_BOOLEAN_KEY);
  if (legacyBoolean === "true" || legacyBoolean === "false") {
    return { enabled: legacyBoolean === "true", qualityLevel: "auto" };
  }

  return null;
}

export function getStabilityConfig(
  fallback: StoredStabilityModeConfig = DEFAULT_CONFIG,
): StoredStabilityModeConfig {
  if (typeof window === "undefined") return fallback;

  try {
    const enabledValue = localStorage.getItem(STABILITY_MODE_STORAGE_KEY);
    const qualityValue = localStorage.getItem(STABILITY_QUALITY_STORAGE_KEY);

    if (enabledValue === "true" || enabledValue === "false") {
      return {
        enabled: enabledValue === "true",
        qualityLevel: isQualityLevel(qualityValue) ? qualityValue : fallback.qualityLevel,
      };
    }

    const legacy = readLegacyConfig();
    if (legacy) {
      localStorage.setItem(STABILITY_MODE_STORAGE_KEY, String(legacy.enabled));
      localStorage.setItem(STABILITY_QUALITY_STORAGE_KEY, legacy.qualityLevel);
      return legacy;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function setStabilityConfig(config: StoredStabilityModeConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STABILITY_MODE_STORAGE_KEY, String(config.enabled));
    localStorage.setItem(STABILITY_QUALITY_STORAGE_KEY, config.qualityLevel);
    window.dispatchEvent(new CustomEvent(STABILITY_MODE_CHANGE_EVENT, { detail: config }));
  } catch {
    console.warn("Nao foi possivel salvar a preferencia de estabilidade");
  }
}

export function getStabilityMode(): boolean {
  return getStabilityConfig().enabled;
}

export function setStabilityMode(enabled: boolean): void {
  const current = getStabilityConfig();
  setStabilityConfig({ ...current, enabled });
}

export function toggleStabilityMode(): boolean {
  const next = !getStabilityMode();
  setStabilityMode(next);
  return next;
}
