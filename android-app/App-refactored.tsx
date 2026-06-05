import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LoginScreen } from './src/components/LoginScreen';
import { LoadingScreen } from './src/components/LoadingScreen';
import { DashboardScreen } from './src/components/DashboardScreen';
import { useSecureSettings } from './src/hooks/useSecureSettings';
import { usePerformanceMetrics } from './src/hooks/usePerformanceMetrics';
import { fetchIptvData, validateCredentials } from './src/utils/api-v2';
import type { IptvSettings, M3UItem, FetchProgress } from './src/types/iptv';

type AppStage = 'boot' | 'login' | 'loading' | 'ready';
type LoadingPhase = 'live' | 'vod' | 'series' | 'complete';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { settings, loading: settingsLoading, saveSettings, clearSettings } = useSecureSettings();
  const { autoTest } = usePerformanceMetrics();

  const [stage, setStage] = useState<AppStage>('boot');
  const [currentSettings, setCurrentSettings] = useState<IptvSettings>({
    server: '',
    username: '',
    password: '',
    protocol: 'http',
  });
  const [items, setItems] = useState<M3UItem[]>([]);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('live');
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Boot phase: Load saved settings
  useEffect(() => {
    if (!fontsLoaded || settingsLoading) return;

    if (settings) {
      setCurrentSettings(settings);
      setStage('loading');
    } else {
      setStage('login');
    }
  }, [fontsLoaded, settingsLoading, settings]);

  // Loading phase: Fetch IPTV data
  useEffect(() => {
    if (stage !== 'loading') return;

    const { server, username, password } = currentSettings;
    if (!server || !username || !password) {
      setStage('login');
      return;
    }

    let active = true;
    setLoadingError(null);

    const loadData = async () => {
      try {
        // Validate credentials first
        const valid = await validateCredentials(currentSettings);
        if (!active) return;

        if (!valid) {
          setLoadingError('Credenciais inválidas. Verifique usuário, senha e servidor.');
          setStage('login');
          return;
        }

        // Fetch all IPTV data
        const result = await fetchIptvData(currentSettings, (progress) => {
          if (active) {
            setLoadingPhase(progress.stage as LoadingPhase);
          }
        });

        if (!active) return;

        if (result.length === 0) {
          setLoadingError('Nenhum canal/filme encontrado. Verifique suas credenciais.');
          setStage('login');
          return;
        }

        // Save settings securely
        await saveSettings(currentSettings);
        setItems(result);
        setStage('ready');

        // Run performance test in background
        autoTest().catch(console.error);
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setLoadingError(`Erro ao sincronizar: ${msg}`);
        console.error('Data fetch failed:', err);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [stage, currentSettings, saveSettings, autoTest]);

  const handleLogin = useCallback(
    (newSettings: IptvSettings) => {
      setCurrentSettings(newSettings);
      setStage('loading');
    },
    []
  );

  const handleLogout = useCallback(async () => {
    setStage('login');
    setItems([]);
    setCurrentSettings({ server: '', username: '', password: '', protocol: 'http' });
    await clearSettings();
  }, [clearSettings]);

  const handleRefresh = useCallback(() => {
    setStage('loading');
    setItems([]);
  }, []);

  // Boot screen
  if (!fontsLoaded || stage === 'boot') {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.appContainer}>
      <StatusBar style="light" hidden />

      {stage === 'login' && <LoginScreen onSubmit={handleLogin} initial={currentSettings} />}

      {stage === 'loading' && (
        <LoadingScreen phase={loadingPhase} error={loadingError} onLogout={handleLogout} />
      )}

      {stage === 'ready' && (
        <DashboardScreen
          items={items}
          settings={currentSettings}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: '#050308',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#050308',
  },
});
