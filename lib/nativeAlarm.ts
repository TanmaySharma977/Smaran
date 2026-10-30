import { Alert, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import Application from 'expo-constants';
import notifee, { TriggerType, AndroidImportance, AndroidVisibility, AndroidNotificationSetting } from 'react-native-notify-kit';

const CHANNEL_ID = 'medication-alarms';

export async function scheduleRealAlarm(
  scheduleId: string, 
  medicineName: string, 
  dosage: string | null, 
  triggerAtMillis: number
) {
  try {
    if (Platform.OS === 'android') {
      const settings = await notifee.getNotificationSettings();
      if (settings.android.alarm === AndroidNotificationSetting.DISABLED) {
        const error = new Error('Permission Required');
        (error as any).code = 'PERMISSION_DENIED';
        throw error;
      }
    }

    // Natively registers the exact hardware alarm with the Linux kernel via Notifee
    await notifee.createTriggerNotification(
      {
        id: scheduleId,
        title: `⏰ Time for ${medicineName}`,
        body: dosage ?? 'Time to take your medicine.',
        data: { scheduleId, medicineName, dosage: dosage ?? '' },
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          autoCancel: false,
          ongoing: true, 
          loopSound: true, 
          fullScreenAction: { id: 'default' }, 
          pressAction: { id: 'default' },
          actions: [
            { title: '✓ Taken', pressAction: { id: 'taken' } },
            { title: "⏰ I'll take later", pressAction: { id: 'snooze' } },
          ],
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerAtMillis,
        alarmManager: Platform.OS === 'android' ? {
          allowWhileIdle: true,
        } : undefined,
      }
    );

    console.log(`[alarm] High-priority hardware alarm confirmed for ${medicineName}`);

  } catch (err: any) {
    console.error('[alarm] Hardware commit pass aborted:', err);

    if (err.code === 'PERMISSION_DENIED' && Platform.OS === 'android') {
      Alert.alert(
        'Permission Required',
        'To wake the screen precisely for your medication, this app requires the "Alarms & Reminders" permission toggle to be turned on.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: async () => {
              const pkg = Application.expoConfig?.android?.package || 'com.smaran';
              try {
                await IntentLauncher.startActivityAsync(
                  'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
                  { data: `package:${pkg}` }
                );
              } catch {
                await IntentLauncher.startActivityAsync(
                  IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                  { data: `package:${pkg}` }
                );
              }
            }
          }
        ]
      );
    }
  }
}

export async function cancelRealAlarm(scheduleId: string) {
  await notifee.cancelNotification(scheduleId);
  console.log(`[alarm] Alarm tracking loop cancelled for ID: ${scheduleId}`);
}
