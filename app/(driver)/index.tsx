import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Shipment } from '../../lib/types';
import { colors, spacing, font } from '../../lib/theme';
import { formatDuration, formatDate } from '../../lib/utils';

export default function DriverDashboard() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchShipments = async () => {
    const { data } = await supabase
      .from('shipments')
      .select('*')
      .eq('driver_id', profile?.id)
      .order('created_at', { ascending: false });
    setShipments(data ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchShipments(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchShipments(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{profile?.full_name}</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{shipments.length}</Text>
          <Text style={styles.statLabel}>Total Trips</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {shipments.filter(s => s.end_time).length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {shipments.filter(s => !s.end_time).length}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Shipments</Text>
      </View>

      <FlatList
        data={shipments}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={shipments.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No shipments yet</Text>
            <Text style={styles.emptySubtext}>Tap + to log your first trip</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(driver)/shipment/${item.id}`)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cargo} numberOfLines={1}>{item.cargo_description}</Text>
              {!item.end_time && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.route}>{item.origin} → {item.destination}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.meta}>{formatDate(item.start_time)}</Text>
              {item.duration_minutes && (
                <Text style={styles.meta}>{formatDuration(item.duration_minutes)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(driver)/log')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.lg,
  },
  greeting: { color: colors.muted, fontSize: font.sm },
  name: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  signOut: { color: colors.muted, fontSize: font.sm, marginTop: 4 },
  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statNum: { color: colors.accent, fontSize: font.xl, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionHeader: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  emptySubtext: { color: colors.muted, fontSize: font.sm, marginTop: 4 },
  card: {
    backgroundColor: colors.card, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cargo: { color: colors.text, fontSize: font.md, fontWeight: '600', flex: 1 },
  badge: { backgroundColor: colors.accent + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  route: { color: colors.muted, fontSize: font.sm, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12 },
  fab: {
    position: 'absolute', bottom: 36, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { color: '#000', fontSize: 28, fontWeight: '300', lineHeight: 30 },
});
