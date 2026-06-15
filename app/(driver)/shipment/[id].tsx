import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Shipment } from '../../../lib/types';
import { colors, spacing, font } from '../../../lib/theme';
import { formatDate, formatTime, formatDuration } from '../../../lib/utils';

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => { setShipment(data); setLoading(false); });
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete Shipment', 'Are you sure you want to delete this log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('shipments').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Shipment not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.statusRow}>
        <Text style={styles.title} numberOfLines={2}>{shipment.cargo_description}</Text>
        {!shipment.end_time && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ACTIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Row label="Origin" value={shipment.origin} />
        <Row label="Destination" value={shipment.destination} />
      </View>

      <View style={styles.section}>
        <Row label="Start" value={`${formatDate(shipment.start_time)} at ${formatTime(shipment.start_time)}`} />
        {shipment.end_time && (
          <Row label="End" value={`${formatDate(shipment.end_time)} at ${formatTime(shipment.end_time)}`} />
        )}
        {shipment.duration_minutes !== null && (
          <Row label="Duration" value={formatDuration(shipment.duration_minutes!)} accent />
        )}
      </View>

      {shipment.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text style={styles.notes}>{shipment.notes}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Log</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, accent && rowStyles.accent]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  label: { color: colors.muted, fontSize: font.sm },
  value: { color: colors.text, fontSize: font.sm, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  accent: { color: colors.accent, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { color: colors.muted },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  badge: { backgroundColor: colors.accent + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  section: {
    backgroundColor: colors.card, borderRadius: 12,
    paddingHorizontal: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionLabel: { color: colors.muted, fontSize: font.sm, marginBottom: spacing.sm },
  notes: { color: colors.text, fontSize: font.sm, lineHeight: 20, paddingBottom: spacing.md },
  deleteBtn: {
    borderWidth: 1, borderColor: colors.danger, borderRadius: 12,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  deleteBtnText: { color: colors.danger, fontWeight: '600', fontSize: font.md },
});
