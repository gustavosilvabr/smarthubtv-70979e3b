import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { ChevronLeft, Tv, Search, Heart, LayoutGrid, Play, ChevronRight } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";
import { M3UItem, fetchSeriesDetails, SeriesEpisode } from "../utils/api";
import { IptvSettings } from "../utils/settings";
import { matchesSearch } from "../utils/string";
import { VideoPlayer } from "./VideoPlayer";

interface Props {
  items: M3UItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  settings: IptvSettings;
  initialCategory?: string;
}

interface SeriesDetails {
  info: any;
  episodes: Record<number, SeriesEpisode[]>;
  loadingState: "idle" | "loading" | "done" | "error";
}

export function SeriesScreen({ items, favorites, onToggleFavorite, onBack, settings, initialCategory = "all" }: Props) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isMobile = width < 768;

  const numColumns = useMemo(() => {
    if (isMobile && !isLandscape) return 2;
    if (isMobile) return 3;
    if (isLandscape) return 4;
    return 4;
  }, [isMobile, isLandscape]);

  const series = useMemo(() => items.filter((i) => i.type === "series"), [items]);

  const [category, setCategory] = useState<"all" | "favorites" | string>(initialCategory);
  const [query, setQuery] = useState("");
  const [catQuery, setCatQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<M3UItem | null>(null);
  const [details, setDetails] = useState<SeriesDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [playing, setPlaying] = useState<SeriesEpisode | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);

  const realCats = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of series) map.set(s.group, (map.get(s.group) || 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [series]);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return realCats;
    return realCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [realCats, catQuery]);

  const itemsForCategory = useMemo(() => {
    if (category === "all") return series;
    if (category === "favorites") return series.filter((s) => favorites.has(s.id));
    return series.filter((s) => s.group === category);
  }, [series, category, favorites]);

  const filteredSeries = useMemo(() => {
    if (!query.trim()) return itemsForCategory;
    return itemsForCategory.filter((s) => matchesSearch(s.name, query));
  }, [itemsForCategory, query]);

  const handleSelectSeries = useCallback(async (item: M3UItem) => {
    setSelectedSeries(item);
    setDetails({ info: {}, episodes: {}, loadingState: "loading" });
    setSelectedSeason(1);
    try {
      const data = await fetchSeriesDetails(settings, item.streamId!);
      setDetails({ info: data.info, episodes: data.episodes, loadingState: "done" });
      const seasons = Object.keys(data.episodes).map(Number).sort((a, b) => a - b);
      if (seasons.length > 0) setSelectedSeason(seasons[0]);
    } catch {
      setDetails({ info: {}, episodes: {}, loadingState: "error" });
    }
  }, [settings]);

  const seasons = useMemo(() => {
    if (!details?.episodes) return [];
    return Object.keys(details.episodes).map(Number).sort((a, b) => a - b);
  }, [details]);

  const currentEpisodes = useMemo(() => {
    if (!details?.episodes || !selectedSeason) return [];
    return (details.episodes[selectedSeason] || []).sort((a, b) => a.episodeNum - b.episodeNum);
  }, [details, selectedSeason]);

  const playingItem: M3UItem | null = playing
    ? {
        id: `ep:${playing.id}`,
        name: `${selectedSeries?.name} - T${playing.seasonNum}E${playing.episodeNum} - ${playing.title}`,
        logo: playing.logo || selectedSeries?.logo || "",
        group: selectedSeries?.group || "",
        url: playing.url,
        type: "series",
      }
    : null;

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <View style={[styles.layout, isMobile && !isLandscape && styles.layoutMobile]}>

        {/* ===== CATEGORIAS (Desktop) ===== */}
        {(!isMobile || isLandscape) && (
          <View style={[styles.catPanel, isMobile && styles.catPanelMobile]}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Tv size={14} color="#e879f9" />
              <Text style={styles.sectionTitle}>SÉRIES</Text>
            </View>

            <View style={styles.searchBox}>
              <Search size={12} color="rgba(255,255,255,0.4)" />
              <TextInput value={catQuery} onChangeText={setCatQuery} placeholder="Categoria..." placeholderTextColor="rgba(255,255,255,0.3)" style={styles.searchInput} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.catList}>
              {[
                { id: "all", label: "Todas", count: series.length, icon: LayoutGrid },
                { id: "favorites", label: "Favoritos", count: favorites.size, icon: Heart },
              ].map(({ id, label, count, icon: Icon }) => (
                <TouchableOpacity key={id} style={[styles.catBtn, category === id && styles.catBtnActive]} onPress={() => { setCategory(id); setVisibleCount(60); }}>
                  <Icon size={13} color={category === id ? "#e879f9" : "rgba(255,255,255,0.5)"} />
                  <Text style={[styles.catText, category === id && styles.catTextActive]} numberOfLines={1}>{label}</Text>
                  <Text style={styles.catCount}>{count}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.divider} />

              {filteredCats.map((c) => (
                <TouchableOpacity key={c.name} style={[styles.catBtn, category === c.name && styles.catBtnActive]} onPress={() => { setCategory(c.name); setVisibleCount(60); }}>
                  <Text style={[styles.catText, category === c.name && styles.catTextActive]} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.catCount}>{c.count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ===== GRADE DE SÉRIES ===== */}
        <View style={[styles.gridPanel, isMobile && styles.gridPanelMobile]}>
          <View style={styles.searchBox}>
            <Search size={12} color="rgba(255,255,255,0.4)" />
            <TextInput
              value={query}
              onChangeText={(t) => { setQuery(t); setVisibleCount(60); }}
              placeholder={`Buscar série... (${filteredSeries.length})`}
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filteredSeries.slice(0, visibleCount)}
            keyExtractor={(s) => s.id}
            numColumns={numColumns}
            showsVerticalScrollIndicator={false}
            onEndReached={() => setVisibleCount((v) => v + 60)}
            onEndReachedThreshold={0.5}
            columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
            renderItem={({ item: s }) => {
              const isSel = selectedSeries?.id === s.id;
              const isFav = favorites.has(s.id);
              return (
                <TouchableOpacity
                  style={[styles.seriesCard, isSel && styles.seriesCardActive]}
                  onPress={() => handleSelectSeries(s)}
                  activeOpacity={0.85}
                >
                  {s.logo
                    ? <Image source={{ uri: s.logo }} style={styles.seriesPoster} resizeMode="cover" />
                    : <View style={styles.seriesPosterFallback}><Tv size={22} color="rgba(255,255,255,0.2)" /></View>
                  }
                  <Text style={styles.seriesName} numberOfLines={2}>{s.name}</Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite(s.id)}
                    style={styles.favIconWrapper}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Heart size={12} color={isFav ? "#f43f5e" : "rgba(255,255,255,0.2)"} fill={isFav ? "#f43f5e" : "transparent"} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ===== DETALHES / EPISÓDIOS (Desktop) ===== */}
        {(!isMobile || isLandscape) && (
          <View style={styles.detailPanel}>
            {!selectedSeries ? (
              <View style={styles.detailEmpty}>
                <Tv size={36} color="rgba(255,255,255,0.08)" />
                <Text style={styles.detailEmptyText}>Selecione uma série</Text>
              </View>
            ) : (
              <>
                {/* Poster e nome */}
                <View style={styles.detailHeader}>
                  {selectedSeries.logo
                    ? <Image source={{ uri: selectedSeries.logo }} style={styles.detailPoster} resizeMode="cover" />
                    : null
                  }
                  <View style={styles.detailHeaderText}>
                    <Text style={styles.detailTitle} numberOfLines={2}>{selectedSeries.name}</Text>
                    <Text style={styles.detailCategory}>{selectedSeries.group}</Text>
                    <TouchableOpacity
                      onPress={() => onToggleFavorite(selectedSeries.id)}
                      style={styles.favBtn}
                      activeOpacity={0.8}
                    >
                      <Heart size={12} color={favorites.has(selectedSeries.id) ? "#f43f5e" : "rgba(255,255,255,0.5)"} fill={favorites.has(selectedSeries.id) ? "#f43f5e" : "transparent"} />
                      <Text style={styles.favBtnText}>{favorites.has(selectedSeries.id) ? "Favoritado" : "Favoritar"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Seasons */}
                {details?.loadingState === "loading" ? (
                  <ActivityIndicator size="small" color="#e879f9" style={{ marginTop: 20 }} />
                ) : details?.loadingState === "error" ? (
                  <Text style={styles.errorText}>Erro ao carregar episódios.</Text>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonsRow}>
                      {seasons.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.seasonBtn, selectedSeason === s && styles.seasonBtnActive]}
                          onPress={() => setSelectedSeason(s)}
                        >
                          <Text style={[styles.seasonText, selectedSeason === s && styles.seasonTextActive]}>T{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.epList}>
                      {currentEpisodes.map((ep) => (
                        <TouchableOpacity
                          key={ep.id}
                          style={styles.epRow}
                          onPress={() => setPlaying(ep)}
                          activeOpacity={0.8}
                        >
                          {ep.logo
                            ? <Image source={{ uri: ep.logo }} style={styles.epThumb} resizeMode="cover" />
                            : <View style={styles.epThumbFallback}><Play size={14} color="#e879f9" /></View>
                          }
                          <View style={styles.epInfo}>
                            <Text style={styles.epNum}>Ep. {ep.episodeNum}</Text>
                            <Text style={styles.epTitle} numberOfLines={2}>{ep.title}</Text>
                          </View>
                          <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* ===== DETALHES MOBILE ===== */}
        {isMobile && !isLandscape && selectedSeries && (
          <View style={styles.detailPanelMobile}>
            {/* Seasons */}
            {details?.loadingState === "loading" ? (
              <ActivityIndicator size="small" color="#e879f9" style={{ marginTop: 20 }} />
            ) : details?.loadingState === "error" ? (
              <Text style={styles.errorText}>Erro ao carregar episódios.</Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonsRow}>
                  {seasons.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.seasonBtn, selectedSeason === s && styles.seasonBtnActive]}
                      onPress={() => setSelectedSeason(s)}
                    >
                      <Text style={[styles.seasonText, selectedSeason === s && styles.seasonTextActive]}>T{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.episodesTitle}>{seasons.length > 0 ? `Temporada ${selectedSeason}` : "Sem episódios"}</Text>
                <FlatList
                  data={currentEpisodes}
                  keyExtractor={(ep) => ep.id}
                  scrollEnabled={false}
                  renderItem={({ item: ep }) => (
                    <TouchableOpacity
                      style={styles.epRowMobile}
                      onPress={() => setPlaying(ep)}
                      activeOpacity={0.8}
                    >
                      {ep.logo
                        ? <Image source={{ uri: ep.logo }} style={styles.epThumbMobile} resizeMode="cover" />
                        : <View style={styles.epThumbFallback}><Play size={14} color="#e879f9" /></View>
                      }
                      <View style={styles.epInfoMobile}>
                        <Text style={styles.epNum}>Ep. {ep.episodeNum}</Text>
                        <Text style={styles.epTitle} numberOfLines={2}>{ep.title}</Text>
                      </View>
                      <Play size={18} color="#e879f9" />
                    </TouchableOpacity>
                  )}
                />
              </>
            )}
          </View>
        )}
      </View>

      {playing && playingItem && <VideoPlayer item={playingItem} onClose={() => setPlaying(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050308" },
  layout: { flex: 1, flexDirection: "row", zIndex: 10 },

  catPanel: {
    width: 200,
    backgroundColor: "rgba(15,8,30,0.9)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.05)",
    padding: 10,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, paddingVertical: 4 },
  backText: { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#e879f9", letterSpacing: 2, textTransform: "uppercase" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
    gap: 6,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 11, paddingVertical: 0 },
  catList: { flex: 1 },
  catBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 7,
    marginBottom: 3,
    gap: 6,
  },
  catBtnActive: { backgroundColor: "rgba(232,121,249,0.1)" },
  catText: { flex: 1, fontSize: 11, color: "rgba(255,255,255,0.55)" },
  catTextActive: { color: "#e879f9", fontWeight: "bold" },
  catCount: { fontSize: 9, color: "rgba(255,255,255,0.25)" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginVertical: 8 },

  gridPanel: { flex: 1, padding: 10 },
  gridPanelMobile: { padding: 8 },
  seriesCard: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  seriesCardActive: { borderColor: "#e879f9", backgroundColor: "rgba(232,121,249,0.08)" },
  seriesPoster: { width: "100%", aspectRatio: 0.67 },
  seriesPosterFallback: {
    width: "100%",
    aspectRatio: 0.67,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  seriesName: { fontSize: 10, color: "rgba(255,255,255,0.8)", padding: 5, lineHeight: 14 },
  favIconWrapper: { position: "absolute", top: 5, right: 5, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, padding: 4 },

  detailPanel: {
    width: 230,
    padding: 14,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.05)",
  },
  detailHeader: { flexDirection: "row", gap: 10, marginBottom: 12 },
  detailPoster: { width: 70, height: 100, borderRadius: 8 },
  detailHeaderText: { flex: 1, justifyContent: "center" },
  detailTitle: { fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  detailCategory: { fontSize: 10, color: "#e879f9", marginBottom: 8 },
  favBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  favBtnText: { fontSize: 11, color: "rgba(255,255,255,0.5)" },

  seasonsRow: { flexGrow: 0, marginBottom: 10 },
  seasonBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  seasonBtnActive: { backgroundColor: "rgba(232,121,249,0.15)", borderColor: "#e879f9" },
  seasonText: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  seasonTextActive: { color: "#e879f9" },

  epList: { flex: 1 },
  epRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 8,
  },
  epThumb: { width: 60, height: 38, borderRadius: 5 },
  epThumbFallback: {
    width: 60,
    height: 38,
    borderRadius: 5,
    backgroundColor: "rgba(232,121,249,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  epInfo: { flex: 1 },
  epNum: { fontSize: 9, color: "#e879f9", fontWeight: "bold", marginBottom: 2, textTransform: "uppercase" },
  epTitle: { fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 14 },

  detailEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  detailEmptyText: { fontSize: 12, color: "rgba(255,255,255,0.2)" },
  errorText: { fontSize: 12, color: "#f87171", textAlign: "center", marginTop: 20 },

  // Mobile Styles
  layoutMobile: { flexDirection: "column", padding: 0 },
  catPanelMobile: { width: "100%", borderRightWidth: 0, borderBottomWidth: 1, maxHeight: "20%" },
  detailPanelMobile: {
    flex: 1,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  episodesTitle: { fontSize: 12, fontWeight: "bold", color: "#e879f9", marginVertical: 10, marginHorizontal: 4 },
  epRowMobile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 10,
  },
  epThumbMobile: { width: 48, height: 36, borderRadius: 6 },
  epInfoMobile: { flex: 1 },
});
