import type { ExpoConfig } from 'expo/config';
import 'dotenv/config';

const config: ExpoConfig = {
  name: 'CNG Bharat',
  slug: 'cng',
  owner: 'aniket04',
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
  ],
  extra: {
    apiUrl: 'https://cng-backend.vercel.app',
    eas: {
      projectId: 'c6511ef7-d1fc-41c5-9488-15973c944462'
    }
  },
};

export default config;
