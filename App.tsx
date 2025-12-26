import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { authStorage } from './lib/auth';
import { AuthContext } from './lib/authContext';
import { customerProfileApi } from './lib/api';

import SignupScreen from './screens/SignupScreen';
import LoginScreen from './screens/LoginScreen';

import MapHomeScreen from './screens/MapHomeScreen';
import VoiceSearchScreen from './screens/VoiceSearchScreen';
import NavigationScreen from './screens/NavigationScreen';
import SuggestPumpsScreen from './screens/SuggestPumpsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';

import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from './screens/OnboardingScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Signup" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
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
    </MainStack.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstLaunch();
    checkAuth();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const value = await AsyncStorage.getItem('hasLaunched');
      if (value === null) {
        setIsFirstLaunch(true);
      } else {
        setIsFirstLaunch(false);
      }
    } catch (error) {
      console.log('Error checking launch status:', error);
      setIsFirstLaunch(false); // Default to false if error to allow app usage
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkSubscription();
    }
  }, [isAuthenticated]);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      setIsFirstLaunch(false);
    } catch (error) {
      console.log('Error saving launch status:', error);
    }
  };

  const checkSubscription = async () => {
    try {
      const profile = await customerProfileApi.get();
      if (profile?.user?.subscriptionType && profile?.user?.subscriptionEndsAt) {
        const endDate = new Date(profile.user.subscriptionEndsAt);
        if (endDate > new Date()) {
          setHasSubscription(true);
          return;
        }
      }
      setHasSubscription(false);
    } catch (error) {
      console.log('Failed to check subscription:', error);
      setHasSubscription(false);
    }
  };

  const checkAuth = async () => {
    const authenticated = await authStorage.isAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      await checkSubscription();
    }
  };

  if (isAuthenticated === null || isFirstLaunch === null) {
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
    <AuthContext.Provider value={{
      isAuthenticated: !!isAuthenticated,
      setIsAuthenticated,
      checkAuth,
      hasSubscription,
      checkSubscription
    }}>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {isFirstLaunch ? (
            <RootStack.Screen name="Onboarding">
              {props => <OnboardingScreen {...props} onComplete={handleOnboardingComplete} />}
            </RootStack.Screen>
          ) : isAuthenticated ? (
            hasSubscription ? (
              <RootStack.Screen name="Main" component={MainNavigator} />
            ) : (
              <RootStack.Screen name="SubscriptionAuth" component={SubscriptionScreen} initialParams={{ isMandatory: true }} />
            )
          ) : (
            <RootStack.Screen name="Auth" component={AuthNavigator} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
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
