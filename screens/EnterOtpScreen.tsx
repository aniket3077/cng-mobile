import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../theme';
import { authApi } from '../lib/api';
import {
  formatTimer,
  passwordResetStorage,
  PasswordResetSession,
  sanitizeOtp,
} from '../lib/passwordReset';

const { height } = Dimensions.get('window');

interface Props {
  navigation: any;
  route: any;
}

export default function EnterOtpScreen({ navigation, route }: Props) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [session, setSession] = useState<PasswordResetSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const hiddenOtpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, logoScale, slideAnim]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      const savedSession = await passwordResetStorage.getSession();
      const routeIdentifier = route?.params?.identifier;

      if (!savedSession || (routeIdentifier && savedSession.identifier !== routeIdentifier)) {
        setIsLoadingSession(false);
        Alert.alert('Session Expired', 'Please request a new OTP to continue.', [
          {
            text: 'Start Again',
            onPress: () => navigation.replace('ForgotPassword'),
          },
        ]);
        return;
      }

      setSession(savedSession);
      setIsLoadingSession(false);
    };

    void loadSession();
  }, [navigation, route?.params?.identifier]);

  useEffect(() => {
    if (!isLoadingSession && session) {
      const timeoutId = setTimeout(() => {
        hiddenOtpInputRef.current?.focus();
      }, 250);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoadingSession, session]);

  const otpExpiresIn = session
    ? Math.max(0, Math.ceil((session.otpExpiresAt - currentTime) / 1000))
    : 0;

  const resendAvailableIn = session
    ? Math.max(0, Math.ceil((session.resendAvailableAt - currentTime) / 1000))
    : 0;

  const handleOtpChange = (value: string) => {
    setOtp(sanitizeOtp(value));
  };

  const handleVerifyOtp = async () => {
    if (!session) {
      Alert.alert('Session Expired', 'Please request a new OTP to continue.');
      navigation.replace('ForgotPassword');
      return;
    }

    if (otp.length !== 6) {
      Alert.alert('Incomplete OTP', 'Please enter all 6 digits.');
      return;
    }

    if (otpExpiresIn <= 0) {
      Alert.alert('OTP Expired', 'This OTP has expired. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyOtp({
        identifier: session.identifier,
        otp,
      });

      await passwordResetStorage.updateSession({
        resetToken: response.resetToken,
        resetTokenExpiresAt: Date.now() + (response.resetTokenExpiresIn || 600) * 1000,
      });

      setOtp('');
      navigation.navigate('ResetPassword', {
        identifier: session.identifier,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to verify OTP. Please try again.';
      if (message.toLowerCase().includes('expired')) {
        setOtp('');
      }
      Alert.alert('OTP Verification Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!session || resendAvailableIn > 0) {
      return;
    }

    setResending(true);
    try {
      const response = await authApi.forgotPassword({
        identifier: session.identifier,
      });
      const now = Date.now();
      const nextSession: PasswordResetSession = {
        ...session,
        deliveryChannel: response.deliveryChannel || session.deliveryChannel,
        deliveryTarget: response.deliveryTarget || session.deliveryTarget,
        otpExpiresAt: now + (response.expiresIn || 600) * 1000,
        resendAvailableAt: now + (response.resendAfter || 60) * 1000,
        resetToken: undefined,
        resetTokenExpiresAt: undefined,
      };

      await passwordResetStorage.saveSession(nextSession);
      setSession(nextSession);
      setOtp('');
      hiddenOtpInputRef.current?.focus();
      Alert.alert('OTP Sent', `A new code was sent to ${nextSession.deliveryTarget}.`);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to resend OTP. Please try again.';
      Alert.alert('Unable to Resend OTP', message);
    } finally {
      setResending(false);
    }
  };

  if (isLoadingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#10B981', '#059669', '#047857']}
        style={styles.topSection}
      >
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoCircle}>
            <Image
              source={require('../assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.appName}>Verify OTP</Text>
          <Text style={styles.tagline}>Complete your password reset securely</Text>
        </Animated.View>
      </LinearGradient>

      <View style={styles.formContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to your registered email.
              </Text>

              <View style={styles.infoCard}>
                <Ionicons name="mail-outline" size={18} color="#059669" />
                <Text style={styles.infoText}>{session.deliveryTarget}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={1}
                onPress={() => hiddenOtpInputRef.current?.focus()}
                style={styles.otpWrapper}
              >
                <TextInput
                  ref={hiddenOtpInputRef}
                  style={styles.hiddenOtpInput}
                  value={otp}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const digit = otp[index] || '';
                  const isFocused = index === otp.length && otp.length < 6;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                        isFocused ? styles.otpBoxActive : null,
                      ]}
                    >
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </TouchableOpacity>

              <View style={styles.timerRow}>
                <Text style={styles.timerLabel}>OTP expires in</Text>
                <Text style={styles.timerValue}>{formatTimer(otpExpiresIn)}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  (loading || otp.length !== 6 || otpExpiresIn <= 0) && styles.verifyButtonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length !== 6 || otpExpiresIn <= 0}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.verifyGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.verifyText}>Verify OTP</Text>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                {resendAvailableIn > 0 ? (
                  <Text style={styles.resendTimerText}>
                    Resend OTP in {formatTimer(resendAvailableIn)}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOtp} disabled={resending}>
                    <Text style={styles.resendLink}>
                      {resending ? 'Sending new OTP...' : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.backLinkWrap}
                disabled={loading || resending}
              >
                <Text style={styles.backLink}>Use a different email or mobile number</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  topSection: {
    height: height * 0.35,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fff',
  },
  logoImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  appName: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    marginTop: -30,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: spacing.lg,
    lineHeight: 22,
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 10,
    marginBottom: spacing.xl,
  },
  infoText: {
    flex: 1,
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
  },
  hiddenOtpInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },
  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  timerLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  timerValue: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
  verifyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  verifyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendTimerText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  resendLink: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '700',
  },
  backLinkWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  backLink: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
