import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { M3UItem } from '../types/iptv';

interface Props {
  items: M3UItem[];
  view: 'live' | 'movies' | 'series' | 'settings';
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onChangeView: (view: 'live' | 'movies' | 'series' | 'settings') => void;
}

const COLORS = {
  background: '#050308',
  foreground: '#ffffff',
  primary: '#a855f7',
  accent: '#fbbf24',
  border: '#27212e',
  hover: '#ffffff15',
};

export function MobileSidebar({
  items,
  view,
  selectedCategory,
  onSelectCategory,
  onChangeView,
}: Props) {
  const categories = useMemo(() => {
    const filtered = items.filter((i) => {
      if (view === 'settings') return false;
      if (view === 'live') return i.type === 'live';
      if (view === 'movies') return i.type === 'movie';
      if (view === 'series') return i.type === 'series';
      return true;
    });

    const groupCounts = new Map<string, number>();
    for (const item of filtered) {
      groupCounts.set(item.group, (groupCounts.get(item.group) || 0) + 1);
    }

    return Array.from(groupCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items, view]);

  const viewOptions = [
    { id: 'live', label: 'TV AO VIVO' },
    { id: 'movies', label: 'FILMES' },
    { id: 'series', label: 'SÉRIES' },
    { id: 'settings', label: 'CONFIGURAÇÕES' },
  ];

  const { width } = Dimensions.get('window');
  const sidebarWidth = width * 0.2;

  return (
    <View style={[styles.sidebar, { width: sidebarWidth }]}>
      {/* View Selector */}
      <View style={styles.viewSection}>
        <Text style={styles.sectionTitle}>VISUALIZAR</Text>
        {viewOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.viewButton,
              view === option.id && styles.viewButtonActive,
            ]}
            onPress={() => {
              onChangeView(option.id as any);
              onSelectCategory(null);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.viewButtonText,
                view === option.id && styles.viewButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Categories Section */}
      {view !== 'settings' && (
        <>
          <View style={styles.divider} />
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitle}>CATEGORIAS</Text>
            <ScrollView style={styles.categoriesList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  selectedCategory === null && styles.categoryButtonActive,
                ]}
                onPress={() => onSelectCategory(null)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === null && styles.categoryTextActive,
                  ]}
                >
                  Todas
                </Text>
                <Text style={styles.categoryCount}>
                  {items.filter((i) => {
                    if (view === 'live') return i.type === 'live';
                    if (view === 'movies') return i.type === 'movie';
                    if (view === 'series') return i.type === 'series';
                    return false;
                  }).length}
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[
                    styles.categoryButton,
                    selectedCategory === cat.name && styles.categoryButtonActive,
                  ]}
                  onPress={() => onSelectCategory(cat.name)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === cat.name && styles.categoryTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  <Text style={styles.categoryCount}>{cat.count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: COLORS.background,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  viewSection: {
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  viewButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  viewButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  viewButtonTextActive: {
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  categoriesSection: {
    flex: 1,
    paddingHorizontal: 8,
  },
  categoriesList: {
    flex: 1,
  },
  categoryButton: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryButtonActive: {
    backgroundColor: `${COLORS.primary}20`,
    borderColor: COLORS.accent,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.foreground,
    flex: 1,
  },
  categoryTextActive: {
    fontWeight: '700',
    color: COLORS.accent,
  },
  categoryCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 6,
    fontWeight: '600',
  },
});
