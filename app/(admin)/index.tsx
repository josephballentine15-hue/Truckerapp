import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { colors, spacing, font } from '../../lib/theme';

type DriverSummary = {
  id: string;
  full_name: string;
  trip_count: number;
  last_trip: string | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [totalTrips, setTotalTrips] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const { data: company } = await supabase
      .from('companies')
      .select('name, join_code')
      .eq('id', profile?.company_id)
      .single();
    if (company) {
      setCompanyName(company.name);
      setJoinCode(company.join_code);
    }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', profile?.company_id)
      .eq('role', 'driver');

    if (!profilesData) { setLoading(false); return; }

    const summaries: DriverSummary[] = await Promise.all(
      profilesData.map(async (p) => {
        const { data: shipments } = await supabase
          .from('shipments')
          .select('id, created_at')
          .eq('driver_id', p.id)
          .order('created_at', { ascending: false });
        return {
          id: p.id,
          full_name: p.full_name,
          trip_count: shipments?.length ?? 0,
          last_trip: shipments?.[0]?.created_at ?? null,
        };
      })
    );

    setDrivers(summaries);
    setTotalTrips(summaries.reduce((sum, d) => sum + d.trip_count, 0));
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const copyCode = async () => {
    await Clipboard.setStringAsync(joinCode);
    Alert.alert('Copied', `Join code ${joinCode} copied to clipboard. Share it with your drivers.`);
  };

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
          <Text style={styles.greeting}>Admin · {companyName}</Text>
          <Text style={styles.name}>{profile?.full_name}</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.codeCard} onPress={copyCode} activeOpacity={0.8}>
        <View>
          <Text style={styles.codeLabel}>DRIVER JOIN CODE</Text>
          <Text style={styles.codeValue}>{joinCode}</Text>
        </View>
        <View style={styles.copyBtn}>
          <Text style={styles.copyBtnText}>Copy</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{drivers.length}</Text>
          <Text style={styles.statLabel}>Drivers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalTrips}</Text>
          <Text style={styles.statLabel}>Total Trips</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {drivers.length > 0 ? Math.round(totalTrips / drivers.length) : 0}
          </Text>
          <Text style={styles.statLabel}>Avg / Driver</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fleet</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(admin)/add-driver')}>
          <Text style={styles.addBtnText}>+ Add Driver</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={drivers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={drivers.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚛</Text>
            <Text style={styles.emptyText}>No drivers yet</Text>
            <Text style={styles.emptySubtext}>Drivers register and join your company</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(admin)/driver/${item.id}`)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.driverName}>{item.full_name}</Text>
              <Text style={styles.tripCount}>{item.trip_count} trips</Text>
            </View>
            <Text style={styles.lastTrip}>
              {item.last_trip
                ? `Last trip: ${new Date(item.last_trip).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'No trips yet'}
            </Text>
          </TouchableOpacity>
        )}
      />
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
  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 12, padding: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.accent + '55',
  },
  codeLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, marginBottom: 2 },
  codeValue: { color: colors.accent, fontSize: font.xl, fontWeight: '700', letterSpacing: 4 },
  copyBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  copyBtnText: { color: '#000', fontWeight: '700', fontSize: font.sm },
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
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  addBtn: {
    backgroundColor: colors.accent + '22', borderRadius: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderWidth: 1, borderColor: colors.accent + '55',
  },
  addBtnText: { color: colors.accent, fontWeight: '600', fontSize: font.sm },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  emptySubtext: { color: colors.muted, fontSize: font.sm, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.xl },
  card: {
    backgroundColor: colors.card, borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  tripCount: { color: colors.accent, fontSize: font.sm, fontWeight: '600' },
  lastTrip: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
