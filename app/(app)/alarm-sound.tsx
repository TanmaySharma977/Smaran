import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { pickCustomAlarmSound, getCustomAlarmSound, clearCustomAlarmSound } from '../../lib/notifications';
import { colors, spacing, radius } from '../../constants/theme';

export default function AlarmSoundScreen() {
  const [current, setCurrent] = useState<{ uri: string; name: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const player = useAudioPlayer(require('../../assets/sounds/alarm.mp3'));

  useEffect(() => { getCustomAlarmSound().then(setCurrent); }, []);

  async function choose() {
    const picked = await pickCustomAlarmSound();
    if (picked) setCurrent(picked);
  }

  function preview() {
    if (isPlaying) {
      player.pause();
      player.seekTo(0);
      setIsPlaying(false);
      return;
    }
    if (current?.uri) {
      player.replace({ uri: current.uri });
    } else {
      player.replace(require('../../assets/sounds/alarm.mp3'));
    }
    player.play();
    setIsPlaying(true);
  }

  async function reset() {
    await clearCustomAlarmSound();
    setCurrent(null);
    Alert.alert('Reset', 'Using the default alarm sound now.');
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.navTitle}>Alarm Sound</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ padding: spacing.lg }}>
        <View style={styles.currentBox}>
          <Ionicons name="musical-notes" size={20} color={colors.primary} />
          <Text style={styles.currentText}>{current?.name ?? 'Default alarm sound'}</Text>
        </View>

        <Pressable style={styles.button} onPress={preview}>
          <Text style={styles.buttonText}>{isPlaying ? 'Stop preview' : '▶ Preview'}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={choose}>
          <Text style={styles.buttonText}>Choose a sound file</Text>
        </Pressable>
        {current && (
          <Pressable style={[styles.button, styles.resetButton]} onPress={reset}>
            <Text style={[styles.buttonText, { color: colors.danger }]}>Reset to default</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  navTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  currentBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  currentText: { fontSize: 15, color: colors.text },
  button: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.text },
  resetButton: { borderColor: colors.danger },
});