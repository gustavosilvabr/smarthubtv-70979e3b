import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Check, LogOut } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";

export type LoadingStage = "live" | "vod" | "series" | "epg" | "done";

interface Props {
  stage: LoadingStage;
  error?: string | null;
  onLogout?: () => void;
}

const STEPS: { key: Exclude<LoadingStage, "done">; label: string }[] = [
  { key: "live", label: "TV AO VIVO" },
  { key: "vod", label: "FILMES VOD" },
  { key: "series", label: "SÉRIES" },
  { key: "epg", label: "GUIA EPG" },
];

const ORDER: LoadingStage[] = ["live", "vod", "series", "epg", "done"];

function statusOf(current: LoadingStage, step: LoadingStage) {
  const ci = ORDER.indexOf(current);
  const si = ORDER.indexOf(step);
  if (ci > si) return "done";
  if (ci === si) return "active";
  return "wait";
}

export function LoadingScreen({ stage, error, onLogout }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => (t + 1) % 4);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const activeLabel =
    STEPS.find((s) => s.key === stage)?.label ?? "Finalizando";

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Card de Progresso */}
        <View style={styles.card}>
          <Text style={styles.title}>Atualizando Conteúdos</Text>

          {/* Steps em formato horizontal */}
          <View style={styles.stepsRow}>
            {STEPS.map((s) => {
              const st = statusOf(stage, s.key);
              return (
                <View
                  key={s.key}
                  style={[
                    styles.stepCard,
                    st === "done" && styles.stepDone,
                    st === "active" && styles.stepActive,
                  ]}
                >
                  <Text style={styles.stepLabel}>{s.label}</Text>
                  
                  <View style={styles.stepStatusContainer}>
                    {st === "done" && (
                      <View style={styles.statusDone}>
                        <Check size={12} color="#a855f7" />
                        <Text style={styles.statusTextDone}>Pronto</Text>
                      </View>
                    )}
                    {st === "active" && (
                      <View style={styles.statusActive}>
                        <ActivityIndicator size="small" color="#a855f7" />
                        <Text style={styles.statusTextActive}>Carregando</Text>
                      </View>
                    )}
                    {st === "wait" && (
                      <Text style={styles.statusTextWait}>Aguardando</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Loader e mensagens adicionais */}
          <View style={styles.loaderArea}>
            {!error ? (
              <>
                <ActivityIndicator size="large" color="#a855f7" style={{ marginBottom: 8 }} />
                <Text style={styles.loaderMessage}>
                  Atualizando {activeLabel}{".".repeat(tick + 1)}
                </Text>
                <Text style={styles.subMessage}>Por favor, aguarde...</Text>
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Falha ao sincronizar dados</Text>
                <Text style={styles.errorText}>{error}</Text>
                {onLogout && (
                  <TouchableOpacity
                    onPress={onLogout}
                    style={styles.logoutBtn}
                    activeOpacity={0.8}
                  >
                    <LogOut size={16} color="#fff" />
                    <Text style={styles.logoutBtnText}>Voltar ao Login</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050308",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10,
  },
  logo: {
    width: 220,
    height: 90,
    marginBottom: 16,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "rgba(20, 10, 36, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.2)",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#a855f7",
    textAlign: "center",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
    marginBottom: 16,
  },
  stepCard: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  stepDone: {
    borderColor: "rgba(168, 85, 247, 0.4)",
    backgroundColor: "rgba(168, 85, 247, 0.08)",
  },
  stepActive: {
    borderColor: "#a855f7",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: "center",
  },
  stepStatusContainer: {
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  statusDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusTextDone: {
    fontSize: 9,
    color: "#a855f7",
    fontWeight: "600",
  },
  statusActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusTextActive: {
    fontSize: 9,
    color: "#a855f7",
    fontWeight: "600",
  },
  statusTextWait: {
    fontSize: 9,
    color: "rgba(255,255,255,0.3)",
  },
  loaderArea: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 80,
  },
  loaderMessage: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "500",
  },
  subMessage: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  errorContainer: {
    alignItems: "center",
    width: "100%",
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ef4444",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    marginBottom: 12,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#a855f7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  logoutBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
