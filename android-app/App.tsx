import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { LoginScreen } from "./src/components/LoginScreen";
import { LoadingScreen, LoadingStage } from "./src/components/LoadingScreen";
import { DashboardScreen } from "./src/components/DashboardScreen";
import { IptvSettings, IPTV_SETTINGS_KEY, DEFAULT_IPTV_SETTINGS } from "./src/utils/settings";
import { fetchIptvData, M3UItem } from "./src/utils/api";

type ScreenStage = "boot" | "login" | "loading" | "ready";

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [stage, setStage] = useState<ScreenStage>("boot");
  const [settings, setSettings] = useState<IptvSettings>(DEFAULT_IPTV_SETTINGS);
  const [items, setItems] = useState<M3UItem[]>([]);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("live");
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // 1. Boot: Carrega as credenciais salvas no AsyncStorage
  useEffect(() => {
    if (!fontsLoaded) return;

    AsyncStorage.getItem(IPTV_SETTINGS_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as IptvSettings;
          if (parsed && parsed.server && parsed.username && parsed.password) {
            setSettings(parsed);
            setStage("loading");
            return;
          }
        }
        setStage("login");
      })
      .catch(() => {
        setStage("login");
      });
  }, [fontsLoaded]);

  // 2. Fetcher: Carrega canais, filmes e séries ao entrar no estado "loading"
  useEffect(() => {
    if (stage !== "loading") return;
    if (!settings.server || !settings.username || !settings.password) {
      setStage("login");
      return;
    }

    let active = true;
    setLoadingError(null);

    // Salva as configurações de login localmente
    AsyncStorage.setItem(IPTV_SETTINGS_KEY, JSON.stringify(settings));

    fetchIptvData(settings, (currentPhase) => {
      if (active) {
        setLoadingStage(currentPhase);
      }
    })
      .then((res) => {
        if (!active) return;
        if (res && res.length > 0) {
          setItems(res);
          setStage("ready");
        } else {
          setLoadingError(
            "Nenhum canal/filme retornado. Verifique seu usuário/senha ou servidor."
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadingError(err.message || "Erro de conexão ao sincronizar com o servidor.");
      });

    return () => {
      active = false;
    };
  }, [stage, settings]);

  const handleLoginSubmit = (newSettings: IptvSettings) => {
    setSettings(newSettings);
    setStage("loading");
  };

  const handleLogout = async () => {
    setStage("login");
    setItems([]);
    await AsyncStorage.removeItem(IPTV_SETTINGS_KEY);
  };

  const handleSaveSettings = async (newSettings: IptvSettings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem(IPTV_SETTINGS_KEY, JSON.stringify(newSettings));
    setStage("loading");
  };

  // Enquanto as fontes carregam ou inicializa o boot, exibe uma tela preta de loading
  if (!fontsLoaded || stage === "boot") {
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

      {stage === "login" && (
        <LoginScreen onSubmit={handleLoginSubmit} initial={settings} />
      )}

      {stage === "loading" && (
        <LoadingScreen
          stage={loadingStage}
          error={loadingError}
          onLogout={handleLogout}
        />
      )}

      {stage === "ready" && (
        <DashboardScreen
          items={items}
          settings={settings}
          onLogout={handleLogout}
          onSaveSettings={handleSaveSettings}
          onRefresh={() => setStage("loading")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: "#050308",
    justifyContent: "center",
    alignItems: "center",
  },
  appContainer: {
    flex: 1,
    backgroundColor: "#050308",
  },
});
