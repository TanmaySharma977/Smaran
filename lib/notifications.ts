import notifee, {
  AndroidImportance, AndroidVisibility, TriggerType, RepeatFrequency, EventType, AuthorizationStatus, AndroidNotificationSetting
} from 'react-native-notify-kit';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';
import * as IntentLauncher from 'expo-intent-launcher';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleRealAlarm } from './nativeAlarm';

const CUSTOM_SOUND_KEY = 'custom_alarm_sound_uri';
const CUSTOM_SOUND_NAME_KEY = 'custom_alarm_sound_name';
const CHANNEL_ID = 'medication-alarms';
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/**
 * Calculates the next epoch millisecond timestamp for a given hour and minute.
 * If the time has already passed today, it accurately advances to tomorrow.
 */
function nextOccurrenceMillis(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

/* ==========================================
   🎵 CUSTOM SOUND HANDLING 
   ========================================== */

export async function pickCustomAlarmSound(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const permanentUri = `${FileSystem.documentDirectory}alarm-sound-${Date.now()}.${asset.name.split('.').pop()}`;
  await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

  await AsyncStorage.setItem(CUSTOM_SOUND_KEY, permanentUri);
  await AsyncStorage.setItem(CUSTOM_SOUND_NAME_KEY, asset.name);
  return { uri: permanentUri, name: asset.name };
}

export async function getCustomAlarmSound(): Promise<{ uri: string; name: string } | null> {
  const uri = await AsyncStorage.getItem(CUSTOM_SOUND_KEY);
  const name = await AsyncStorage.getItem(CUSTOM_SOUND_NAME_KEY);
  if (!uri) return null;
  const exists = await FileSystem.getInfoAsync(uri);
  if (!exists.exists) return null;
  return { uri, name: name ?? 'Custom sound' };
}

export async function clearCustomAlarmSound() {
  const existing = await getCustomAlarmSound();
  if (existing) await FileSystem.deleteAsync(existing.uri, { idempotent: true });
  await AsyncStorage.removeItem(CUSTOM_SOUND_KEY);
  await AsyncStorage.removeItem(CUSTOM_SOUND_NAME_KEY);
}

/* ==========================================
   🚨 NOTIFICATION STRATEGY & WINDOWS
   ========================================== */

export async function openFullScreenAlarmSettings() {
  const pkg = Constants.expoConfig?.android?.package;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
      { data: `package:${pkg}` }
    );
  } catch {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
      { extra: { 'android.provider.extra.APP_PACKAGE': pkg } }
    );
  }
}

export async function setupNotificationChannel() {
  // NOTE: If using a custom sound bundled via app.json config plugins, 
  // change 'default' to your registered sound string asset identifier.
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Medication Alarms',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default', 
    vibration: true,
    bypassDnd: true,
  });
}

export async function requestNotificationPermission() {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
}

async function displayAlarm(
  scheduleId: string, medicineName: string, dosage: string | null, timestamp: number, repeatDaily: boolean
) {
  // CRITICAL ANDROID DEAD-APP FIX: Ensure Android system permissions allow the application
  // to fire precise exact hardware timers before trying to assign the trigger loop.
  if (Platform.OS === 'android') {
    const settings = await notifee.getNotificationSettings();
    if (settings.android.alarm === AndroidNotificationSetting.DISABLED) {
      console.warn("Exact Alarms permission disabled. Native system engine will throttle this task.");
    }
  }

  await notifee.createTriggerNotification(
    {
      title: `⏰ Time for ${medicineName}`,
      body: dosage ?? 'Time to take your medicine.',
      data: { scheduleId, medicineName, dosage: dosage ?? '' },
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        autoCancel: false,
        ongoing: true, // Prevents swipe-to-dismiss on lockscreen
        loopSound: true,
        fullScreenAction: { id: 'default',
          mainComponent: 'main',
         }, // Necessary execution to jump past lockscreen
        pressAction: { id: 'default' },
        actions: [
          { title: '✓ Taken', pressAction: { id: 'taken' } },
          { title: "⏰ I'll take later", pressAction: { id: 'snooze' } },
        ],
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp,
      ...(repeatDaily ? { repeatFrequency: RepeatFrequency.DAILY } : {}),
      // THE FIX: Registers the timing sequence directly with the Android AlarmManager OS level.
      // Allows the device to awaken instantly out of deep Doze Mode when the screen is off.
      alarmManager: Platform.OS === 'android' ? {
        allowWhileIdle: true,
      } : undefined,
    }
  );
}

export async function scheduleNativeAlarms(
  alarms: { schedule_id: string; medicine_name: string; dosage: string | null; scheduled_time: string }[]
) {
  for (const a of alarms) {
    const [h, m] = a.scheduled_time.split(':').map(Number);
    // Maps to native Android AlarmManager / iOS AlarmKit bridges
    await scheduleRealAlarm(a.schedule_id, a.medicine_name, a.dosage, nextOccurrenceMillis(h, m));
  }
}

export async function scheduleSnoozeAlarm(
  medicineName: string, dosage: string | null, scheduleId: string, minutes: number
) {
  await setupNotificationChannel();
  const timestamp = Date.now() + minutes * 60 * 1000;
  await displayAlarm(scheduleId, medicineName, dosage, timestamp, false);
}

/* ==========================================
   🔄 LIFE-CYCLE ACTIONS HANDLERS
   ========================================== */

/**
 * Handles actionable intents coming out of the notification payload.
 * Shared across background and foreground modules.
 */
export async function handleNotificationAction(type: EventType, detail: any) {
  const { notification, pressAction } = detail;
  if (!notification) return;

  // 🚨 NEW: Clear the looping sound and dismiss the screen if "Close Alarm" is pressed
  if (type === EventType.ACTION_PRESS && pressAction?.id === 'dismiss_sos') {
    console.log('[SOS Notification]: User dismissed the emergency alarm audio loop.');
    await notifee.cancelNotification(notification.id!); // Cancels the specific alert instance, turning off the sound
    return;
  }
  const scheduleId = notification?.data?.scheduleId as string | undefined;
  if (!scheduleId) return;

  if (type === EventType.ACTION_PRESS && pressAction?.id === 'taken') {
    await supabase.rpc('record_medication_event', { p_schedule_id: scheduleId, p_action: 'taken' });
    await notifee.cancelNotification(notification!.id!);
  }
  
  if (type === EventType.ACTION_PRESS && pressAction?.id === 'snooze') {
    const { data } = await supabase.rpc('record_medication_event', { p_schedule_id: scheduleId, p_action: 'snooze' });
    const row = (data as any[])?.[0];
    await notifee.cancelNotification(notification!.id!);
    if (row) {
      await scheduleSnoozeAlarm(
        notification!.data!.medicineName as string, 
        notification!.data!.dosage as string, 
        scheduleId, 
        row.reminder_interval_minutes
      );
    }
  }
}

export function attachForegroundHandler() {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    await handleNotificationAction(type, detail);
  });
}

/* ==========================================
   📡 REMOTE PUSH SYSTEM HANDLERS
   ========================================== */

export async function sendPushToTokens(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: 'default', priority: 'high', channelId: 'medication-alarms' }))),
  });
}

export async function registerPushToken(userId: string) {
  if (isExpoGo || !Notifications || !Device) return;
  
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  if (!Device.isDevice) return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await supabase.from('device_push_tokens').upsert(
      { user_id: userId, token: tokenData.data, platform: Platform.OS },
      { onConflict: 'token' }
    );
  } catch (e) {
    console.error('[notif] push token registration failed:', e);
  }
}
