import type { ExpoConfig } from 'expo/config';
import 'dotenv/config';

const config: ExpoConfig = {
  name: 'CNG Bharat',
  slug: 'cng',
  owner: 'Aniket Bankar',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.cngbharat.mobile',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    package: 'com.cngbharat.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow CNG Bharat to use your location to find nearby CNG stations.',
      },
    ],
    "expo-font",
    [
      "expo-build-properties",
      {
        "android": {
          "compileSdkVersion": 35,
          "targetSdkVersion": 35,
          "buildToolsVersion": "35.0.0",
          "kotlinVersion": "2.0.20"
        },
        "ios": {
          "deploymentTarget": "15.1"
        }
      }
    ]
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://cng-backend.vercel.app/api',
    eas: {
      projectId: '79d64e0b-bd39-4338-9ea5-bbcbe758783d'
    }
  },
};

export default config;
