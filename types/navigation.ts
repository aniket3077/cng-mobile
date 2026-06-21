import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as Location from 'expo-location';

export type StationNavigationTarget = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  fuelTypes: string;
  phone?: string;
  openingHours?: string;
  isPartner: boolean;
  cngAvailable?: boolean;
  cngQuantityKg?: number | null;
  crowdLevel?: 'low' | 'medium' | 'high';
  crowdCount?: number;
  estimatedWaitTime?: number;
};

export type AppStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  EnterOtp: {
    identifier?: string;
    sessionToken?: string;
    maskedDestination?: string;
    expiresAt?: number;
    resendAvailableAt?: number;
    remainingAttempts?: number;
  };
  ResetPassword: {
    identifier?: string;
    resetToken?: string;
    sessionToken?: string;
    maskedDestination?: string;
  };
  MapHome:
    | {
        targetStation?: StationNavigationTarget | null;
        autoNavigate?: boolean | null;
      }
    | undefined;
  VoiceSearch: undefined;
  Navigation: {
    station: StationNavigationTarget;
    currentLocation: Location.LocationObject;
  };
  SuggestPumps: undefined;
  Profile: undefined;
  Subscription:
    | {
        isMandatory?: boolean;
      }
    | undefined;
  SubscriptionAuth: {
    isMandatory: boolean;
  };
  Referral: undefined;
  Payout: undefined;
  Payment:
    | {
        planId?: string;
        planName?: string;
        amountRupees?: number;
        color?: string;
        autoPay?: boolean;
      }
    | undefined;
  VehicleGarage: undefined;
};

export type AppScreenProps<RouteName extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, RouteName>;
