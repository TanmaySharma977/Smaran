import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { colors, spacing, radius } from '../../constants/theme';

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

export default function EditProfile() {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('name, date_of_birth, blood_group').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? '');
          setDob(data.date_of_birth ? new Date(data.date_of_birth) : null);
          setBloodGroup(data.blood_group);
        }
      });
  }, [session]);

  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      name: name.trim(),
      date_of_birth: dob ? dob.toISOString().slice(0, 10) : null,
      blood_group: bloodGroup,
    }).eq('id', session!.user.id);
    setSaving(false);
    if (error) return Alert.alert('Could not save', error.message);
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()}><Text style={styles.cancel}>Cancel</Text></Pressable>
        <Text style={styles.navTitle}>Edit profile</Text>
        <Pressable onPress={save} disabled={saving}><Text style={styles.save}>{saving ? '...' : 'Save'}</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>NAME</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.sectionLabel}>DATE OF BIRTH</Text>
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={{ fontSize: 16, color: dob ? colors.text : colors.textSecondary }}>
            {dob ? dob.toDateString() : 'Select date'}
          </Text>
        </Pressable>
        {age !== null && <Text style={styles.hint}>Age: {age} years (calculated automatically)</Text>}

        {showPicker && (
          <DateTimePicker
            value={dob ?? new Date(1960, 0, 1)}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              if (Platform.OS === 'android') setShowPicker(false);
              if (selected) setDob(selected);
            }}
          />
        )}

        <Text style={styles.sectionLabel}>BLOOD GROUP</Text>
        <View style={styles.chipRow}>
          {BLOOD_GROUPS.map((bg) => (
            <Pressable key={bg} onPress={() => setBloodGroup(bg)} style={[styles.chip, bloodGroup === bg && styles.chipActive]}>
              <Text style={[styles.chipText, bloodGroup === bg && styles.chipTextActive]}>{bg}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancel: { fontSize: 16, color: colors.textSecondary },
  navTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  save: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  content: { padding: spacing.lg },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.text },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
});