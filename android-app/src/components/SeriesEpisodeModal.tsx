import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { X, Play } from "lucide-react-native";
import { M3UItem } from "../types/iptv";
import { IptvSettings } from "../utils/settings";
import { fetchSeriesEpisodes } from "../utils/api-v2";

interface Episode {
  id: string;
  title: string;
  url: string;
  season: number;
  episodeNum: string;
}

interface Props {
  visible: boolean;
  series: M3UItem | null;
  settings: IptvSettings;
  onClose: () => void;
  onPlayEpisode: (episode: Episode) => void;
}

export function SeriesEpisodeModal({
  visible,
  series,
  settings,
  onClose,
  onPlayEpisode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [episodesMap, setEpisodesMap] = useState<Map<number, any[]>>(new Map());

  useEffect(() => {
    if (!visible || !series || !series.streamId) return;

    setLoading(true);
    setSeasons([]);
    setEpisodesMap(new Map());

    fetchSeriesEpisodes(settings, series.streamId)
      .then((data) => {
        setEpisodesMap(data);
        const seasonNums = Array.from(data.keys()).sort((a, b) => a - b);
        setSeasons(seasonNums);
        if (seasonNums.length > 0) {
          setActiveSeason(seasonNums[0]);
        }
      })
      .catch((err) => console.error("Erro ao carregar episódios:", err))
      .finally(() => setLoading(false));
  }, [visible, series, settings]);

  const activeEpisodes = episodesMap.get(activeSeason) || [];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Floating Card Modal */}
        <View style={styles.floatingCard}>
          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>

          {/* Series Poster - Fixed at top */}
          <Image
            source={{ uri: series?.logo || series?.info?.poster || "" }}
            style={styles.poster}
            resizeMode="cover"
          />

          {/* Series Title */}
          <Text style={styles.seriesTitle} numberOfLines={2}>
            {series?.name}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>Carregando episódios...</Text>
            </View>
          ) : (
            <>
              {/* Seasons Tabs - Fixed height, no overlap */}
              {seasons.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.seasonsScroll}
                  contentContainerStyle={styles.seasonsContent}
                >
                  {seasons.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setActiveSeason(s)}
                      style={[
                        styles.seasonTab,
                        activeSeason === s && styles.seasonTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.seasonTabText,
                          activeSeason === s && styles.seasonTabTextActive,
                        ]}
                      >
                        T{s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Episodes List - Scrollable */}
              <View style={styles.episodesContainer}>
                <FlatList
                  data={activeEpisodes}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={true}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.episodeRow}
                      onPress={() => {
                        onPlayEpisode({
                          id: item.id,
                          title: item.title,
                          url: item.url,
                          season: activeSeason,
                          episodeNum: `${index + 1}`,
                        });
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.episodeNumber}>
                        <Text style={styles.episodeNum}>{index + 1}</Text>
                      </View>

                      <View style={styles.episodeContent}>
                        <Text style={styles.episodeTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </View>

                      <View style={styles.playIcon}>
                        <Play size={14} color="#fbbf24" fill="#fbbf24" />
                      </View>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.episodesContent}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        Nenhum episódio nesta temporada
                      </Text>
                    </View>
                  }
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  floatingCard: {
    backgroundColor: "#0a0613",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
    overflow: "hidden",
    maxWidth: 500,
    height: "80%",
    width: "100%",
    flexDirection: "column",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  poster: {
    width: "100%",
    height: 200,
    backgroundColor: "rgba(255,255,255,0.05)",
    objectFit: "cover",
    
  },
  seriesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 10,
  },
  seasonsScroll: {
    maxHeight: 80,
  },
  seasonsContent: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    gap: 0,
  },
  seasonTab: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  seasonTabActive: {
    backgroundColor: "rgba(168,85,247,0.2)",
    borderColor: "#a855f7",
  },
  seasonTabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
  },
  seasonTabTextActive: {
    color: "#a855f7",
    fontWeight: "700",
  },
  episodesContainer: {
    flex: 1,
  },
  episodesContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  episodeNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  episodeNum: {
    color: "#a855f7",
    fontSize: 10,
    fontWeight: "700",
  },
  episodeContent: {
    flex: 1,
  },
  episodeTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  playIcon: {
    paddingLeft: 8,
  },
  emptyContainer: {
    paddingVertical: 30,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
  },
});
