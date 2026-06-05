import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { M3UItem } from "../utils/api";
import { IptvSettings, FAV_KEY } from "../utils/settings";
import { HomeScreen } from "./HomeScreen";
import { LiveTvScreen } from "./LiveTvScreen";
import { MoviesScreen } from "./MoviesScreen";
import { SeriesScreen } from "./SeriesScreen";
import { SettingsScreen } from "./SettingsScreen";

interface Props {
  items: M3UItem[];
  settings: IptvSettings;
  onLogout: () => void;
  onSaveSettings: (s: IptvSettings) => void;
  onRefresh: () => void;
}

type ScreenType = "home" | "live" | "movies" | "series" | "settings";

export function DashboardScreen({ items, settings, onLogout, onSaveSettings, onRefresh }: Props) {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [initialCategory, setInitialCategory] = useState<string>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // 1. Carregar favoritos ao montar
  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then((raw) => {
      if (raw) {
        try {
          setFavorites(new Set(JSON.parse(raw)));
        } catch {}
      }
    });
  }, []);

  // 2. Alternar Favorito
  const toggleFavorite = useCallback(async (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      AsyncStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // 3. Contadores
  const counts = useMemo(() => {
    let live = 0;
    let movie = 0;
    let series = 0;
    for (const it of items) {
      if (it.type === "live") live++;
      else if (it.type === "movie") movie++;
      else if (it.type === "series") series++;
    }
    return { live, movie, series, favorites: favorites.size };
  }, [items, favorites]);

  // 4. Lógica de Navegação / Cliques no Home
  const handleNavigate = useCallback((target: "live" | "movies" | "series" | "favorites" | "settings") => {
    if (target === "favorites") {
      if (favorites.size === 0) {
        Alert.alert("Favoritos", "Sua lista de favoritos está vazia. Adicione canais, filmes ou séries para vê-los aqui.");
        return;
      }
      Alert.alert(
        "Ver Favoritos",
        "Escolha qual seção deseja abrir filtrada pelos seus favoritos:",
        [
          {
            text: "📺 TV Ao Vivo",
            onPress: () => {
              setInitialCategory("favorites");
              setCurrentScreen("live");
            },
          },
          {
            text: "🎬 Filmes",
            onPress: () => {
              setInitialCategory("favorites");
              setCurrentScreen("movies");
            },
          },
          {
            text: "🍿 Séries",
            onPress: () => {
              setInitialCategory("favorites");
              setCurrentScreen("series");
            },
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
    } else {
      setInitialCategory("all");
      setCurrentScreen(target);
    }
  }, [favorites]);

  const handleBack = useCallback(() => {
    setCurrentScreen("home");
  }, []);

  // 5. Renderizar Tela Ativa
  switch (currentScreen) {
    case "live":
      return (
        <LiveTvScreen
          items={items}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onBack={handleBack}
          settings={settings}
          initialCategory={initialCategory}
        />
      );
    case "movies":
      return (
        <MoviesScreen
          items={items}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onBack={handleBack}
          initialCategory={initialCategory}
        />
      );
    case "series":
      return (
        <SeriesScreen
          items={items}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onBack={handleBack}
          settings={settings}
          initialCategory={initialCategory}
        />
      );
    case "settings":
      return (
        <SettingsScreen
          settings={settings}
          onSave={onSaveSettings}
          onBack={handleBack}
          onLogout={onLogout}
          liveCount={counts.live}
          movieCount={counts.movie}
          seriesCount={counts.series}
          onRefresh={onRefresh}
        />
      );
    case "home":
    default:
      return (
        <HomeScreen
          liveCount={counts.live}
          movieCount={counts.movie}
          seriesCount={counts.series}
          favoritesCount={counts.favorites}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />
      );
  }
}
