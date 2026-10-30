import 'expo-router/entry';

import notifee, { EventType } from 'react-native-notify-kit';
import { supabase } from './lib/supabase';

/**
 * Ensures a valid authenticated session exists during headless background execution.
 * If the current token is expired, it forces a refresh via the saved Refresh Token.
 */
async function ensureValidSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    // If the session is missing or expired, attempt a forced refresh using AsyncStorage values
    const { data: { session: refreshedSession }, error: refreshError } = 
      await supabase.auth.refreshSession();
      
    if (refreshError || !refreshedSession) {
      throw new Error(`Background auth recovery failed: ${refreshError?.message || 'No session'}`);
    }
    return refreshedSession;
  }
  return session;
}

// Crucial Architecture for Dead App Alarms:
// This handler executes globally in a Headless JS environment.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  
  // 🚨 1. NEW SOS DISMISSAL INTERCEPTOR
  // Catches if a family member clicks "🛑 Close Alarm" from a closed or locked device state
  if (type === EventType.ACTION_PRESS && pressAction?.id === 'dismiss_sos') {
    console.log('[bg_notif] Dismissing emergency family SOS loop audio via background intent.');
    if (notification?.id) {
      await notifee.cancelNotification(notification.id);
    }
    return; // Exit execution early so it doesn't drop down into medication logic
  }

  const scheduleId = notification?.data?.scheduleId;
  
  // Handlers for system-level triggers (e.g., Android AlarmManager triggers) 
  // often use DELIVERED or DISMISSED events when forcing hardware screen wake-ups.
  if (!scheduleId) return;

  try {
    // Force authenticating your headless thread prior to running network mutations
    await ensureValidSession();

    // 2. ACTION: User clicked "✓ Taken"
    if (type === EventType.ACTION_PRESS && pressAction?.id === 'taken') {
      const { error } = await supabase.rpc('record_medication_event', { 
        p_schedule_id: scheduleId, 
        p_action: 'taken' 
      });
      
      if (error) console.error('[bg_notif] RPC error (Taken):', error.message);
      if (notification?.id) await notifee.cancelNotification(notification.id);
    }

    // 3. ACTION: User clicked "⏰ I'll take later" (Snooze)
    if (type === EventType.ACTION_PRESS && pressAction?.id === 'snooze') {
      const { data, error } = await supabase.rpc('record_medication_event', { 
        p_schedule_id: scheduleId, 
        p_action: 'snooze' 
      });
      
      if (error) console.error('[bg_notif] RPC error (Snooze):', error.message);
      
      const row = data?.[0];
      if (notification?.id) await notifee.cancelNotification(notification.id);
      
      if (row?.reminder_interval_minutes && notification?.data) {
        const { scheduleSnoozeAlarm } = await import('./lib/notifications');
        await scheduleSnoozeAlarm(
          notification.data.medicineName,
          notification.data.dosage,
          scheduleId,
          row.reminder_interval_minutes
        );
      }
    }
  } catch (err) {
    console.error('[bg_notif] Session validation or background process aborted:', err.message);
    
    // FALLBACK OVERRIDE: If your database sync completely fails because the user is offline 
    // or unauthenticated, fire a local fallback notification so they don't miss their medication.
    if (type === EventType.ACTION_PRESS && pressAction?.id === 'snooze' && notification?.data) {
      const { scheduleSnoozeAlarm } = await import('./lib/notifications');
      await scheduleSnoozeAlarm(
        notification.data.medicineName,
        notification.data.dosage,
        scheduleId,
        10 // Fallback to a hardcoded 10-minute snooze if DB retrieval breaks
      );
    }
    if (notification?.id) await notifee.cancelNotification(notification.id);
  }
});
