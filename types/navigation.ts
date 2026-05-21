import { NativeStackScreenProps } from '@react-navigation/native-stack';

export interface VoiceNavigationStation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  fuelTypes: string;
  isPartner: boolean;
  cngAvailable?: boolean;
  cngQuantityKg?: number | null;
}

export type AppStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
  SubscriptionAuth: { isMandatory?: boolean } | undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  EnterOtp: { identifier: string } | undefined;
  ResetPassword: { identifier: string } | undefined;
  MapHome:
    | {
        targetStation?: VoiceNavigationStation | null;
        autoNavigate?: boolean | null;
      }
    | undefined;
  VoiceSearch: undefined;
  Navigation: undefined;
  SuggestPumps: undefined;
  Profile: undefined;
  Subscription: { isMandatory?: boolean } | undefined;
  Referral: undefined;
  Payout: undefined;
  Payment:
    | {
        planId: string;
        planName: string;
        amountRupees: number;
        color?: string;
        autoPay?: boolean;
      }
    | undefined;
  VehicleGarage: undefined;
};

export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;
