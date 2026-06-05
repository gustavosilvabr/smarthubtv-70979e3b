import { useCallback, useRef, useState } from 'react';

export interface PerformanceMetrics {
  bandwidth: number; // Mbps
  latency: number; // ms
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  lastUpdate: number;
}

const DEFAULT_BANDWIDTH = 10; // Mbps
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedMetrics: PerformanceMetrics | null = null;

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [testing, setTesting] = useState(false);
  const testRef = useRef(false);

  const test = useCallback(async () => {
    if (testRef.current || testing) return;

    // Return cached if still valid
    if (cachedMetrics && Date.now() - cachedMetrics.lastUpdate < CACHE_TTL) {
      setMetrics(cachedMetrics);
      return;
    }

    testRef.current = true;
    setTesting(true);

    try {
      // Test latency with 3 requests
      const latencies: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);

          await fetch('https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png', {
            method: 'HEAD',
            signal: controller.signal,
          });

          clearTimeout(timeout);
          latencies.push(performance.now() - start);
        } catch {
          // Continue on error
        }
        await new Promise(r => setTimeout(r, 100));
      }

      const latency = latencies.length ? Math.min(...latencies) : 100;

      // Test bandwidth with limited download
      let bandwidth = DEFAULT_BANDWIDTH;
      try {
        const start = performance.now();
        let bytes = 0;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (res.body) {
          const reader = res.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value?.length || 0;
            }
          } catch {
            // Continue
          }
        }

        const duration = Math.max((performance.now() - start) / 1000, 0.1);
        bandwidth = Math.max(1, Math.min(100, (bytes * 8) / duration / 1_000_000));
      } catch {
        bandwidth = DEFAULT_BANDWIDTH;
      }

      // Determine quality
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (bandwidth > 25 && latency < 50) quality = 'excellent';
      else if (bandwidth > 10 && latency < 100) quality = 'good';
      else if (bandwidth > 5 && latency < 150) quality = 'fair';

      const result: PerformanceMetrics = {
        bandwidth: Math.round(bandwidth * 10) / 10,
        latency: Math.round(latency),
        quality,
        lastUpdate: Date.now(),
      };

      cachedMetrics = result;
      setMetrics(result);
    } catch (e) {
      console.warn('Performance test failed:', e);
    } finally {
      testRef.current = false;
      setTesting(false);
    }
  }, [testing]);

  // Auto-test on mount (debounced)
  const autoTest = useCallback(async () => {
    // Run in background without blocking
    setTimeout(() => {
      test().catch(console.error);
    }, 500);
  }, [test]);

  return { metrics, testing, test, autoTest, getBandwidth: () => metrics?.bandwidth ?? DEFAULT_BANDWIDTH };
}
