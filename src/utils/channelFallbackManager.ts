export type FallbackState = "initial" | "retry" | "quality_downgrade" | "format_switch" | "failed";

export interface FallbackContext {
  channelId: string;
  channelName: string;
  attemptCount: number;
  currentState: FallbackState;
  qualityDowngraded: boolean;
  formatSwitched: boolean;
}

export class ChannelFallbackManager {
  private context: FallbackContext;
  private stateChangeCallbacks: Array<(state: FallbackState, message: string) => void> = [];
  private MAX_RETRIES = 3;

  constructor(channelId: string, channelName: string) {
    this.context = {
      channelId,
      channelName,
      attemptCount: 0,
      currentState: "initial",
      qualityDowngraded: false,
      formatSwitched: false,
    };
  }

  onStateChange(callback: (state: FallbackState, message: string) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  private emitStateChange(state: FallbackState, message: string): void {
    this.context.currentState = state;
    this.stateChangeCallbacks.forEach((cb) => cb(state, message));
  }

  startRetry(): void {
    if (this.context.attemptCount >= this.MAX_RETRIES) {
      this.fail();
      return;
    }

    this.context.attemptCount++;
    this.emitStateChange(
      "retry",
      "Canal instável. Tentando melhorar a reprodução automaticamente..."
    );
  }

  downgradeQuality(): void {
    if (this.context.qualityDowngraded) {
      this.switchFormat();
      return;
    }

    this.context.qualityDowngraded = true;
    this.emitStateChange(
      "quality_downgrade",
      "Reduzindo qualidade para melhorar estabilidade..."
    );
  }

  switchFormat(): void {
    if (this.context.formatSwitched) {
      this.fail();
      return;
    }

    this.context.formatSwitched = true;
    this.emitStateChange("format_switch", "Ativando modo compatibilidade...");
  }

  fail(): void {
    this.emitStateChange(
      "failed",
      "Este canal está instável no momento. Tente outro canal ou ative o modo estabilidade."
    );
  }

  reset(): void {
    this.context.attemptCount = 0;
    this.context.qualityDowngraded = false;
    this.context.formatSwitched = false;
    this.context.currentState = "initial";
  }

  getContext(): FallbackContext {
    return { ...this.context };
  }

  canRetry(): boolean {
    return this.context.attemptCount < this.MAX_RETRIES && this.context.currentState !== "failed";
  }

  canDowngradeQuality(): boolean {
    return !this.context.qualityDowngraded;
  }

  canSwitchFormat(): boolean {
    return !this.context.formatSwitched;
  }
}
