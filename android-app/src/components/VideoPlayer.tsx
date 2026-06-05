import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Text,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { X, Play, Pause, RotateCcw } from "lucide-react-native";
import { M3UItem } from "../utils/api";

interface Props {
  item: M3UItem | null;
  urlOverride?: string;
  onClose: () => void;
}

export function VideoPlayer({ item, urlOverride, onClose }: Props) {
  const videoRef = useRef<Video>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const streamUrl = urlOverride || item?.url || "";

  useEffect(() => {
    let timer: any;
    if (showControls && isPlaying) {
      timer = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  const handlePlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    if (playbackStatus.isLoaded) {
      setLoading(playbackStatus.isBuffering);
      setIsPlaying(playbackStatus.isPlaying);
      if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
        onClose();
      }
    } else {
      if (playbackStatus.error) {
        setError(playbackStatus.error);
        setLoading(false);
      }
    }
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    if (videoRef.current) {
      videoRef.current.unloadAsync().then(() => {
        videoRef.current?.loadAsync({ uri: streamUrl }, { shouldPlay: true }, false);
      });
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={true}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        style={styles.video}
      />

      {/* Toque na tela para alternar controles */}
      <TouchableOpacity
        style={styles.touchOverlay}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      />

      {/* Indicador de Carregamento */}
      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      )}

      {/* Indicador de Erro */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Não foi possível reproduzir este canal/vídeo.</Text>
          <Text style={styles.errorSubText}>Verifique sua conexão ou formato do stream.</Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryBtn} activeOpacity={0.8}>
            <RotateCcw size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Controles do Player */}
      {showControls && (
        <View style={styles.controlsOverlay}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {item?.name || "Reproduzindo..."}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Botão Central de Play/Pause */}
          <View style={styles.centerControls}>
            <TouchableOpacity onPress={togglePlay} style={styles.playPauseBtn} activeOpacity={0.8}>
              {isPlaying ? (
                <Pause size={28} color="#fff" fill="#fff" />
              ) : (
                <Play size={28} color="#fff" fill="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 100,
  },
  video: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  touchOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 101,
  },
  centerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 102,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  errorContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 103,
    backgroundColor: "rgba(10, 5, 20, 0.9)",
    padding: 24,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  errorSubText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#a855f7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  controlsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "space-between",
    zIndex: 104,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    flex: 1,
    marginRight: 16,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerControls: {
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  playPauseBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(168, 85, 247, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
