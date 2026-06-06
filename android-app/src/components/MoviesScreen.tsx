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
  useWindowDimensions,
} from "react-native";
import { ChevronLeft, Film, Search, Heart, LayoutGrid, Star, Play } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";
import { M3UItem } from "../utils/api";
import { matchesSearch } from "../utils/string";
import { VideoPlayer } from "./VideoPlayer";

interface Props {
  items: M3UItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  initialCategory?: string;
}

const PRIORITY_CATEGORIES = [
  "cinema",
  "2026",
  "lançamento 2026",
  "lancamento 2026",
  "recém adicionados",
  "recem adicionados",
  "lançamento 2025",
  "lancamento 2025",
];

function sortCategories(cats: { name: string; count: number }[]) {
  const priorityScore = (name: string) => {
    const lower = name.toLowerCase();
    for (let i = 0; i < PRIORITY_CATEGORIES.length; i++) {
      if (lower.includes(PRIORITY_CATEGORIES[i])) return PRIORITY_CATEGORIES.length - i;
    }
    return 0;
  };
  return [...cats].sort((a, b) => {
    const diff = priorityScore(b.name) - priorityScore(a.name);
    return diff !== 0 ? diff : b.count - a.count;
  });
}

export function MoviesScreen({ items, favorites, onToggleFavorite, onBack, initialCategory = "all" }: Props) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isMobile = width < 768;

  const numColumns = useMemo(() => {
    if (isMobile && !isLandscape) return 2;
    if (isMobile) return 3;
    if (isLandscape) return 4;
    return 4;
  }, [isMobile, isLandscape]);

  const movies = useMemo(() => items.filter((i) => i.type === "movie"), [items]);

  const [category, setCategory] = useState<"all" | "favorites" | string>(initialCategory);
  const [query, setQuery] = useState("");
  const [catQuery, setCatQuery] = useState("");
  const [playing, setPlaying] = useState<M3UItem | null>(null);
  const [preview, setPreview] = useState<M3UItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);

  const realCats = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movies) map.set(m.group, (map.get(m.group) || 0) + 1);
    const list = [...map.entries()].map(([name, count]) => ({ name, count }));
    return sortCategories(list);
  }, [movies]);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return realCats;
    return realCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [realCats, catQuery]);

  const itemsForCategory = useMemo(() => {
    if (category === "all") return movies;
    if (category === "favorites") return movies.filter((m) => favorites.has(m.id));
    return movies.filter((m) => m.group === category);
  }, [movies, category, favorites]);

  const filteredMovies = useMemo(() => {
    if (!query.trim()) return itemsForCategory;
    return itemsForCategory.filter((m) => matchesSearch(m.name, query));
  }, [itemsForCategory, query]);

  const handleCatChange = useCallback((cat: string) => {
    setCategory(cat);
    setVisibleCount(60);
    setQuery("");
    setPreview(null);
  }, []);

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
              <Film size={14} color="#fb923c" />
              <Text style={styles.sectionTitle}>FILMES</Text>
            </View>

            <View style={styles.searchBox}>
              <Search size={12} color="rgba(255,255,255,0.4)" />
              <TextInput value={catQuery} onChangeText={setCatQuery} placeholder="Categoria..." placeholderTextColor="rgba(255,255,255,0.3)" style={styles.searchInput} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.catList}>
              {[
                { id: "all", label: "Todos", count: movies.length, icon: LayoutGrid },
                { id: "favorites", label: "Favoritos", count: favorites.size, icon: Heart },
              ].map(({ id, label, count, icon: Icon }) => (
                <TouchableOpacity key={id} style={[styles.catBtn, category === id && styles.catBtnActive]} onPress={() => handleCatChange(id)}>
                  <Icon size={13} color={category === id ? "#fb923c" : "rgba(255,255,255,0.5)"} />
                  <Text style={[styles.catText, category === id && styles.catTextActive]} numberOfLines={1}>{label}</Text>
                  <Text style={styles.catCount}>{count}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.divider} />

              {filteredCats.map((c, i) => {
                const isPriority = i < 4;
                return (
                  <TouchableOpacity
                    key={c.name}
                    style={[styles.catBtn, category === c.name && styles.catBtnActive]}
                    onPress={() => handleCatChange(c.name)}
                  >
                    {isPriority && <Star size={10} color="#fb923c" fill="#fb923c" />}
                    <Text style={[styles.catText, category === c.name && styles.catTextActive, isPriority && { color: "rgba(251,146,60,0.85)" }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.catCount}>{c.count}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ===== GRADE DE FILMES ===== */}
        <View style={[styles.gridPanel, isMobile && styles.gridPanelMobile]}>
          <View style={styles.searchBox}>
            <Search size={12} color="rgba(255,255,255,0.4)" />
            <TextInput
              value={query}
              onChangeText={(t) => { setQuery(t); setVisibleCount(60); }}
              placeholder={`Buscar filme... (${filteredMovies.length})`}
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filteredMovies.slice(0, visibleCount)}
            keyExtractor={(m) => m.id}
            numColumns={numColumns}
            showsVerticalScrollIndicator={false}
            onEndReached={() => setVisibleCount((v) => v + 60)}
            onEndReachedThreshold={0.5}
            columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
            renderItem={({ item: movie }) => {
              const isFav = favorites.has(movie.id);
              const isSel = preview?.id === movie.id;
              return (
                <TouchableOpacity
                  style={[styles.movieCard, isSel && styles.movieCardActive]}
                  onPress={() => setPreview(isSel ? null : movie)}
                  onLongPress={() => setPlaying(movie)}
                  activeOpacity={0.85}
                >
                  {movie.logo
                    ? <Image source={{ uri: movie.logo }} style={styles.moviePoster} resizeMode="cover" />
                    : <View style={styles.moviePosterFallback}><Film size={22} color="rgba(255,255,255,0.2)" /></View>
                  }
                  <Text style={styles.movieName} numberOfLines={2}>{movie.name}</Text>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite(movie.id)}
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

        {/* ===== DETALHES DO FILME (Desktop) ===== */}
        {(!isMobile || isLandscape) && (
          <View style={styles.detailPanel}>
            {preview ? (
              <>
                {preview.logo
                  ? <Image source={{ uri: preview.logo }} style={styles.detailPoster} resizeMode="cover" />
                  : <View style={styles.detailPosterFallback}><Film size={48} color="rgba(255,255,255,0.1)" /></View>
                }
                <Text style={styles.detailTitle} numberOfLines={3}>{preview.name}</Text>
                <Text style={styles.detailCategory} numberOfLines={1}>{preview.group}</Text>

                <TouchableOpacity style={styles.playBtn} onPress={() => setPlaying(preview)} activeOpacity={0.85}>
                  <Play size={14} color="#000" />
                  <Text style={styles.playBtnText}>ASSISTIR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.favBtn}
                  onPress={() => onToggleFavorite(preview.id)}
                  activeOpacity={0.85}
                >
                  <Heart size={14} color={favorites.has(preview.id) ? "#f43f5e" : "rgba(255,255,255,0.6)"} fill={favorites.has(preview.id) ? "#f43f5e" : "transparent"} />
                  <Text style={styles.favBtnText}>{favorites.has(preview.id) ? "Remover" : "Favoritar"}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.detailEmpty}>
                <Film size={36} color="rgba(255,255,255,0.08)" />
                <Text style={styles.detailEmptyText}>Selecione um filme</Text>
              </View>
            )}
          </View>
        )}
      </View>

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
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#fb923c", letterSpacing: 2, textTransform: "uppercase" },
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
  catBtnActive: { backgroundColor: "rgba(251,146,60,0.1)" },
  catText: { flex: 1, fontSize: 11, color: "rgba(255,255,255,0.55)" },
  catTextActive: { color: "#fb923c", fontWeight: "bold" },
  catCount: { fontSize: 9, color: "rgba(255,255,255,0.25)" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginVertical: 8 },

  gridPanel: { flex: 1, padding: 10 },
  gridPanelMobile: { padding: 8 },
  movieCard: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  movieCardActive: { borderColor: "#fb923c", backgroundColor: "rgba(251,146,60,0.08)" },
  moviePoster: { width: "100%", aspectRatio: 0.67 },
  moviePosterFallback: {
    width: "100%",
    aspectRatio: 0.67,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  movieName: { fontSize: 10, color: "rgba(255,255,255,0.8)", padding: 5, lineHeight: 14 },
  favIconWrapper: { position: "absolute", top: 5, right: 5, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, padding: 4 },

  detailPanel: {
    width: 200,
    padding: 14,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
  },
  detailPoster: { width: "100%", aspectRatio: 0.67, borderRadius: 10, marginBottom: 10 },
  detailPosterFallback: {
    width: "100%",
    aspectRatio: 0.67,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  detailTitle: { fontSize: 13, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 4 },
  detailCategory: { fontSize: 10, color: "#fb923c", marginBottom: 14, textAlign: "center" },
  playBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#fb923c",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    width: "100%",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#fb923c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  playBtnText: { color: "#000", fontWeight: "bold", fontSize: 12, letterSpacing: 1 },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    width: "100%",
    justifyContent: "center",
  },
  favBtnText: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  detailEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  detailEmptyText: { fontSize: 12, color: "rgba(255,255,255,0.2)" },

  // Mobile Styles
  layoutMobile: { flexDirection: "column", padding: 0 },
  catPanelMobile: { width: "100%", borderRightWidth: 0, borderBottomWidth: 1, maxHeight: "25%" },
});
