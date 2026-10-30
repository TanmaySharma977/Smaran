import { Redirect, useRouter, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { colors } from '../constants/theme';
import { setupNotificationChannel } from '@/lib/notifications';
import { useEffect, useState } from 'react';
import notifee from 'react-native-notify-kit';

export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { session, loading, familyStatus } = useAuth();
  
  const [checkingNotification, setCheckingNotification] = useState(true);
  const [pendingAlarm, setPendingAlarm] = useState<{
    scheduleId: string;
    medicineName: string;
    dosage: string;
    notificationId: string;
  } | null>(null);

  useEffect(() => {
    setupNotificationChannel();

    const checkIntents = async () => {
      try {
        // 1. Give the JS bridge 150ms to mount and stabilize the Native launch intent data
        await new Promise((resolve) => setTimeout(resolve, 150));

        // 2. Initial attempt to read traditional open intents
        const detail = await notifee.getInitialNotification();
        
        if (detail && detail.notification?.data?.scheduleId) {
          setPendingAlarm({
            scheduleId: String(detail.notification.data.scheduleId),
            medicineName: String(detail.notification.data.medicineName),
            dosage: String(detail.notification.data.dosage ?? ''),
            notificationId: String(detail.notification.id ?? ''),
          });
          return;
        }

        // 3. FALLBACK FOR FULL-SCREEN INTENTS: If it's a cold boot triggered by fullScreenAction,
        // look directly at the active displayed notifications pool on the device.
        const displayed = await notifee.getDisplayedNotifications();
        const activeAlarm = displayed.find(n => n.notification?.data?.scheduleId);

        if (activeAlarm && activeAlarm.notification) {
          const { scheduleId, medicineName, dosage } = activeAlarm.notification.data || {};
          if (scheduleId) {
            setPendingAlarm({
              scheduleId: String(scheduleId),
              medicineName: String(medicineName ?? 'Medicine Reminder'),
              dosage: String(dosage ?? ''),
              notificationId: String(activeAlarm.notification.id ?? ''),
            });
            return;
          }
        }
      } catch (err) {
        console.error('[Cold Boot Core] Intent scanning pipeline dropped:', err);
      } finally {
        setCheckingNotification(false);
      }
    };

    checkIntents();
  }, []);

  // Redirect to the alarm screen layout immediately when Expo Router's navigation is ready
  useEffect(() => {
    if (!rootNavigationState?.key || !pendingAlarm) return;

    router.replace(
      `/alarm-ringing?scheduleId=${pendingAlarm.scheduleId}&medicineName=${encodeURIComponent(pendingAlarm.medicineName)}&dosage=${encodeURIComponent(pendingAlarm.dosage)}&notificationId=${pendingAlarm.notificationId}` as any
    );
  }, [rootNavigationState?.key, pendingAlarm, router]);

  if (loading || (checkingNotification && pendingAlarm === null) || (session && familyStatus === 'loading')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (pendingAlarm) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href={"/(auth)/login" as any} />;
  if (familyStatus === 'no_family') return <Redirect href={"/(app)/join-family" as any} />;
  return <Redirect href={"/(app)/(tabs)" as any} />;
}
