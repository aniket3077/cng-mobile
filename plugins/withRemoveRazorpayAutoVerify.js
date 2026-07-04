const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to remove 'android:autoVerify="true"' from Razorpay's DeepLinkActivity.
 * This resolves Google Play Console deep link verification warnings for domains you don't own
 * (like 'pg-router.dev.razorpay.in' and your package name 'com.aniket3077.cngbharatmobile').
 */
module.exports = function withRemoveRazorpayAutoVerify(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    if (!mainApplication || !mainApplication.activity) {
      return config;
    }

    // Find or create the Razorpay DeepLinkActivity in our manifest
    let deepLinkActivity = mainApplication.activity.find(
      (activity) =>
        activity.$ &&
        activity.$['android:name'] &&
        activity.$['android:name'].toLowerCase() === 'com.razorpay.deeplinkactivity'
    );

    if (!deepLinkActivity) {
      // Since it is declared in the Razorpay SDK, it won't be in our template manifest yet.
      // We explicitly add it here with tools:node="merge" and an intent-filter with tools:node="removeAll".
      // During Gradle build, the manifest merger will combine this with the SDK's manifest
      // and strip the problematic web intent-filters.
      deepLinkActivity = {
        $: {
          'android:name': 'com.razorpay.DeepLinkActivity',
          'tools:node': 'merge',
        },
        'intent-filter': [
          {
            $: {
              'tools:node': 'removeAll',
            },
          },
        ],
      };
      mainApplication.activity.push(deepLinkActivity);
    } else {
      // If it already exists in the manifest for some reason, override it to remove all intent-filters
      deepLinkActivity.$['tools:node'] = 'merge';
      deepLinkActivity['intent-filter'] = [
        {
          $: {
            'tools:node': 'removeAll',
          },
        },
      ];
    }

    return config;
  });
};
