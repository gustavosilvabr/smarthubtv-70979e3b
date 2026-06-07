const STABILITY_MODE_KEY = "smarthub:stability-mode";

export function getStabilityMode(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STABILITY_MODE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setStabilityMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STABILITY_MODE_KEY, String(enabled));
  } catch {
    console.warn("Não foi possível salvar preferência de modo estabilidade");
  }
}

export function toggleStabilityMode(): boolean {
  const current = getStabilityMode();
  const next = !current;
  setStabilityMode(next);
  return next;
}
