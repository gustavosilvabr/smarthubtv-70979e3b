import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { M3UItem } from '../types/iptv';

interface Props {
  item: M3UItem;
  isFavorited: boolean;
  onPress: (item: M3UItem) => void;
  onToggleFavorite: (id: string) => void;
}

const COLORS = {
  background: '#050308',
  card: '#0a0613',
  cardBorder: '#27212e',
  foreground: '#ffffff',
  primary: '#a855f7',
  accent: '#fbbf24',
  border: '#ffffff0a',
  hover: '#ffffff15',
};

export function MobileContentCard({
  item,
  isFavorited,
  onPress,
  onToggleFavorite,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const isLive = item.type === 'live';
  const aspectRatio = isLive ? 16 / 9 : 2 / 3;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          { aspectRatio },
        ]}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        {/* Image */}
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, styles.cardPlaceholder]}>
            <Text style={styles.placeholderText}>{item.name.charAt(0)}</Text>
          </View>
        )}

        {/* Overlay */}
        <View style={styles.overlay} />

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => onToggleFavorite(item.id)}
            activeOpacity={0.7}
          >
            <Heart
              size={14}
              color={isFavorited ? '#ff3333' : '#ffffff'}
              fill={isFavorited ? '#ff3333' : 'none'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    padding: 4,
  },
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.foreground,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.foreground,
    flex: 1,
    marginRight: 6,
    textTransform: 'capitalize',
  },
  favoriteButton: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
