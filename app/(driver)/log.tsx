import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { colors, spacing, font } from '../../lib/theme';
import { minutesBetween } from '../../lib/utils';

export default function LogShipmentScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [cargo, setCargo] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTrip = () => {
    if (!cargo || !origin || !destination) {
      Alert.alert('Missing info', 'Please fill in cargo, origin, and destination before starting.');
      return;
    }
    const now = new Date().toISOString();
    setStartTime(now);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const finishTrip = async () => {
    if (!startTime || !profile) return;
    setSaving(true);
    const endTime = new Date().toISOString();
    const duration = minutesBetween(startTime, endTime);

    const { error } = await supabase.from('shipments').insert({
      driver_id: profile.id,
      company_id: profile.company_id,
      cargo_description: cargo,
      origin,
      destination,
      notes: notes || null,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: duration,
    });

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    router.back();
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const timerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log Shipment</Text>

        <Text style={styles.label}>Cargo Description</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 40 pallets of electronics"
          placeholderTextColor={colors.muted}
          value={cargo}
          onChangeText={setCargo}
          editable={!startTime}
        />

        <Text style={styles.label}>Origin</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dallas, TX"
          placeholderTextColor={colors.muted}
          value={origin}
          onChangeText={setOrigin}
          editable={!startTime}
        />

        <Text style={styles.label}>Destination</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Houston, TX"
          placeholderTextColor={colors.muted}
          value={destination}
          onChangeText={setDestination}
          editable={!startTime}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any additional notes..."
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {startTime && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Trip in progress</Text>
            <Text style={styles.timerText}>{timerText}</Text>
          </View>
        )}

        {!startTime ? (
          <TouchableOpacity style={styles.startBtn} onPress={startTrip}>
            <Text style={styles.startBtnText}>▶  Start Trip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.finishBtn, saving && styles.btnDisabled]}
            onPress={finishTrip}
            disabled={saving}
          >
            <Text style={styles.finishBtnText}>{saving ? 'Saving...' : '■  Finish Trip'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: spacing.lg, paddingTop: 60, paddingBottom: 80 },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xl },
  label: { color: colors.muted, fontSize: font.sm, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.card, color: colors.text, borderRadius: 10,
    padding: spacing.md, fontSize: font.md, borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  timerCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: spacing.xl,
    alignItems: 'center', marginVertical: spacing.xl,
    borderWidth: 1, borderColor: colors.accent + '44',
  },
  timerLabel: { color: colors.muted, fontSize: font.sm, marginBottom: spacing.sm },
  timerText: { color: colors.accent, fontSize: 48, fontWeight: '200', fontVariant: ['tabular-nums'] },
  startBtn: {
    backgroundColor: colors.success, borderRadius: 12,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.xl,
  },
  startBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
  finishBtn: {
    backgroundColor: colors.danger, borderRadius: 12,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.xl,
  },
  finishBtnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  btnDisabled: { opacity: 0.6 },
});
