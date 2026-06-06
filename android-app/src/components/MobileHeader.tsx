import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Settings, Home } from 'lucide-react-native';

interface Props {
  search: string;
  onSearchChange: (text: string) => void;
  onSettingsPress: () => void;
  onHomePress?: () => void;
  logoUri?: string;
}

const COLORS = {
  background: '#050308',
  foreground: '#ffffff',
  primary: '#a855f7',
  accent: '#fbbf24',
  border: '#27212e',
};

export function MobileHeader({
  search,
  onSearchChange,
  onSettingsPress,
  onHomePress,
  logoUri,
}: Props) {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.header}>
      {/* Home Button */}
      {onHomePress && (
        <TouchableOpacity onPress={onHomePress} style={styles.homeButton}>
          <Home size={20} color={COLORS.foreground} strokeWidth={1.5} />
        </TouchableOpacity>
      )}

      {/* Logo */}
      {logoUri ? (
        <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
      ) : (
        <Text style={styles.logoText}>SmartHub</Text>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Buscar..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={onSearchChange}
          selectionColor={COLORS.accent}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearButton}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Settings Button */}
      <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
        <Settings size={20} color={COLORS.foreground} strokeWidth={1.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${COLORS.background}cc`,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  homeButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: `${COLORS.primary}20`,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.border}40`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.foreground,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  clearIcon: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  settingsButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: `${COLORS.primary}20`,
  },
});
