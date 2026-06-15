import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Shipment } from '../../../lib/types';
import { colors, spacing, font } from '../../../lib/theme';
import { formatDate, formatDuration } from '../../../lib/utils';

export default function AdminDriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [driverName, setDriverName] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: profile }, { data: trips }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', id).single(),
        supabase.from('shipments').select('*').eq('driver_id', id).order('created_at', { ascending: false }),
      ]);
      setDriverName(profile?.full_name ?? 'Driver');
      setShipments(trips ?? []);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const totalMinutes = shipments.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.driverName}>{driverName}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{shipments.length}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{formatDuration(totalMinutes)}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>
              {shipments.length > 0 ? formatDuration(Math.round(totalMinutes / shipments.length)) : '—'}
            </Text>
            <Text style={styles.statLabel}>Avg Trip</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Shipment Log</Text>

      <FlatList
        data={shipments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={shipments.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No shipments logged yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cargo} numberOfLines={1}>{item.cargo_description}</Text>
              {item.duration_minutes !== null && (
                <Text style={styles.duration}>{formatDuration(item.duration_minutes!)}</Text>
              )}
            </View>
            <Text style={styles.route}>{item.origin} → {item.destination}</Text>
            <Text style={styles.date}>{formatDate(item.start_time)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  headerCard: {
    backgroundColor: colors.card, margin: spacing.lg, borderRadius: 14,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  driverName: { color: colors.text, fontSize: font.xl, fontWeight: '700', marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { color: colors.accent, fontSize: font.xl, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: colors.text, fontSize: font.lg, fontWeight: '600',
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: colors.muted },
  card: {
    backgroundColor: colors.card, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cargo: { color: colors.text, fontSize: font.md, fontWeight: '600', flex: 1 },
  duration: { color: colors.accent, fontSize: font.sm, fontWeight: '600' },
  route: { color: colors.muted, fontSize: font.sm, marginTop: 4 },
  date: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
