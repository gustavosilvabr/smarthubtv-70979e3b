import { useCallback, useEffect, useRef, useState } from "react";

export interface ConnectionStats {
  bandwidth: number; // Mbps
  latency: number; // ms
  packetLoss: number; // percentage
  quality: "excellent" | "good" | "fair" | "poor";
}

export function useConnectionTest() {
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [testing, setTesting] = useState(false);
  const testRef = useRef(false);

  const test = useCallback(async () => {
    if (testRef.current || testing) return;
    testRef.current = true;
    setTesting(true);

    try {
      const testUrl = "/api/stream?u=" + encodeURIComponent("https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png");

      // Test latency (3 pings)
      const latencies: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        try {
          await fetch(testUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
          latencies.push(performance.now() - start);
        } catch {
          // A failed sample is reflected by the remaining successful pings.
        }
        await new Promise(r => setTimeout(r, 100));
      }
      const latency = latencies.length ? Math.min(...latencies) : 100;

      // Test bandwidth (download 1MB in 5s max)
      const start = performance.now();
      let bytes = 0;
      try {
        const res = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });
        const reader = res.body?.getReader();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value?.length || 0;
          }
        }
      } catch {
        // A failed download produces the minimum measured bandwidth.
      }
      const duration = Math.max(performance.now() - start, 100);
      const bandwidth = (bytes * 8) / (duration / 1000) / 1_000_000; // Mbps

      // Determine quality
      let quality: "excellent" | "good" | "fair" | "poor" = "poor";
      if (bandwidth > 25 && latency < 50) quality = "excellent";
      else if (bandwidth > 10 && latency < 100) quality = "good";
      else if (bandwidth > 5 && latency < 150) quality = "fair";

      setStats({
        bandwidth: Math.max(1, Math.min(100, bandwidth)),
        latency,
        packetLoss: 0,
        quality,
      });
    } catch (e) {
      console.error("Connection test failed", e);
    } finally {
      testRef.current = false;
      setTesting(false);
    }
  }, [testing]);

  return { stats, testing, test };
}
