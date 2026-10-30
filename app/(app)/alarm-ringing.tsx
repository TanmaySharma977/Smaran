import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform, BackHandler } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import notifee from 'react-native-notify-kit';
import { supabase } from '../../lib/supabase';
import {
  scheduleSnoozeAlarm,
  getCustomAlarmSound,
} from '../../lib/notifications';
import { colors, spacing, radius } from '../../constants/theme';

export default function AlarmRinging() {
  const {
    scheduleId,
    medicineName,
    dosage,
    notificationId,
  } = useLocalSearchParams<{
    scheduleId: string;
    medicineName: string;
    dosage: string;
    notificationId: string;
  }>();

  const [busy, setBusy] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    let mounted = true;

    const startAlarm = async () => {
      try {
        // 1. Force audio configuration to bypass silent physical hardware toggles
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: false,
        });

        if (!mounted) return;

        // 2. Safely read storage to check for a custom user-selected audio track
        const custom = await getCustomAlarmSound();
        if (!mounted) return;

        // 3. Instantiate the player dynamically to prevent race conditions on asset swap
        const audioSource = custom?.uri 
          ? { uri: custom.uri } 
          : require('../../assets/sounds/alarm.mp3');

        const nextPlayer = createAudioPlayer(audioSource);
        playerRef.current = nextPlayer;

        nextPlayer.loop = true;
        nextPlayer.volume = 1.0;
        nextPlayer.play();
      } catch (error) {
        console.error('Failed to initialize dynamic alarm sound pipeline:', error);
      }
    };

    startAlarm();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.pause();

          // AudioPlayer does not expose terminate() in expo-audio; use its
          // available async unload if provided, otherwise just pause.
          const player = playerRef.current as any;
          if (typeof player.unloadAsync === 'function') {
            void player.unloadAsync();
          }
        } catch (error) {
          console.error('Failed to release audio hardware track resources:', error);
        }
      }
    };
  }, []);

  async function stopSound() {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch (error) {
        console.error('Failed to halt active alarm playback stream:', error);
      }
    }
  }

  async function handleTaken() {
    if (busy) return;
    setBusy(true);

    try {
      await stopSound();

      // Fire mutation track update to Supabase engine
      await supabase.rpc('record_medication_event', {
        p_schedule_id: scheduleId,
        p_action: 'taken',
      });

      if (notificationId) {
        await notifee.cancelNotification(notificationId);
      }

      // 3. AUTO-CLOSE APP: Instantly shuts down the UI process and locks/clears screen
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      router.replace('/(app)/(tabs)');
    }
    } catch (error) {
      console.error('Failed to commit medication token status:', error);
      // Fallback navigation out of lock state even if database connection drops
      if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      router.replace('/(app)/(tabs)');
    }
    }
  }

  async function handleSnooze() {
    if (busy) return;
    setBusy(true);

    try {
      await stopSound();

      const { data } = await supabase.rpc('record_medication_event', {
        p_schedule_id: scheduleId,
        p_action: 'snooze',
      });

      const row = (data as any[])?.[0];

      if (notificationId) {
        await notifee.cancelNotification(notificationId);
      }

      // Schedule the next alert based on database configurations
      if (row?.reminder_interval_minutes) {
        await scheduleSnoozeAlarm(
          medicineName,
          dosage,
          scheduleId,
          row.reminder_interval_minutes
        );
      } else {
        // Fallback default if row calculation object returns empty packages
        await scheduleSnoozeAlarm(medicineName, dosage, scheduleId, 10);
      }

      if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      router.replace('/(app)/(tabs)');
    }
    } catch (error) {
      console.error('Network block encountered during snooze event loop:', error);
      
      // CRITICAL OFFLINE FALLBACK: Safeguard user health by enforcing a 10-minute snooze if offline
      if (notificationId) {
        await notifee.cancelNotification(notificationId).catch(() => {});
      }
      await scheduleSnoozeAlarm(medicineName, dosage, scheduleId, 10);
      
      if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      router.replace('/(app)/(tabs)');
    }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏰</Text>
      <Text style={styles.title}>{medicineName}</Text>
      {dosage ? <Text style={styles.dosage}>{dosage}</Text> : null}

      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, styles.snoozeButton]}
          onPress={handleSnooze}
          disabled={busy}
        >
          <Text style={styles.buttonText}>⏰ I'll take later</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.takenButton]}
          onPress={handleTaken}
          disabled={busy}
        >
          <Text style={[styles.buttonText, { color: '#fff' }]}>✓ Taken</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  dosage: {
    fontSize: 17,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  buttons: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  snoozeButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  takenButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
});
