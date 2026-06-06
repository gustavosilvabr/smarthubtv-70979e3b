import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { M3UItem } from "../types/iptv";
import { IptvSettings, FAV_KEY } from "../utils/settings";
import { HomeScreen } from "./HomeScreen";
import { SettingsScreen } from "./SettingsScreen";
import { VideoPlayer } from "./VideoPlayer";
import { DashboardLayout } from "./DashboardLayout";
import { MobileSidebar } from "./MobileSidebar";
import { MobileHeader } from "./MobileHeader";
import { ContentGrid } from "./ContentGrid";
import { SeriesEpisodeModal } from "./SeriesEpisodeModal";

interface Props {
  items: M3UItem[];
  settings: IptvSettings;
  onLogout: () => void;
  onSaveSettings: (s: IptvSettings) => void;
  onRefresh: () => void;
}

type ScreenType = "home" | "dashboard" | "settings";
type ViewType = "live" | "movies" | "series";

interface Episode {
  id: string;
  title: string;
  url: string;
  season: number;
  episodeNum: string;
}

export function DashboardScreen({ items, settings, onLogout, onSaveSettings, onRefresh }: Props) {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites on mount
  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then((raw) => {
      if (raw) {
        try {
          setFavorites(new Set(JSON.parse(raw)));
        } catch {}
      }
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
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

  const goHome = useCallback(() => {
    setCurrentScreen("home");
  }, []);

  // HOME screen
  if (currentScreen === "home") {
    return (
      <HomeScreen
        liveCount={counts.live}
        movieCount={counts.movie}
        seriesCount={counts.series}
        favoritesCount={counts.favorites}
        onNavigate={(target) => setCurrentScreen(target)}
        onLogout={onLogout}
      />
    );
  }

  // SETTINGS screen
  if (currentScreen === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        onSave={onSaveSettings}
        onBack={goHome}
        onLogout={onLogout}
        liveCount={counts.live}
        movieCount={counts.movie}
        seriesCount={counts.series}
        onRefresh={onRefresh}
      />
    );
  }

  // LIVE TV screen
  if (currentScreen === "live") {
    const liveItems = items.filter((i) => i.type === "live");
    return (
      <LiveTvScreen
        items={liveItems}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBack={goHome}
        settings={settings}
      />
    );
  }

  // MOVIES screen
  if (currentScreen === "movies") {
    const movieItems = items.filter((i) => i.type === "movie");
    return (
      <MoviesScreen
        items={movieItems}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBack={goHome}
      />
    );
  }

  // SERIES screen
  if (currentScreen === "series") {
    const seriesItems = items.filter((i) => i.type === "series");
    return (
      <SeriesScreen
        items={seriesItems}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBack={goHome}
        settings={settings}
      />
    );
  }

  return null;
}
