import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius } from '../../constants/theme';

export default function InviteCodeScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');

  useEffect(() => {
    supabase.rpc('my_family_invite_code').then(({ data }) => {
      const row = (data as any)?.[0];
      if (row) { setCode(row.invite_code); setFamilyName(row.family_name); }
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.navTitle}>Invite code</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>Share this code so others can join {familyName}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{code ?? '...'}</Text>
        </View>
        <Pressable
          style={styles.shareBtn}
          onPress={() => code && Share.share({ message: `Join our family on Smaran! Use code: ${code}` })}
        >
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.shareText}>Share code</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  navTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  codeBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl, marginBottom: spacing.xl },
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 2, color: colors.text },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  shareText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});