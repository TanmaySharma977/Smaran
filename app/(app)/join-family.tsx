import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { colors, spacing, radius } from '../../constants/theme';

type PendingInvite = {
  id: string;
  role: string;
  relationship: string | null;
  families: { name: string } | null;
};

export default function JoinFamilyScreen() {
  const { session } = useAuth();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const { refreshFamilyStatus } = useAuth();
  
  const loadInvites = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from('family_members')
      .select('id, role, relationship, families(name)')
      .eq('user_id', session.user.id)
      .eq('status', 'pending');
    setInvites((data as any) ?? []);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { loadInvites(); }, [loadInvites]));

  async function acceptInvite(id: string) {
    setAccepting(id);
    const { error } = await supabase.from('family_members').update({ status: 'active' }).eq('id', id);
    setAccepting(null);
    if (!error) {
      await refreshFamilyStatus();
      router.replace('/');
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInvites} />}
      >
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          {invites.length > 0 ? 'You have a pending family invite' : "Let's get you set up"}
        </Text>

        {loading && invites.length === 0 && <ActivityIndicator style={{ marginTop: spacing.xl }} />}

        {invites.map((invite) => (
          <View key={invite.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{invite.families?.name ?? 'Family'}</Text>
              <Text style={styles.cardSubtitle}>
                Invited as {invite.relationship ?? invite.role}
              </Text>
            </View>
            <Pressable
              style={styles.acceptButton}
              onPress={() => acceptInvite(invite.id)}
              disabled={accepting === invite.id}
            >
              <Text style={styles.acceptButtonText}>
                {accepting === invite.id ? '...' : 'Accept'}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: '/(app)/join-family-code' })}>
          <Text style={styles.secondaryButtonText}>Join a Family</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: '/(app)/create-family' })}>
          <Text style={styles.primaryButtonText}>Create a Family</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.xxl, flexGrow: 1 },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  acceptButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  acceptButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footer: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
  },
  secondaryButton: {
    flex: 1, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});