import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AlarmSettings() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [alarm, setAlarm] = useState<any>(null);
  const [qty, setQty] = useState(0);
  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, true, true]);
  const [vibrate, setVibrate] = useState(true);
  const [snoozeOn, setSnoozeOn] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('family_dashboard_alarms');
    const found = ((data as any[]) ?? []).find((a) => a.schedule_id === scheduleId);
    setAlarm(found);
    setQty(found?.quantity ?? 0);
  }, [scheduleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

async function saveTime(newTime: Date) {
  const hh = String(newTime.getHours()).padStart(2, '0');
  const mm = String(newTime.getMinutes()).padStart(2, '0');
  const { error } = await supabase
    .from('medicine_schedules')
    .update({ scheduled_time: `${hh}:${mm}:00` })
    .eq('id', scheduleId);
  if (error) Alert.alert('Could not update time', error.message);
  else load();
}

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.6,
    base64: true,
  });
  if (result.canceled) return;

  setUploadingImage(true);
  const asset = result.assets[0];
  const fileExt = asset.uri.split('.').pop();
  const path = `${alarm.medicine_id}-${Date.now()}.${fileExt}`;

  const base64 = asset.base64!;
  const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from('medicine-images')
    .upload(path, byteArray, { contentType: asset.mimeType ?? 'image/jpeg' });

  if (uploadError) {
    setUploadingImage(false);
    return Alert.alert('Upload failed', uploadError.message);
  }

  const { data: urlData } = supabase.storage.from('medicine-images').getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('medicines')
    .update({ image_url: urlData.publicUrl })
    .eq('id', alarm.medicine_id);

  setUploadingImage(false);
  if (updateError) Alert.alert('Could not save image', updateError.message);
  else load();
}

  async function saveStock(newQty: number) {
    if (newQty < 0) return;
    setQty(newQty);
    setSaving(true);
    const { error } = await supabase.rpc('update_medicine_stock', {
      p_medicine_id: alarm.medicine_id,
      p_new_quantity: newQty,
      p_reason: 'Adjusted from alarm settings',
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not update stock', error.message);
      load();
    }
  }

  function applyCustom() {
    const n = parseInt(customVal, 10);
    setCustomOpen(false);
    if (!isNaN(n) && n >= 0) saveStock(n);
  }

  async function handleDelete() {
    Alert.alert('Delete alarm?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_alarm', { p_schedule_id: scheduleId });
          if (error) return Alert.alert('Could not delete', error.message);
          router.back();
        },
      },
    ]);
  }

  const time = alarm?.scheduled_time?.slice(0, 5) ?? '--:--';
  const [hh, mm] = time.split(':');
  const hour = parseInt(hh, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>Edit alarm</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeText}>{hour12}:{mm}</Text>
          <Text style={styles.timePeriod}>{period}</Text>
        </View>

        <View style={styles.daysRow}>
          {DAYS.map((d, i) => (
            <Pressable
              key={i}
              onPress={() => setDays((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
              style={[styles.dayChip, days[i] && styles.dayChipActive]}
            >
              <Text style={[styles.dayText, days[i] && styles.dayTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.medicineBanner}>
          <Ionicons name="medkit" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.medName}>{alarm?.medicine_name ?? '—'}</Text>
            <Text style={styles.medDose}>{alarm?.dosage ?? ''} · for {alarm?.member_name ?? ''}</Text>
          </View>
        </View>

<Text style={styles.sectionLabel}>TIME</Text>
<Pressable style={styles.medicineBanner} onPress={() => setTimePickerOpen(true)}>
  <Ionicons name="time-outline" size={20} color={colors.primary} />
  <Text style={{ fontSize: 20, fontWeight: '300', color: colors.text }}>{time}</Text>
</Pressable>

<Text style={styles.sectionLabel}>PHOTO</Text>
<Pressable style={styles.medicineBanner} onPress={pickImage} disabled={uploadingImage}>
  <Ionicons name="image-outline" size={20} color={colors.primary} />
  <Text style={{ fontSize: 15, color: colors.text }}>
    {uploadingImage ? 'Uploading...' : alarm?.image_url ? 'Change photo' : 'Add a photo'}
  </Text>
</Pressable>

{timePickerOpen && (
  <DateTimePicker
    value={new Date(2000, 0, 1, hour, parseInt(mm, 10))}
    mode="time"
    onChange={(_, selected) => {
      setTimePickerOpen(false);
      if (selected) saveTime(selected);
    }}
  />
)}

        <Text style={styles.sectionLabel}>MEDICINE COUNT</Text>
        <View style={styles.stockCard}>
          <Pressable style={styles.stepper} onPress={() => saveStock(qty - 1)} disabled={qty <= 0 || saving}>
            <Ionicons name="remove" size={26} color={qty <= 0 ? colors.border : colors.text} />
          </Pressable>

          <Pressable style={styles.qtyTouch} onPress={() => { setCustomVal(String(qty)); setCustomOpen(true); }}>
            <Text style={styles.qtyValue}>{qty}</Text>
            <Text style={styles.qtyUnit}>tablets</Text>
          </Pressable>

          <Pressable style={styles.stepper} onPress={() => saveStock(qty + 1)} disabled={saving}>
            <Ionicons name="add" size={26} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.stockHint}>Tap the number to enter a custom amount. Every change is logged.</Text>

        <Text style={styles.sectionLabel}>OPTIONS</Text>
        <View style={styles.group}>
          <View style={styles.optRow}>
            <Text style={styles.optLabel}>Alarm sound</Text>
            <Text style={styles.optValue}>Morning Glory</Text>
          </View>
          <View style={styles.optRow}>
            <Text style={styles.optLabel}>Vibration</Text>
            <Switch value={vibrate} onValueChange={setVibrate} />
          </View>
          <View style={styles.optRow}>
            <Text style={styles.optLabel}>Snooze</Text>
            <Switch value={snoozeOn} onValueChange={setSnoozeOn} />
          </View>
          <View style={styles.optRow}>
            <Text style={styles.optLabel}>Repeat interval</Text>
            <Text style={styles.optValue}>15 min</Text>
          </View>
        </View>

        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete alarm</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={customOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set quantity</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={customVal}
              onChangeText={setCustomVal}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalBtn} onPress={() => setCustomOpen(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={applyCustom}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Set</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  timeBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingVertical: spacing.lg },
  timeText: { fontSize: 68, fontWeight: '200', color: colors.text, letterSpacing: -3 },
  timePeriod: { fontSize: 24, fontWeight: '500', color: colors.textSecondary, marginBottom: 14 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  dayChip: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  dayTextActive: { color: '#fff' },
  medicineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  medName: { fontSize: 16, fontWeight: '600', color: colors.text },
  medDose: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  stockCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  stepper: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  qtyTouch: { alignItems: 'center', flex: 1 },
  qtyValue: { fontSize: 36, fontWeight: '600', color: colors.text, letterSpacing: -1 },
  qtyUnit: { fontSize: 12, color: colors.textSecondary },
  stockHint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, minHeight: 52,
  },
  optLabel: { fontSize: 16, color: colors.text },
  optValue: { fontSize: 15, color: colors.textSecondary },
  deleteBtn: { alignItems: 'center', marginTop: spacing.xl, padding: spacing.md },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '500' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 320 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  modalInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md,
    fontSize: 28, textAlign: 'center', color: colors.text, backgroundColor: colors.surface,
  },
  modalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surface },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
});