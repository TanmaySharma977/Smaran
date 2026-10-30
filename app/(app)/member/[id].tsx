import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { colors, spacing, radius } from '../../../constants/theme';

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<any>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: m } = await supabase
      .from('family_members')
      .select('id, role, relationship, profiles(name, avatar_url, date_of_birth, blood_group, phone)')
      .eq('id', id)
      .maybeSingle();
    setMember(m);

    const { data: c } = await supabase
      .from('medical_conditions')
      .select('id, name, notes, diagnosed_on')
      .eq('member_id', id);
    setConditions(c ?? []);

    const { data: a } = await supabase.rpc('family_dashboard_alarms');
    setAlarms(((a as any[]) ?? []).filter((x) => x.member_id === id));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const p = member?.profiles;
  const age = p?.date_of_birth
    ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Members</Text>
      </Pressable>

      <View style={styles.hero}>
        {p?.avatar_url ? (
          <Image source={{ uri: p.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{p?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <Text style={styles.name}>{p?.name ?? '—'}</Text>
        <Text style={styles.relationship}>{member?.relationship ?? member?.role ?? ''}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{age ?? '—'}</Text>
          <Text style={styles.statLabel}>Age</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{p?.blood_group ?? '—'}</Text>
          <Text style={styles.statLabel}>Blood</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{alarms.length}</Text>
          <Text style={styles.statLabel}>Alarms</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>CONDITIONS</Text>
      <View style={styles.group}>
        {conditions.length === 0 ? (
          <Text style={styles.emptyRow}>None recorded</Text>
        ) : (
          conditions.map((c) => (
            <View key={c.id} style={styles.conditionRow}>
              <Ionicons name="medical-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.conditionName}>{c.name}</Text>
                {c.notes ? <Text style={styles.conditionNotes}>{c.notes}</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionLabel}>ALARMS</Text>
      <View style={{ gap: spacing.sm }}>
        {alarms.map((a) => (
          <Pressable
            key={a.schedule_id}
            style={styles.alarmCard}
            onPress={() => router.push(`/(app)/alarm-settings?scheduleId=${a.schedule_id}`)}
          >
            <Text style={styles.alarmTime}>{a.scheduled_time?.slice(0, 5)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alarmMed}>{a.medicine_name}</Text>
              <Text style={styles.alarmDose}>{a.dosage ?? ''}</Text>
            </View>
            <Text style={styles.alarmStock}>{a.quantity} left</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  backText: { fontSize: 17, color: colors.primary },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: spacing.md },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 38, fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  relationship: { fontSize: 15, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
  statsRow: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, marginBottom: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  emptyRow: { padding: spacing.md, color: colors.textSecondary, fontSize: 15 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  conditionName: { fontSize: 16, color: colors.text, fontWeight: '500' },
  conditionNotes: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  alarmCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  alarmTime: { fontSize: 20, fontWeight: '300', color: colors.text, width: 62 },
  alarmMed: { fontSize: 15, fontWeight: '600', color: colors.text },
  alarmDose: { fontSize: 12, color: colors.textSecondary },
  alarmStock: { fontSize: 13, color: colors.textSecondary },
});