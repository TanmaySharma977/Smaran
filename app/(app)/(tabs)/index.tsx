import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ImageBackground, Animated, Alert, Platform
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import {
  attachForegroundHandler,
  openFullScreenAlarmSettings,
  requestNotificationPermission,
  scheduleNativeAlarms,
  sendPushToTokens,
} from '../../../lib/notifications';
import { colors, spacing, radius } from '../../../constants/theme';
import notifee, { AndroidImportance, AndroidVisibility, EventType } from 'react-native-notify-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

type Alarm = {
  schedule_id: string;
  medicine_id: string;
  medicine_name: string;
  dosage: string | null;
  image_url: string | null;
  quantity: number;
  low_stock_threshold: number;
  scheduled_time: string;
  member_id?: string;
  member_name?: string;
};

const SOS_HOLD_MS = 3000;

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { time: `${hour12}:${String(m).padStart(2, '0')}`, period };
}

function stockLabel(qty: number, threshold: number) {
  if (qty <= 0) return { text: 'Out of stock', color: colors.danger };
  if (qty <= threshold) return { text: `${qty} left · Refill soon`, color: '#FF9500' };
  return { text: `${qty} left`, color: '#34C759' };
}

export default function AlarmsHome() {
  const { role } = useAuth();
  const isElder = role === 'elder';

  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [sosSent, setSosSent] = useState(false);
  const holdTimer = useRef<any>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const navigatedForSchedule = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc(isElder ? 'my_alarms' : 'family_dashboard_alarms');
    const rows = (data as Alarm[]) ?? [];
    if (!error) setAlarms(rows);
    if (isElder) {
      navigatedForSchedule.current = null; 
      await scheduleNativeAlarms(rows);
    }
    setLoading(false);
  }, [isElder]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openRingingScreen(data: any, notificationId: string) {
    if (!data?.scheduleId) return;
    if (navigatedForSchedule.current === data.scheduleId) return;
    navigatedForSchedule.current = data.scheduleId;
    router.replace({
      pathname: '/(app)/alarm-ringing',
      params: { scheduleId: data.scheduleId, medicineName: data.medicineName, dosage: data.dosage, notificationId },
    });
  }

  useEffect(() => {
    (async () => {
      requestNotificationPermission();

      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const isSos = notification.request.content.data?.isSos;
          return {
            shouldShowAlert: !isSos, 
            shouldShowBanner: !isSos,
            shouldShowList: !isSos,
            shouldPlaySound: !isSos,
            shouldSetBadge: false,
          };
        },
      });

      if (!isElder) return;

      const initial = await notifee.getInitialNotification();
      if (initial?.notification?.data?.scheduleId) {
        openRingingScreen(initial.notification.data, initial.notification.id!);
        return; 
      }

      const alreadyAsked = await AsyncStorage.getItem('full_screen_alarm_prompted');
      if (alreadyAsked) return;

      Alert.alert(
        'Enable Full-Screen Alarms',
        "To make sure medicine alarms wake the screen like a real alarm clock, please allow full-screen notifications for this app.",
        [
          { text: 'Not now', style: 'cancel', onPress: () => AsyncStorage.setItem('full_screen_alarm_prompted', '1') },
          { text: 'Open Settings', onPress: async () => {
            await AsyncStorage.setItem('full_screen_alarm_prompted', '1');
            openFullScreenAlarmSettings();
          }},
        ]
      );
    })();

    const unsubscribeForeground = attachForegroundHandler();

    const expoSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      
      // If the dynamic push target data contains the SOS flag, hand execution over to Notifee
      if (data?.isSos === 'true') {
        await notifee.displayNotification({
          title: notification.request.content.title || '🚨 EMERGENCY: SOS',
          body: notification.request.content.body || 'Family member needs assistance!',
          android: {
            channelId: 'medication-alarms',
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            autoCancel: false,
            ongoing: true,   // Prevents the user from swiping the alert away
            loopSound: true, // Continuously plays the hardware alarm audio
            fullScreenAction: {
              id: 'default',
              mainComponent: 'main', // Wakes the lock screen layout immediately
            },
            pressAction: { id: 'default' },
            actions: [
              { title: '🛑 Close Alarm', pressAction: { id: 'dismiss_sos' } },
            ],
          },
        });
      }
    });

    const unsubscribeEvents = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        openRingingScreen(detail.notification?.data, detail.notification!.id!);
      }
      if (type === EventType.DELIVERED) {
        const scheduleId = detail.notification?.data?.scheduleId as string | undefined;
        if (scheduleId) {
          await supabase.rpc('record_medication_event', { p_schedule_id: scheduleId, p_action: 'due' });
        }
      }
    });

    return () => {
      unsubscribeForeground();
      expoSubscription.remove();
      unsubscribeEvents();
    };
  }, [isElder]);

  function startHold() {
    setSosSent(false);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, { toValue: 1, duration: SOS_HOLD_MS, useNativeDriver: false }).start();
    holdTimer.current = setTimeout(triggerSos, SOS_HOLD_MS);
  }

  function cancelHold() {
    clearTimeout(holdTimer.current);
    Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  // FIX: Fixed the loop crash and added an emergency dialer fallback configuration mechanism
  async function triggerSos() {
  try {
    setSosSent(true);
    
    // 1. Invoke the database cluster mutation logic
    const { data, error } = await supabase.rpc('trigger_sos', { 
      p_message: 'SOS Pressed: Elderly Family Member Needs Assistance!' 
    });
    
    if (error) throw error;
    
    // 2. Extract push tokens safely from the family database rows response
    const tokens = Array.isArray(data) 
      ? data.map((r) => r.push_token).filter(Boolean) 
      : [];
    
    // 3. Broadcast the alarm-like push payload to the entire family cluster
    if (tokens.length > 0) {
      await sendPushToTokens(
        tokens, 
        '🚨 EMERGENCY: FAMILY SOS', 
        'An elderly family member has triggered an SOS alert. Please check the app immediately!'
      );
      Alert.alert('SOS Dispatched', 'An alarm-style alert notification has been broadcast to all family members.');
    } else {
      console.warn('[SOS Broadcast] No active push tokens registered for this family cluster.');
      Alert.alert(
        'Alert Logged', 
        'The emergency event was logged on the server, but no family members have active device push tokens.'
      );
    }
  } catch (err: any) {
    console.error('[SOS Pipeline Failure]:', err);
    Alert.alert(
      'Broadcast Failed', 
      `Could not dispatch family emergency token updates: ${err.message || 'Network offline'}`
    );
    setSosSent(false); // Reset hold animation state on explicit error drop
  }
}



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{isElder ? 'My Medicines' : 'Alarms'}</Text>
          <Text style={styles.subtitle}>{alarms.length} scheduled today</Text>
        </View>
        {!isElder && (
          <Pressable style={styles.addButton} onPress={() => router.push('/(app)/add-alarm')}>
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        )}
      </View>

      {isElder && (
        <View style={styles.sosArea}>
          <Pressable onPressIn={startHold} onPressOut={cancelHold} style={styles.sosButton}>
            <Animated.View
              style={[
                styles.sosProgress,
                {
                  transform: [{
                    scale: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] }),
                  }],
                  opacity: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                },
              ]}
            />
            <Ionicons name="warning" size={30} color="#fff" />
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
          <Text style={styles.sosHint}>{sosSent ? 'Help is on the way' : 'Hold 3 seconds in an emergency'}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {!loading && alarms.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="alarm-outline" size={44} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No alarms yet</Text>
            {!isElder && <Text style={styles.emptySub}>Add a medicine reminder to get started.</Text>}
          </View>
        )}

        {alarms.map((a) => {
          const { time, period } = formatTime(a.scheduled_time);
          const stock = stockLabel(a.quantity, a.low_stock_threshold);
          return (
            <Pressable
              key={a.schedule_id}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => !isElder && router.push(`/(app)/alarm-settings?scheduleId=${a.schedule_id}`)}
            >
              <ImageBackground
                source={a.image_url ? { uri: a.image_url } : undefined}
                style={styles.cardBg}
                imageStyle={styles.cardBgImage}
              >
                <View style={styles.cardOverlay}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTime}>{time}</Text>
                    <Text style={styles.cardPeriod}>{period}</Text>
                  </View>
                  <Text style={styles.cardMedicine}>{a.medicine_name}</Text>
                  {a.dosage ? <Text style={styles.cardDosage}>{a.dosage}</Text> : null}
                  <Text style={[styles.cardStock, { color: stock.color }]}>{stock.text}</Text>
                </View>
              </ImageBackground>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.sm,
  },
  title: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  addButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sosArea: { alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  sosButton: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  sosProgress: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#7A0000' },
  sosText: { color: '#fff', fontWeight: '700', fontSize: 12, marginTop: 1 },
  sosHint: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  cardBg: { minHeight: 150, backgroundColor: colors.surface },
  cardBgImage: { opacity: 0.25 },
  cardOverlay: { padding: spacing.md, flex: 1, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  cardTime: { fontSize: 40, fontWeight: '300', color: colors.text, letterSpacing: -1.5 },
  cardPeriod: { fontSize: 17, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  cardMedicine: { fontSize: 19, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  cardDosage: { fontSize: 14, color: colors.textSecondary, marginTop: 1 },
  cardStock: { fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  memberPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.background, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  memberName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  stockText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 14, color: colors.textSecondary },
});