import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius } from '../../constants/theme';
import { useAuth } from '@/lib/AuthContext';

export default function CreateFamilyScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshFamilyStatus } = useAuth()
  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('create_family', { family_name: name.trim() });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    const invite_code = (data as any)?.[0]?.invite_code;
    Alert.alert('Family created!', `Share this code with family: ${invite_code}`, [
      { text: 'Continue', onPress: async () => {
        await refreshFamilyStatus();
        router.replace('/');
      } },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your family</Text>
      <Text style={styles.subtitle}>You'll be the admin and can invite others after.</Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. Sharma Family"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Pressable style={styles.button} onPress={handleCreate} disabled={loading || !name.trim()}>
        <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Family'}</Text>
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
    borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.text, marginBottom: spacing.lg,
  },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});