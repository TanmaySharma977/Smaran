import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import { colors, spacing, radius } from '../../../constants/theme';
import { openFullScreenAlarmSettings } from '@/lib/notifications';

function Row({ icon, label, onPress, danger }: any) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, role } = useAuth();

  async function logout() {
    Alert.alert('Log out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {session?.user?.email?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View>
          <Text style={styles.email}>{session?.user?.email}</Text>
          <Text style={styles.role}>{role ?? '—'}</Text>
        </View>
      </View>

            <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.group}>
        <Row icon="person-outline" label="Edit profile" onPress={() => router.push('/(app)/edit-profile')} />
        <Row icon="medkit-outline" label="Medical information" onPress={() => router.push('/(app)/medical-info')} />
        <Row icon="key-outline" label="Change password" onPress={() => {}} />
      </View>

      <Text style={styles.sectionLabel}>FAMILY</Text>
      <View style={styles.group}>
        <Row icon="people-outline" label="Manage family" onPress={() => router.push('/(app)/manage-family' as never)} />
        <Row icon="share-outline" label="Invite code" onPress={() => router.push('/(app)/invite-code')} />
      </View>

      <Text style={styles.sectionLabel}>PREFERENCES</Text>
      <View style={styles.group}>
        <Row icon="color-palette-outline" label="Appearance" onPress={() => router.push('/(app)/appearance')} />
        <Row icon="notifications-outline" label="Notifications" onPress={() => {}} />
        <Row icon="musical-notes-outline" label="Alarm Sound" onPress={() => router.push('/(app)/alarm-sound' as never)} />
        <Row icon="expand-outline" label="Full-Screen Alarm Settings" onPress={openFullScreenAlarmSettings} />
      </View>

      <View style={[styles.group, { marginTop: spacing.lg }]}>
        <Row icon="log-out-outline" label="Log out" onPress={logout} danger />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  title: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.8, marginBottom: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 24, fontWeight: '600' },
  email: { fontSize: 17, fontWeight: '600', color: colors.text },
  role: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
});