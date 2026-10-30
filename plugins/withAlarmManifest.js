const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAlarmManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];

    // Ensure the application block has its receiver and service array tracking containers ready
    if (!app.receiver) app.receiver = [];
    if (!app.service) app.service = [];

    // 1. Register the native BroadcastReceiver to handle exact alarms and system boots
    const hasReceiver = app.receiver.some(
      (r) => r.$['android:name'] === 'com.tanmaysharma977.app.AlarmReceiver'
    );
    
    if (!hasReceiver) {
      app.receiver.push({
        $: {
          'android:name': 'com.tanmaysharma977.app.AlarmReceiver',
          'android:enabled': 'true',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } }
            ],
          },
        ],
      });
      console.log('[withAlarmManifest] Registered Custom AlarmReceiver with Boot intents.');
    }

    // 2. Register the custom background AlarmService with explicit Android 14 type
    const hasService = app.service.some(
      (s) => s.$['android:name'] === 'com.tanmaysharma977.app.AlarmService'
    );

    if (!hasService) {
      app.service.push({
        $: {
          'android:name': 'com.tanmaysharma977.app.AlarmService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse', // Critical for Android 14+ wake-locks
        },
      });
      console.log('[withAlarmManifest] Registered Custom AlarmService with foregroundServiceType.');
    }

    return config;
  });
};
