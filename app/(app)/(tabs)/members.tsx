import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { colors, spacing, radius } from '../../../constants/theme';

type Member = {
  id: string;
  role: string;
  relationship: string | null;
  profiles: { name: string; avatar_url: string | null; date_of_birth: string | null; blood_group: string | null } | null;
  alarmCount: number;
};

function ageFrom(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: rows } = await supabase
      .from('family_members')
      .select('id, role, relationship, profiles(name, avatar_url, date_of_birth, blood_group)')
      .eq('status', 'active');

    const { data: alarms } = await supabase.rpc('family_dashboard_alarms');

    const counts: Record<string, number> = {};
    ((alarms as any[]) ?? []).forEach((a) => {
      counts[a.member_id] = (counts[a.member_id] ?? 0) + 1;
    });

    setMembers(((rows as any[]) ?? []).map((r) => ({ ...r, alarmCount: counts[r.id] ?? 0 })));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle}>{members.length} in your family</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {members.map((m) => {
          const p = m.profiles;
          const age = ageFrom(p?.date_of_birth ?? null);
          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => router.push(`/(app)/member/${m.id}`)}
            >
              {p?.avatar_url ? (
                <Image source={{ uri: p.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{p?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p?.name ?? 'Unknown'}</Text>
                <Text style={styles.meta}>
                  {[m.relationship ?? m.role, age ? `${age} yrs` : null, p?.blood_group]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <View style={styles.alarmRow}>
                  <Ionicons name="alarm-outline" size={13} color={colors.primary} />
                  <Text style={styles.alarmText}>
                    {m.alarmCount} {m.alarmCount === 1 ? 'alarm' : 'alarms'} / day
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md },
  title: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '600' },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  alarmText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});