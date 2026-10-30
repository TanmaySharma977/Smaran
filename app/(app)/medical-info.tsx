import { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { colors, spacing, radius } from '../../constants/theme';

export default function MedicalInfo() {
  const { session } = useAuth();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: fm } = await supabase.from('family_members').select('id').eq('user_id', session.user.id).eq('status', 'active').maybeSingle();
    if (!fm) return;
    setMemberId(fm.id);
    const { data } = await supabase.from('medical_conditions').select('id, name, notes').eq('member_id', fm.id);
    setConditions(data ?? []);
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function addCondition() {
    if (!newName.trim() || !memberId) return;
    setAdding(true);
    const { error } = await supabase.from('medical_conditions').insert({ member_id: memberId, name: newName.trim() });
    setAdding(false);
    if (error) return Alert.alert('Could not add', error.message);
    setNewName('');
    load();
  }

  async function removeCondition(id: string) {
    await supabase.from('medical_conditions').delete().eq('id', id);
    load();
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.navTitle}>Medical information</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.lg }}
        data={conditions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Add a condition (e.g. Diabetes)"
              placeholderTextColor={colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
            />
            <Pressable style={styles.addBtn} onPress={addCondition} disabled={adding}>
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.conditionRow}>
            <Ionicons name="medical-outline" size={18} color={colors.primary} />
            <Text style={styles.conditionName}>{item.name}</Text>
            <Pressable onPress={() => removeCondition(item.id)} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conditions recorded</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  navTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  addInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.text },
  addBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  conditionName: { flex: 1, fontSize: 16, color: colors.text },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
});