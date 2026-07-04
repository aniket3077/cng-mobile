import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Image, AppState, Linking } from 'react-native';
import { AuthContext, useAuthContextValue } from './lib/authContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { appStorage } from './lib/appStorage';
import { useAppStore } from './lib/store/appStore';
import { storageKeys } from './lib/storageKeys';
import { AppStackParamList } from './types/navigation';

import SignupScreen from './screens/SignupScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import EnterOtpScreen from './screens/EnterOtpScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';

import MapHomeScreen from './screens/MapHomeScreen';
import VoiceSearchScreen from './screens/VoiceSearchScreen';
import NavigationScreen from './screens/NavigationScreen';
import SuggestPumpsScreen from './screens/SuggestPumpsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import ReferralScreen from './screens/ReferralScreen';
import PayoutScreen from './screens/PayoutScreen';
import PaymentScreen from './screens/PaymentScreen';
import VehicleGarageScreen from './screens/VehicleGarageScreen';

import OnboardingScreen from './screens/OnboardingScreen';
import { onLogout } from './lib/events';

const AuthStack = createNativeStackNavigator<AppStackParamList>();
const MainStack = createNativeStackNavigator<AppStackParamList>();
const RootStack = createNativeStackNavigator<AppStackParamList>();

function extractReferralCode(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get('code')?.trim().toUpperCase();
    const route = `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase();

    if (!code || !route.includes('referral')) {
      return null;
    }

    return code;
  } catch {
    const codeMatch = url.match(/[?&]code=([^&#]+)/i);
    if (!codeMatch || !url.toLowerCase().includes('referral')) {
      return null;
    }

    return decodeURIComponent(codeMatch[1]).trim().toUpperCase() || null;
  }
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Signup" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="EnterOtp" component={EnterOtpScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <MainStack.Screen
        name="MapHome"
        component={MapHomeScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="VoiceSearch"
        component={VoiceSearchScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="Navigation"
        component={NavigationScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="SuggestPumps"
        component={SuggestPumpsScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="Payout"
        component={PayoutScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="VehicleGarage"
        component={VehicleGarageScreen}
        options={{ headerShown: false }}
      />
    </MainStack.Navigator>
  );
}

export default function App() {
  const authContextValue = useAuthContextValue();
  const bootStatus = useAppStore((state) => state.bootStatus);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const hasSubscription = useAppStore((state) => state.hasSubscription);
  const isFirstLaunch = useAppStore((state) => state.isFirstLaunch);
  const initializeApp = useAppStore((state) => state.initializeApp);
  const refreshAccessState = useAppStore((state) => state.refreshAccessState);
  const logout = useAppStore((state) => state.logout);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  useEffect(() => {
    void initializeApp();

    // Listen for global logout events (401)
    const unsubscribe = onLogout(() => {
      void logout();
    });

    return () => unsubscribe();
  }, [initializeApp, logout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isAuthenticated) {
        void refreshAccessState();
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, refreshAccessState]);

  useEffect(() => {
    const persistReferralCode = async (url: string | null) => {
      const referralCode = extractReferralCode(url);
      if (referralCode) {
        await appStorage.setItem(storageKeys.pendingReferralCode, referralCode);
      }
    };

    void Linking.getInitialURL().then((url) => {
      void persistReferralCode(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      void persistReferralCode(event.url);
    });

    return () => subscription.remove();
  }, []);

  if (bootStatus === 'loading' || isFirstLaunch === null) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('./assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="large" color="#0EA5E9" style={styles.loader} />
      </View>
    );
  }

  return (
    <AppErrorBoundary onRetry={() => void initializeApp()}>
      <AuthContext.Provider value={authContextValue}>
        <NavigationContainer>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {isFirstLaunch ? (
              <RootStack.Screen name="Onboarding">
                {props => <OnboardingScreen {...props} onComplete={completeOnboarding} />}
              </RootStack.Screen>
            ) : isAuthenticated ? (
              hasSubscription ? (
                <RootStack.Screen name="Main" component={MainNavigator} />
              ) : (
                <RootStack.Screen
                  name="SubscriptionAuth"
                  component={SubscriptionScreen}
                  initialParams={{ isMandatory: true }}
                />
              )
            ) : (
              <RootStack.Screen name="Auth" component={AuthNavigator} />
            )}
            <RootStack.Screen name="Payment" component={PaymentScreen} />
          </RootStack.Navigator>
        </NavigationContainer>
      </AuthContext.Provider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  loader: {
    marginTop: 8,
  },
});
