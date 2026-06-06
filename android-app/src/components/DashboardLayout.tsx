import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

interface Props {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  content: React.ReactNode;
}

export function DashboardLayout({ sidebar, header, content }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const sidebarWidth = isMobile ? '30%' : '20%';

  return (
    <View style={styles.container}>
      {/* Sidebar (left) */}
      <View style={[styles.sidebarWrapper, { width: sidebarWidth }]}>
        {sidebar}
      </View>

      {/* Main content (right) */}
      <View style={styles.mainContent}>
        {/* Header (top) */}
        <View style={styles.headerWrapper}>
          {header}
        </View>

        {/* Content (scrollable) */}
        <View style={styles.contentWrapper}>
          {content}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#050308',
  },
  sidebarWrapper: {
    minWidth: 150,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  headerWrapper: {
    // Header manages its own height
  },
  contentWrapper: {
    flex: 1,
  },
});
