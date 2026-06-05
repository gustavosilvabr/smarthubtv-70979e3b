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
  Dimensions,
} from "react-native";
import { X, Play, Clock, Star } from "lucide-react-native";
import { M3UItem, fetchSeriesDetails, SeriesEpisode } from "../utils/api";
import { IptvSettings } from "../utils/settings";

interface Props {
  visible: boolean;
  series: M3UItem | null;
  settings: IptvSettings;
  onClose: () => void;
  onPlayEpisode: (episode: SeriesEpisode) => void;
}

export function SeriesDetailsModal({
  visible,
  series,
  settings,
  onClose,
  onPlayEpisode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>({});
  const [seasons, setSeasons] = useState<number[]>([]);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [episodesMap, setEpisodesMap] = useState<Record<number, SeriesEpisode[]>>({});

  useEffect(() => {
    if (!visible || !series || !series.streamId) return;

    setLoading(true);
    setInfo({});
    setSeasons([]);
    setEpisodesMap({});

    fetchSeriesDetails(settings, series.streamId)
      .then((data) => {
        setInfo(data.info || {});
        setEpisodesMap(data.episodes || {});
        
        const seasonNums = Object.keys(data.episodes)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b);
        setSeasons(seasonNums);
        if (seasonNums.length > 0) {
          setActiveSeason(seasonNums[0]);
        }
      })
      .catch((err) => console.error("Erro ao carregar detalhes da série:", err))
      .finally(() => setLoading(false));
  }, [visible, series, settings]);

  const activeEpisodes = episodesMap[activeSeason] || [];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Card do Modal */}
        <View style={styles.modalCard}>
          {/* Header */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#fff" />
          </TouchableOpacity>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>Buscando temporadas e episódios...</Text>
            </View>
          ) : (
            <View style={styles.content}>
              {/* Coluna da Esquerda: Info & Poster */}
              <View style={styles.infoColumn}>
                <Image
                  source={{ uri: info.cover || series?.logo || "" }}
                  style={styles.cover}
                  resizeMode="cover"
                />
                <ScrollView style={styles.metadataScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.title}>{series?.name}</Text>
                  
                  {/* Classificação / Info rápido */}
                  <View style={styles.badgeRow}>
                    {info.releaseDate && (
                      <Text style={styles.badgeText}>{info.releaseDate}</Text>
                    )}
                    {info.rating && (
                      <View style={styles.ratingBadge}>
                        <Star size={10} color="#fbbf24" fill="#fbbf24" />
                        <Text style={styles.ratingText}>{Number(info.rating).toFixed(1)}</Text>
                      </View>
                    )}
                    {info.genre && (
                      <Text style={styles.genreText} numberOfLines={1}>
                        {info.genre}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.plot}>
                    {info.plot || "Nenhuma sinopse disponível para esta série."}
                  </Text>
                  
                  {info.cast && (
                    <Text style={styles.castText}>
                      <Text style={{ fontWeight: "bold", color: "#a855f7" }}>Elenco: </Text>
                      {info.cast}
                    </Text>
                  )}
                </ScrollView>
              </View>

              {/* Coluna da Direita: Temporadas & Episódios */}
              <View style={styles.episodesColumn}>
                {/* Seletor de Temporadas (Tabs Horizontais) */}
                {seasons.length > 0 ? (
                  <View style={styles.seasonsTabContainer}>
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                      {seasons.map((s) => (
                        <TouchableOpacity
                          key={s}
                          onPress={() => setActiveSeason(s)}
                          style={[
                            styles.seasonTabBtn,
                            activeSeason === s && styles.seasonTabBtnActive,
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
                  </View>
                ) : (
                  <Text style={styles.noEpisodesText}>Nenhuma temporada encontrada</Text>
                )}

                {/* Lista de Episódios */}
                <FlatList
                  data={activeEpisodes}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.episodeRow}
                      onPress={() => onPlayEpisode(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.episodeIconWrapper}>
                        <Play size={14} color="#fff" fill="#fff" />
                      </View>
                      <View style={styles.episodeTextWrapper}>
                        <Text style={styles.episodeTitle} numberOfLines={1}>
                          Ep. {item.episodeNum} — {item.name}
                        </Text>
                        {item.info?.duration && (
                          <Text style={styles.episodeSub}>{item.info.duration}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  ListEmptyComponent={
                    !loading ? (
                      <Text style={styles.noEpisodesText}>Nenhum episódio nesta temporada</Text>
                    ) : null
                  }
                />
              </View>
            </View>
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
    padding: 24,
  },
  modalCard: {
    width: "100%",
    height: "100%",
    maxWidth: 900,
    maxHeight: 520,
    backgroundColor: "#110920",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 12,
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  infoColumn: {
    flex: 1.1,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    padding: 20,
    gap: 16,
  },
  cover: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  metadataScroll: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(251,191,36,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 10,
    color: "#fbbf24",
    fontWeight: "bold",
  },
  genreText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    flex: 1,
  },
  plot: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  castText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
  },
  episodesColumn: {
    flex: 1.2,
    padding: 20,
  },
  seasonsTabContainer: {
    marginBottom: 12,
    paddingBottom: 4,
  },
  seasonTabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  seasonTabBtnActive: {
    backgroundColor: "rgba(168,85,247,0.15)",
    borderColor: "#a855f7",
  },
  seasonTabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "bold",
  },
  seasonTabTextActive: {
    color: "#a855f7",
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  episodeIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(168,85,247,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  episodeTextWrapper: {
    flex: 1,
  },
  episodeTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  episodeSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    marginTop: 1,
  },
  noEpisodesText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
  },
});
