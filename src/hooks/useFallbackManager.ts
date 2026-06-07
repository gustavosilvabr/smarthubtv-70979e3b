import { useCallback, useState } from "react";
import { ChannelFallbackManager } from "@/utils/channelFallbackManager";

export interface FallbackMessage {
  text: string;
  type: "info" | "warning" | "error";
  visible: boolean;
}

export function useFallbackManager(channelId: string, channelName: string) {
  const [message, setMessage] = useState<FallbackMessage>({
    text: "",
    type: "info",
    visible: false,
  });

  const manager = new ChannelFallbackManager(channelId, channelName);

  const showMessage = useCallback((text: string, type: "info" | "warning" | "error" = "info") => {
    setMessage({ text, type, visible: true });
    if (type !== "error") {
      setTimeout(() => setMessage((prev) => ({ ...prev, visible: false })), 5000);
    }
  }, []);

  const hideMessage = useCallback(() => {
    setMessage((prev) => ({ ...prev, visible: false }));
  }, []);

  manager.onStateChange((state, msg) => {
    const typeMap = {
      initial: "info" as const,
      retry: "info" as const,
      quality_downgrade: "warning" as const,
      format_switch: "warning" as const,
      failed: "error" as const,
    };
    showMessage(msg, typeMap[state]);
  });

  return {
    manager,
    message,
    showMessage,
    hideMessage,
  };
}
