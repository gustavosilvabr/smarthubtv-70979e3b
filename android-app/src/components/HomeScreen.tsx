import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { Radio, Film, Tv, Heart, Settings, LogOut } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";

type TileTarget = "live" | "movies" | "series" | "favorites" | "settings";

interface Props {
  liveCount: number;
  movieCount: number;
  seriesCount: number;
  favoritesCount: number;
  onNavigate: (target: TileTarget) => void;
  onLogout: () => void;
}

interface TileConfig {
  id: TileTarget;
  icon: React.ComponentType<any>;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  getCount: (p: Props) => number;
}

const TILES: TileConfig[] = [
  {
    id: "live",
    icon: Radio,
    label: "TV Ao Vivo",
    sublabel: "Canais IPTV",
    color: "#4ade80",
    bgColor: "rgba(74, 222, 128, 0.12)",
    getCount: (p) => p.liveCount,
  },
  {
    id: "movies",
    icon: Film,
    label: "Filmes",
    sublabel: "VOD",
    color: "#fb923c",
    bgColor: "rgba(251, 146, 60, 0.12)",
    getCount: (p) => p.movieCount,
  },
  {
    id: "series",
    icon: Tv,
    label: "Séries",
    sublabel: "TV Shows",
    color: "#e879f9",
    bgColor: "rgba(232, 121, 249, 0.12)",
    getCount: (p) => p.seriesCount,
  },
  {
    id: "favorites",
    icon: Heart,
    label: "Favoritos",
    sublabel: "Minha lista",
    color: "#f43f5e",
    bgColor: "rgba(244, 63, 94, 0.12)",
    getCount: (p) => p.favoritesCount,
  },
  {
    id: "settings",
    icon: Settings,
    label: "Configurações",
    sublabel: "Servidor & conta",
    color: "#94a3b8",
    bgColor: "rgba(148, 163, 184, 0.10)",
    getCount: () => 0,
  },
];

function AnimatedTile({
  tile,
  delay,
  props,
}: {
  tile: TileConfig;
  delay: number;
  props: Props;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const Icon = tile.icon;
  const count = tile.getCount(props);

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ translateY }, { scale }] },
        styles.tileWrapper,
      ]}
    >
      <TouchableOpacity
        style={[styles.tile, { backgroundColor: tile.bgColor, borderColor: tile.color + "30" }]}
        onPress={() => props.onNavigate(tile.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.tileIconWrapper, { backgroundColor: tile.color + "20" }]}>
          <Icon size={32} color={tile.color} />
        </View>
        <Text style={[styles.tileLabel, { color: "#fff" }]}>{tile.label}</Text>
        <Text style={styles.tileSub}>{tile.sublabel}</Text>
        {count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: tile.color + "25", borderColor: tile.color + "40" }]}>
            <Text style={[styles.countText, { color: tile.color }]}>
              {count.toLocaleString()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function HomeScreen(props: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [logoOpacity, logoY]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <View style={styles.content}>
        {/* Logo no topo */}
        <Animated.View style={[styles.logoRow, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Bem-vindo ao SmartHub</Text>
        </Animated.View>

        {/* Grid de Tiles */}
        <View style={styles.tilesGrid}>
          {TILES.map((tile, i) => (
            <AnimatedTile
              key={tile.id}
              tile={tile}
              delay={100 + i * 80}
              props={props}
            />
          ))}
        </View>

        {/* Botão de Logout */}
        <Animated.View style={{ opacity: logoOpacity }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={props.onLogout} activeOpacity={0.7}>
            <LogOut size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.logoutText}>Sair / Trocar servidor</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050308" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 10,
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: { width: 240, height: 90, marginBottom: 6 },
  welcomeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    maxWidth: 900,
  },
  tileWrapper: {
    width: 155,
    height: 155,
  },
  tile: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  tileIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  tileSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  countText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    padding: 8,
  },
  logoutText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
});
