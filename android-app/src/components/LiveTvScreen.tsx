import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Dimensions,
  useWindowDimensions,
} from "react-native";
import {
  ChevronLeft,
  Radio,
  Search,
  Heart,
  LayoutGrid,
  Clock,
  Calendar,
  Play,
} from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";
import { M3UItem, fetchChannelEpg, EpgProgram } from "../utils/api";
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

type SpecialCat = "all" | "recent" | "favorites";

const RECENTS_KEY = "smarthub:live:recents";
const MAX_RECENTS = 30;

function formatTime(ts: number) {
  if (!ts) return "--:--";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveTvScreen({ items, favorites, onToggleFavorite, onBack, settings, initialCategory = "all" }: Props) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isMobile = width < 768;

  const [category, setCategory] = useState<SpecialCat | string>(initialCategory);
  const [catQuery, setCatQuery] = useState("");
  const [chanQuery, setChanQuery] = useState("");
  const [recents, setRecents] = useState<M3UItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(80);
  const [selected, setSelected] = useState<M3UItem | null>(null);
  const [playing, setPlaying] = useState<M3UItem | null>(null);
  const [epgPrograms, setEpgPrograms] = useState<EpgProgram[]>([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(true);

  useEffect(() => { setVisibleCount(80); }, [category, chanQuery]);

  // Fetch EPG for selected channel
  useEffect(() => {
    if (!selected?.streamId) { setEpgPrograms([]); return; }
    let cancelled = false;
    setEpgLoading(true);
    fetchChannelEpg(settings, selected.streamId, 6)
      .then((progs) => { if (!cancelled) setEpgPrograms(progs); })
      .catch(() => { if (!cancelled) setEpgPrograms([]); })
      .finally(() => { if (!cancelled) setEpgLoading(false); });
    return () => { cancelled = true; };
  }, [selected, settings]);

  const realCats = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.group, (map.get(it.group) || 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return realCats;
    return realCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [realCats, catQuery]);

  const itemsForCategory = useMemo(() => {
    if (category === "all") return items;
    if (category === "favorites") return items.filter((i) => favorites.has(i.id));
    if (category === "recent") return recents;
    return items.filter((i) => i.group === category);
  }, [items, category, favorites, recents]);

  const filteredItems = useMemo(() => {
    if (!chanQuery.trim()) return itemsForCategory;
    return itemsForCategory.filter((i) => matchesSearch(i.name, chanQuery));
  }, [itemsForCategory, chanQuery]);

  const handleSelect = useCallback((item: M3UItem) => {
    setSelected(item);
    setRecents((prev) => [item, ...prev.filter((x) => x.id !== item.id)].slice(0, MAX_RECENTS));
    setPlaying(item);
  }, []);

  const now = Math.floor(Date.now() / 1000);
  const currentProgram = epgPrograms.find((p) => p.start <= now && now < p.stop);
  const nextProgram = currentProgram
    ? epgPrograms.find((p) => p.start >= currentProgram.stop)
    : epgPrograms[0];

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <View style={[styles.layout, isMobile && !isLandscape && styles.layoutMobile]}>

        {/* ===== CATEGORIAS (Desktop) / Ocultas em mobile portrait ===== */}
        {(!isMobile || isLandscape || showCategories) && (
          <View style={[styles.catPanel, isMobile && styles.catPanelMobile]}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Radio size={14} color="#4ade80" />
              <Text style={styles.sectionTitle}>TV AO VIVO</Text>
            </View>

            <View style={styles.searchBox}>
              <Search size={12} color="rgba(255,255,255,0.4)" />
              <TextInput value={catQuery} onChangeText={setCatQuery} placeholder="Categoria..." placeholderTextColor="rgba(255,255,255,0.3)" style={styles.searchInput} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.catList}>
              {[
                { id: "all" as SpecialCat, label: "Todos", count: items.length, icon: LayoutGrid },
                { id: "recent" as SpecialCat, label: "Recentes", count: recents.length, icon: Clock },
                { id: "favorites" as SpecialCat, label: "Favoritos", count: favorites.size, icon: Heart },
              ].map(({ id, label, count, icon: Icon }) => (
                <TouchableOpacity key={id} style={[styles.catBtn, category === id && styles.catBtnActive]} onPress={() => setCategory(id)}>
                  <Icon size={13} color={category === id ? "#4ade80" : "rgba(255,255,255,0.5)"} />
                  <Text style={[styles.catText, category === id && styles.catTextActive]} numberOfLines={1}>{label}</Text>
                  <Text style={styles.catCount}>{count}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.divider} />

              {filteredCats.map((c) => (
                <TouchableOpacity key={c.name} style={[styles.catBtn, category === c.name && styles.catBtnActive]} onPress={() => setCategory(c.name)}>
                  <Text style={[styles.catText, category === c.name && styles.catTextActive]} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.catCount}>{c.count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ===== LISTA DE CANAIS ===== */}
        <View style={[styles.channelPanel, isMobile && styles.channelPanelMobile]}>
          <View style={styles.searchBox}>
            <Search size={12} color="rgba(255,255,255,0.4)" />
            <TextInput value={chanQuery} onChangeText={setChanQuery} placeholder={`Buscar canal... (${filteredItems.length})`} placeholderTextColor="rgba(255,255,255,0.3)" style={styles.searchInput} />
          </View>

          <FlatList
            data={filteredItems.slice(0, visibleCount)}
            keyExtractor={(i) => i.id}
            showsVerticalScrollIndicator={false}
            onEndReached={() => setVisibleCount((v) => v + 80)}
            onEndReachedThreshold={0.5}
            numColumns={isMobile && !isLandscape ? 2 : 1}
            renderItem={({ item }) => {
              const isFav = favorites.has(item.id);
              const isSelected = selected?.id === item.id;
              const isMobilePortrait = isMobile && !isLandscape;

              return (
                <TouchableOpacity
                  style={[
                    isMobilePortrait ? styles.channelCardMobile : styles.channelRow,
                    isSelected && styles.channelRowActive,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.logo ? (
                    <Image source={{ uri: item.logo }} style={[isMobilePortrait ? styles.channelLogoCard : styles.channelLogo]} resizeMode="contain" />
                  ) : (
                    <View style={[isMobilePortrait ? styles.channelLogoFallbackCard : styles.channelLogoFallback]}>
                      <Radio size={14} color="rgba(255,255,255,0.3)" />
                    </View>
                  )}
                  <View style={isMobilePortrait ? styles.cardContent : styles.rowContent}>
                    <Text style={[styles.channelName, isSelected && styles.channelNameActive]} numberOfLines={2}>{item.name}</Text>
                    <TouchableOpacity onPress={() => onToggleFavorite(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Heart size={13} color={isFav ? "#f43f5e" : "rgba(255,255,255,0.25)"} fill={isFav ? "#f43f5e" : "transparent"} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ===== PREVIEW + EPG (Desktop) / Oculto em mobile portrait ===== */}
        {(!isMobile || isLandscape) && (
          <View style={styles.previewPanel}>
            {selected ? (
              <>
                <View style={styles.previewHeader}>
                  {selected.logo
                    ? <Image source={{ uri: selected.logo }} style={styles.previewLogo} resizeMode="contain" />
                    : null
                  }
                  <Text style={styles.previewTitle} numberOfLines={2}>{selected.name}</Text>
                </View>

                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => setPlaying(selected)}
                  activeOpacity={0.8}
                >
                  <Play size={16} color="#000" />
                  <Text style={styles.playBtnText}>ASSISTIR AGORA</Text>
                </TouchableOpacity>

                {/* EPG */}
                <View style={styles.epgSection}>
                  <View style={styles.epgHeader}>
                    <Calendar size={12} color="#4ade80" />
                    <Text style={styles.epgTitle}>Guia de Programação</Text>
                  </View>
                  {epgLoading
                    ? <ActivityIndicator size="small" color="#4ade80" style={{ marginTop: 12 }} />
                    : epgPrograms.length === 0
                      ? <Text style={styles.epgEmpty}>Sem guia disponível</Text>
                      : epgPrograms.slice(0, 5).map((prog) => {
                          const isNow = prog.start <= now && now < prog.stop;
                          return (
                            <View key={prog.id} style={[styles.epgRow, isNow && styles.epgRowNow]}>
                              <Text style={styles.epgTime}>{formatTime(prog.start)}</Text>
                              <Text style={[styles.epgProgTitle, isNow && styles.epgProgTitleNow]} numberOfLines={1}>{prog.title}</Text>
                            </View>
                          );
                        })
                  }
                </View>
              </>
            ) : (
              <View style={styles.previewEmpty}>
                <Radio size={36} color="rgba(255,255,255,0.1)" />
                <Text style={styles.previewEmptyText}>Selecione um canal</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Full-screen Player */}
      {playing && <VideoPlayer item={playing} onClose={() => setPlaying(null)} />}
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
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#4ade80", letterSpacing: 2, textTransform: "uppercase" },

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
  catBtnActive: { backgroundColor: "rgba(74,222,128,0.1)" },
  catText: { flex: 1, fontSize: 11, color: "rgba(255,255,255,0.55)" },
  catTextActive: { color: "#4ade80", fontWeight: "bold" },
  catCount: { fontSize: 9, color: "rgba(255,255,255,0.25)" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginVertical: 8 },

  channelPanel: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.04)",
    padding: 10,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    marginBottom: 3,
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  channelRowActive: {
    backgroundColor: "rgba(74,222,128,0.08)",
    borderColor: "rgba(74,222,128,0.25)",
  },
  channelLogo: { width: 36, height: 28, borderRadius: 4 },
  channelLogoFallback: {
    width: 36,
    height: 28,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  channelName: { flex: 1, fontSize: 11, color: "rgba(255,255,255,0.75)" },
  channelNameActive: { color: "#fff", fontWeight: "600" },

  previewPanel: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  previewHeader: {
    alignItems: "center",
    marginBottom: 14,
    width: "100%",
  },
  previewLogo: { width: 120, height: 60, marginBottom: 10 },
  previewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  playBtn: {
    backgroundColor: "#4ade80",
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  playBtnText: { color: "#000", fontSize: 13, fontWeight: "bold", letterSpacing: 1 },

  epgSection: { width: "100%", marginTop: 8 },
  epgHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  epgTitle: { fontSize: 10, fontWeight: "bold", color: "#4ade80", textTransform: "uppercase", letterSpacing: 1.5 },
  epgRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    marginBottom: 4,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 10,
  },
  epgRowNow: { backgroundColor: "rgba(74,222,128,0.1)", borderWidth: 1, borderColor: "rgba(74,222,128,0.25)" },
  epgTime: { fontSize: 10, color: "rgba(255,255,255,0.4)", width: 38 },
  epgProgTitle: { flex: 1, fontSize: 11, color: "rgba(255,255,255,0.7)" },
  epgProgTitleNow: { color: "#4ade80", fontWeight: "600" },
  epgEmpty: { fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 16 },

  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  previewEmptyText: { fontSize: 13, color: "rgba(255,255,255,0.2)" },

  // Mobile Styles
  layoutMobile: { flexDirection: "column", padding: 0 },
  catPanelMobile: { width: "100%", borderRightWidth: 0, borderBottomWidth: 1, maxHeight: "40%" },
  channelPanelMobile: { width: "100%", borderRightWidth: 0, flex: 1, padding: 0 },
  channelCardMobile: {
    flex: 1,
    margin: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(74,222,128,0.05)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  channelLogoCard: { width: 60, height: 48, borderRadius: 8, marginBottom: 8 },
  channelLogoFallbackCard: {
    width: 60,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardContent: { alignItems: "center", gap: 8 },
  rowContent: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
