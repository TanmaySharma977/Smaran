import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius } from '../../constants/theme';

type MemberOption = {
  member_id: string;
  member_name: string;
  role: string;
  relationship: string | null;
};

function fmt(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function toSqlTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

export default function AddAlarm() {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [quantity, setQuantity] = useState('30');
  const [threshold, setThreshold] = useState('7');

  const [times, setTimes] = useState<Date[]>([new Date(new Date().setHours(8, 0, 0, 0))]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [tempTime, setTempTime] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('family_member_options');
    if (!error && data) {
      setMembers(data as MemberOption[]);
      if (!memberId && (data as MemberOption[]).length > 0) {
        setMemberId((data as MemberOption[])[0].member_id);
      }
    }
  }, [memberId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openPicker(index: number) {
    setTempTime(times[index]);
    setPickerIndex(index);
  }

  function onPickerChange(event: any, selected?: Date) {
    if (Platform.OS === 'android') {
      setPickerIndex(null);
      if (event.type === 'set' && selected && pickerIndex !== null) {
        setTimes((prev) => prev.map((t, i) => (i === pickerIndex ? selected : t)));
      }
      return;
    }
    if (selected) setTempTime(selected);
  }

  function confirmIosTime() {
    if (pickerIndex !== null) {
      setTimes((prev) => prev.map((t, i) => (i === pickerIndex ? tempTime : t)));
    }
    setPickerIndex(null);
  }

  function addTime() {
    setTimes((prev) => [...prev, new Date(new Date().setHours(20, 0, 0, 0))]);
  }

  function removeTime(index: number) {
    if (times.length === 1) return;
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!memberId) return Alert.alert('Pick a member', 'Choose who this alarm is for.');
    if (!name.trim()) return Alert.alert('Medicine name required');

    setSaving(true);
    const { error } = await supabase.rpc('create_medicine_with_schedules', {
      p_member_id: memberId,
      p_name: name.trim(),
      p_dosage: dosage.trim() || null,
      p_unit: 'tablet',
      p_quantity: parseInt(quantity, 10) || 0,
      p_low_stock_threshold: parseInt(threshold, 10) || 7,
      p_times: times.map(toSqlTime),
      p_reminder_interval_minutes: 15,
      p_image_url: null,
    });
    setSaving(false);

    if (error) return Alert.alert('Could not save', error.message);
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>New alarm</Text>
        <Pressable onPress={save} disabled={saving}>
          <Text style={[styles.save, saving && { opacity: 0.4 }]}>
            {saving ? 'Saving' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>FOR WHOM</Text>
        <View style={styles.memberRow}>
          {members.map((m) => (
            <Pressable
              key={m.member_id}
              onPress={() => setMemberId(m.member_id)}
              style={[styles.memberChip, memberId === m.member_id && styles.memberChipActive]}
            >
              <Text
                style={[styles.memberChipText, memberId === m.member_id && styles.memberChipTextActive]}
              >
                {m.member_name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>MEDICINE</Text>
        <View style={styles.group}>
          <TextInput
            style={styles.input}
            placeholder="Name (e.g. Metformin)"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.input}
            placeholder="Dosage (e.g. 500 mg, 1 tablet)"
            placeholderTextColor={colors.textSecondary}
            value={dosage}
            onChangeText={setDosage}
          />
        </View>

        <Text style={styles.sectionLabel}>TIMES</Text>
        <View style={styles.group}>
          {times.map((t, i) => (
            <View key={i}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.timeRow}>
                <Pressable style={{ flex: 1 }} onPress={() => openPicker(i)}>
                  <Text style={styles.timeText}>{fmt(t)}</Text>
                </Pressable>
                {times.length > 1 && (
                  <Pressable onPress={() => removeTime(i)} hitSlop={10}>
                    <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
        <Pressable style={styles.addTimeBtn} onPress={addTime}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addTimeText}>Add another time</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>STOCK</Text>
        <View style={styles.group}>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Current quantity</Text>
            <TextInput
              style={styles.stockInput}
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Warn me below</Text>
            <TextInput
              style={styles.stockInput}
              keyboardType="number-pad"
              value={threshold}
              onChangeText={setThreshold}
            />
          </View>
        </View>
        <Text style={styles.hint}>
          Stock never changes automatically when a dose is taken. You update it yourself, and every
          change is recorded.
        </Text>
      </ScrollView>

      {/* Android renders the picker as its own dialog; iOS needs a wrapper modal */}
      {pickerIndex !== null && Platform.OS === 'android' && (
        <DateTimePicker value={times[pickerIndex]} mode="time" is24Hour={false} onChange={onPickerChange} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={pickerIndex !== null} transparent animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <DateTimePicker value={tempTime} mode="time" display="spinner" onChange={onPickerChange} />
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalBtn} onPress={() => setPickerIndex(null)}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={confirmIosTime}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { fontSize: 16, color: colors.textSecondary },
  navTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  save: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  memberChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  memberChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  memberChipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  memberChipTextActive: { color: '#fff' },
  group: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  input: { padding: spacing.md, fontSize: 16, color: colors.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  timeText: { fontSize: 26, fontWeight: '300', color: colors.text, letterSpacing: -0.5 },
  addTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.md },
  addTimeText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  stockLabel: { fontSize: 16, color: colors.text },
  stockInput: {
    fontSize: 17, color: colors.text, textAlign: 'right', minWidth: 64,
    backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 17 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surface },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
});