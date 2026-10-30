import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { colors, spacing, radius } from '../../constants/theme';

const ROLES = [
  { key: 'elder', label: 'Elder', desc: 'Receives alarms, can send SOS' },
  { key: 'child', label: 'Child', desc: 'Manages alarms, views dashboard' },
  { key: 'caregiver', label: 'Caregiver', desc: 'Helps manage an elder\'s care' },
];

export default function JoinFamilyCodeScreen() {
  const { refreshFamilyStatus } = useAuth();
  const [code, setCode] = useState('');
  const [role, setRole] = useState('child');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc('join_family_by_code', {
      code: code.trim().toUpperCase(),
      member_role: role,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Could not join', error.message);
      return;
    }

    await refreshFamilyStatus();
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a family</Text>
      <Text style={styles.subtitle}>Enter the invite code you were given.</Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. SHARMA-4821"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
      />

      <Text style={styles.sectionLabel}>I AM JOINING AS</Text>
      <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
        {ROLES.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setRole(r.key)}
            style={[styles.roleCard, role === r.key && styles.roleCardActive]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleLabel, role === r.key && styles.roleLabelActive]}>{r.label}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={handleJoin} disabled={loading || !code.trim()}>
        <Text style={styles.buttonText}>{loading ? 'Joining...' : 'Join Family'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.text, marginBottom: spacing.lg, letterSpacing: 1,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: spacing.sm },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.background },
  roleLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  roleLabelActive: { color: colors.primary },
  roleDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

