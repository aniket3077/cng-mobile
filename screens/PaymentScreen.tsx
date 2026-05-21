import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { customerProfileApi } from '../lib/api';
import { authStorage } from '../lib/auth';
import { featureFlags } from '../lib/featureFlags';
import { useAuth } from '../lib/authContext';
import { AppScreenProps } from '../types/navigation';

type Props = AppScreenProps<'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const { isAuthenticated, checkSubscription } = useAuth();
  const planId = route?.params?.planId ?? '1_month';
  const planName = route?.params?.planName ?? 'Monthly Plan';
  const amountRupees = route?.params?.amountRupees ?? 15;
  const color = route?.params?.color ?? '#3B82F6';
  const autoPay = route?.params?.autoPay ?? true;

  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card'>('upi');
  const [loading, setLoading] = useState(false);

  // Independent auth guard: even if navigated to directly, reject unauthenticated users.
  useEffect(() => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to continue with payment.');
      navigation.replace('Login' as any);
    }
  }, [isAuthenticated, navigation]);

  const finalizeSubscription = async (message?: string) => {
    await checkSubscription();
    Alert.alert('Success', message || `${planName} activated successfully!`);
    navigation.goBack();
  };

  const handleContinue = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to continue.');
      return;
    }

    setLoading(true);
    try {
      const orderResponse = await customerProfileApi.createOrder({
        planId,
      });

      if (!orderResponse?.success) {
        Alert.alert('Error', orderResponse.message || 'Failed to create payment order');
        return;
      }

      const RZNative = NativeModules.RNRazorpayCheckout || NativeModules.RazorpayCheckout;

      if (!RZNative) {
        // DEV-ONLY simulation: ONLY available when __DEV__ is true AND the flag is explicitly opt-in.
        // This entire branch is excluded from production builds because __DEV__ is false.
        if (__DEV__ && featureFlags.enableDevPaymentSimulation) {
          Alert.alert(
            '[DEV] Simulate Payment',
            `Razorpay native module not found. Simulate ${selectedMethod === 'upi' ? 'UPI' : 'Card'} payment?`,
            [
              {
                text: 'Simulate',
                onPress: async () => {
                  try {
                    const verifyResponse = await customerProfileApi.verifyPayment({
                      razorpay_order_id: orderResponse.orderId,
                      razorpay_payment_id: `pay_dev_sim_${Date.now()}`,
                      razorpay_signature: `dev_sig_${Date.now()}`,
                      planType: planId,
                    });
                    await finalizeSubscription(
                      verifyResponse?.commission?.reason ?? `${planName} activated (dev sim).`,
                    );
                  } catch {
                    Alert.alert('[DEV] Simulation Failed', 'Backend rejected dev payment. Enable EXPO_PUBLIC_ENABLE_DEV_PAYMENT_SIMULATION.');
                  }
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else {
          // Production: native Razorpay module unavailable — do not offer any bypass.
          Alert.alert(
            'Payment Unavailable',
            'Payment is not available in this environment. Please use the published app to subscribe.'
          );
        }
        return;
      }

      // Fetch real user profile data for Razorpay prefill so receipts are accurate.
      const user = await authStorage.getUser();

      const options = {
        description: `${planName} via ${selectedMethod === 'upi' ? 'UPI' : 'Card'}`,
        image: 'https://cdn-icons-png.flaticon.com/512/2554/2554936.png',
        currency: 'INR',
        key: orderResponse.keyId,
        amount: orderResponse.amount,
        name: 'CNG Bharat',
        order_id: orderResponse.orderId,
        prefill: {
          email: user?.email ?? '',
          contact: user?.phone ?? '',
          name: user?.name ?? '',
        },
        theme: { color },
      };

      try {
        const data = await RazorpayCheckout.open(options);
        const verifyResponse = await customerProfileApi.verifyPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          planType: planId,
        });
        await finalizeSubscription(
          verifyResponse?.commission?.reason ?? `${planName} activated successfully!`,
        );
      } catch (paymentError: any) {
        if (paymentError?.code === 0 || paymentError?.code === 'PAYMENT_CANCELLED') {
          Alert.alert('Payment Cancelled', 'You cancelled the process.');
        } else {
          Alert.alert('Payment Failed', paymentError?.description ?? paymentError?.message ?? 'Unknown error');
        }
      }
    } catch {
      Alert.alert('Error', 'Unable to initialize payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Choose Payment Method</Text>
        <Text style={styles.subtitle}>{planName}</Text>

        <View style={styles.amountPill}>
          <Text style={styles.amountLabel}>Payable Amount</Text>
          <Text style={styles.amountValue}>INR {amountRupees}</Text>
        </View>

        <TouchableOpacity
          style={[styles.methodCard, selectedMethod === 'upi' && styles.selectedMethodCard]}
          activeOpacity={0.9}
          onPress={() => setSelectedMethod('upi')}
        >
          <View>
            <Text style={styles.methodTitle}>UPI</Text>
            <Text style={styles.methodSubtitle}>Pay using any UPI app</Text>
          </View>
          <View style={[styles.radio, selectedMethod === 'upi' && styles.radioActive]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodCard, selectedMethod === 'card' && styles.selectedMethodCard]}
          activeOpacity={0.9}
          onPress={() => setSelectedMethod('card')}
        >
          <View>
            <Text style={styles.methodTitle}>Bank Card</Text>
            <Text style={styles.methodSubtitle}>Credit or debit card</Text>
          </View>
          <View style={[styles.radio, selectedMethod === 'card' && styles.radioActive]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
        </TouchableOpacity>

        <Text style={styles.note}>Your payment is secured by Razorpay.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  amountPill: {
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    color: '#6366F1',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  methodCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selectedMethodCard: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  methodSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9ca3af',
  },
  radioActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});
