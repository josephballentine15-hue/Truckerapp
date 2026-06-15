import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Share, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { colors, spacing, font } from '../../lib/theme';

export default function AddDriverScreen() {
  const { profile } = useAuthStore();
  const [joinCode, setJoinCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('companies')
      .select('name, join_code')
      .eq('id', profile?.company_id)
      .single()
      .then(({ data }) => {
        if (data) { setCompanyName(data.name); setJoinCode(data.join_code); }
        setLoading(false);
      });
  }, []);

  const message =
    `Join ${companyName} on Trucker Log!\n\n` +
    `1. Download the app and tap "Register"\n` +
    `2. Choose "Driver"\n` +
    `3. Enter this join code: ${joinCode}`;

  const copyCode = async () => {
    await Clipboard.setStringAsync(joinCode);
    Alert.alert('Copied', `Join code ${joinCode} copied to clipboard.`);
  };

  const shareCode = async () => {
    try {
      // Web: prefer the native Web Share API; fall back to copying.
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share) {
          await nav.share({ title: 'Trucker Log Join Code', text: message });
        } else {
          await Clipboard.setStringAsync(message);
          Alert.alert('Copied to clipboard', 'Sharing isn’t supported in this browser, so the invite text was copied instead.');
        }
        return;
      }
      await Share.share({ message });
    } catch {
      // user dismissed the share sheet — no action needed
    }
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
      <Stack.Screen options={{ headerShown: true, title: 'Add Driver' }} />
      <Text style={styles.title}>Add a Driver</Text>
      <Text style={styles.subtitle}>
        Drivers join {companyName} by registering in the app with this code.
      </Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>COMPANY JOIN CODE</Text>
        <Text style={styles.code}>{joinCode}</Text>
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
        <Text style={styles.shareBtnText}>📤  Send to Driver</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
        <Text style={styles.copyBtnText}>Copy Code</Text>
      </TouchableOpacity>

      <View style={styles.steps}>
        <Text style={styles.stepsTitle}>How your driver joins:</Text>
        <Step n="1" text="Have them download the app and tap “Register.”" />
        <Step n="2" text="They choose “🚛 Driver” and fill in their details." />
        <Step n="3" text={`They enter this code: ${joinCode}`} />
        <Step n="4" text="They’ll appear in your fleet automatically." />
      </View>
    </View>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { color: colors.muted, fontSize: font.sm, marginBottom: spacing.xl, lineHeight: 20 },
  codeBox: {
    backgroundColor: colors.card, borderRadius: 14, padding: spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.accent + '55',
  },
  codeLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, marginBottom: spacing.sm },
  code: { color: colors.accent, fontSize: 44, fontWeight: '700', letterSpacing: 8 },
  shareBtn: {
    backgroundColor: colors.accent, borderRadius: 12,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  shareBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
  copyBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  copyBtnText: { color: colors.text, fontWeight: '600', fontSize: font.md },
  steps: { marginTop: spacing.xl },
  stepsTitle: { color: colors.text, fontSize: font.md, fontWeight: '600', marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  stepNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentDark + '44',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  stepNumText: { color: colors.accent, fontWeight: '700', fontSize: font.sm },
  stepText: { color: colors.muted, fontSize: font.sm, flex: 1, lineHeight: 20 },
});
