const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAlarmClockModule(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];

    if (!app.receiver) app.receiver = [];
    if (!app.service) app.service = [];

    const hasReceiver = app.receiver.some((r) => r.$['android:name'] === 'com.tanmaysharma977.app.AlarmReceiver');
    const hasService = app.service.some((s) => s.$['android:name'] === 'com.tanmaysharma977.app.AlarmForegroundService');

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
    }

    if (!hasService) {
      app.service.push({
        $: {
          'android:name': 'com.tanmaysharma977.app.AlarmForegroundService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        property: [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'Medication scheduling exact alarm engine activation context.',
            },
          },
        ],
      });
    }

    return config;
  });
};
