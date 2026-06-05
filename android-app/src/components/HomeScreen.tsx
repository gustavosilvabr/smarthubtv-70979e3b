import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  LinearGradient,
} from "react-native";
import { Radio, Film, Tv, Settings, LogOut } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";

type TileTarget = "live" | "movies" | "series" | "settings";

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
  colors: string[];
  getCount: (p: Props) => number;
}

const TILES: TileConfig[] = [
  {
    id: "live",
    icon: Radio,
    label: "TV AO VIVO",
    sublabel: "CANAIS",
    colors: ["#00d9ff", "#0099cc"],
    getCount: (p) => p.liveCount,
  },
  {
    id: "movies",
    icon: Film,
    label: "FILMES",
    sublabel: "FILMES",
    colors: ["#ff3333", "#ff9933"],
    getCount: (p) => p.movieCount,
  },
  {
    id: "series",
    icon: Tv,
    label: "SÉRIES",
    sublabel: "SÉRIES",
    colors: ["#cc33ff", "#9933ff"],
    getCount: (p) => p.seriesCount,
  },
  {
    id: "settings",
    icon: Settings,
    label: "CONFIGURAÇÕES",
    sublabel: "",
    colors: ["#00cc66", "#009944"],
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
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const Icon = tile.icon;
  const count = tile.getCount(props);

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ scale }] },
        styles.tileWrapper,
      ]}
    >
      <TouchableOpacity
        style={styles.tile}
        onPress={() => props.onNavigate(tile.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <LinearGradient
          colors={tile.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBg}
        >
          <View style={styles.tileContent}>
            <Icon size={48} color="#fff" strokeWidth={1.5} />
            <Text style={styles.tileLabel}>{tile.label}</Text>
            {count > 0 && (
              <Text style={styles.countText}>
                {count.toLocaleString()} {tile.sublabel}
              </Text>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}


export function HomeScreen(props: Props) {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setTime(`${hours}:${minutes}`);

      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
      };
      setDate(now.toLocaleDateString("pt-BR", options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [logoOpacity]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <View style={styles.content}>
        {/* Header: Logo + Clock */}
        <Animated.View style={[styles.header, { opacity: logoOpacity }]}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.clockContainer}>
            <Text style={styles.clockTime}>{time || "--:--"}</Text>
            <Text style={styles.clockDate}>{date}</Text>
          </View>
        </Animated.View>

        {/* Grid 2x2 de Tiles */}
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

        {/* Logout Button */}
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingTop: 16,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  logo: { width: 120, height: 60 },
  clockContainer: {
    alignItems: "flex-end",
  },
  clockTime: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 32,
  },
  clockDate: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
    textTransform: "capitalize",
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    flex: 1,
  },
  tileWrapper: {
    width: "48%",
    aspectRatio: 1,
  },
  tile: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientBg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  tileContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  countText: {
    fontSize: 12,
    color: "#fff",
    marginTop: 6,
    opacity: 0.9,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
    padding: 8,
  },
  logoutText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
});
