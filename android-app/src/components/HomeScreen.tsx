import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Radio, Film, Tv, Settings } from "lucide-react-native";
import LinearGradient from "expo-linear-gradient";
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

export const HomeScreen = React.memo((props: Props) => {
  const [time, setTime] = useState("--:--");
  const [date, setDate] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setDate(now.toLocaleDateString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.clock}>
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <View style={styles.grid}>
          <TouchableOpacity style={styles.tile} onPress={() => props.onNavigate("live")}>
            <LinearGradient colors={["#34d399", "#06b6d4", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
              <Radio size={40} color="#fff" />
              <Text style={styles.label}>TV AO VIVO</Text>
              <Text style={styles.count}>{props.liveCount} CANAIS</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tile} onPress={() => props.onNavigate("movies")}>
            <LinearGradient colors={["#f43f5e", "#ef4444", "#f59e0b"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
              <Film size={40} color="#fff" />
              <Text style={styles.label}>FILMES</Text>
              <Text style={styles.count}>{props.movieCount} FILMES</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tile} onPress={() => props.onNavigate("series")}>
            <LinearGradient colors={["#d946ef", "#a855f7", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
              <Tv size={40} color="#fff" />
              <Text style={styles.label}>SÉRIES</Text>
              <Text style={styles.count}>{props.seriesCount} SÉRIES</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tile} onPress={() => props.onNavigate("settings")}>
            <LinearGradient colors={["#34d399", "#0d9488"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
              <Settings size={40} color="#fff" />
              <Text style={styles.label}>CONFIG</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

HomeScreen.displayName = "HomeScreen";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050308" },
  content: { flex: 1, padding: 20, justifyContent: "space-between" },
  header: { alignItems: "center", marginTop: 20 },
  logo: { width: 250, height: 100 },
  clock: { alignItems: "center" },
  time: { fontSize: 36, fontWeight: "700", color: "#fff" },
  date: { fontSize: 12, color: "#999", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 20 },
  tile: { width: "47%", aspectRatio: 1, borderRadius: 16, overflow: "hidden" },
  grad: { flex: 1, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 14, fontWeight: "700", color: "#fff", marginTop: 8, textAlign: "center" },
  count: { fontSize: 10, color: "#fff", marginTop: 4, textAlign: "center" },
});
