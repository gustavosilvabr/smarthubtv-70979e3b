import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  FlatList,
  Dimensions,
} from 'react-native';
import { M3UItem } from '../types/iptv';
import { MobileContentCard } from './MobileContentCard';

interface Props {
  items: M3UItem[];
  favorites: Set<string>;
  selectedCategory: string | null;
  search: string;
  onSelectItem: (item: M3UItem) => void;
  onToggleFavorite: (id: string) => void;
}

const COLORS = {
  background: '#050308',
  foreground: '#ffffff',
  muted: 'rgba(255,255,255,0.6)',
};

export function ContentGrid({
  items,
  favorites,
  selectedCategory,
  search,
  onSelectItem,
  onToggleFavorite,
}: Props) {
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((i) => i.group === selectedCategory);
    }

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter((i) =>
        i.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [items, selectedCategory, search]);

  const { width } = Dimensions.get('window');
  const contentWidth = width * 0.75;

  // Determine columns based on content type - more columns for smaller cards
  const hasLive = filteredItems.some(i => i.type === 'live');
  const hasSeries = filteredItems.some(i => i.type === 'series');
  const hasMovies = filteredItems.some(i => i.type === 'movie');

  let columnCount = 4;
  let cardPadding = 6;

  if (hasLive) {
    columnCount = 6;
  } else if (hasSeries) {
    columnCount = 5;
    cardPadding = 5;
  } else if (hasMovies) {
    columnCount = 5;
  }

  const cardWidth = (contentWidth - 16 - (columnCount - 1) * cardPadding) / columnCount;

  if (filteredItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Nenhum resultado</Text>
        <Text style={styles.emptyText}>
          {search ? 'Nenhum conteúdo encontrado para sua busca' : 'Nenhum conteúdo disponível nesta categoria'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => item.id}
      numColumns={columnCount}
      scrollEnabled={true}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={[
        styles.gridContainer,
        { paddingBottom: 20 },
      ]}
      renderItem={({ item }) => (
        <View style={{ width: cardWidth }}>
          <MobileContentCard
            item={item}
            isFavorited={favorites.has(item.id)}
            onPress={onSelectItem}
            onToggleFavorite={onToggleFavorite}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
