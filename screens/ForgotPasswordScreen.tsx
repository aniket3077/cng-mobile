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
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../theme';
import { authApi } from '../lib/api';
import {
  getResetIdentifierError,
  normalizeResetIdentifier,
  passwordResetStorage,
} from '../lib/passwordReset';
import { AppScreenProps } from '../types/navigation';

const { height } = Dimensions.get('window');

type Props = AppScreenProps<'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

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
    const loadExistingSession = async () => {
      const existingSession = await passwordResetStorage.getSession();
      if (existingSession?.identifier) {
        setIdentifier(existingSession.identifier);
      }
    };

    void loadExistingSession();
  }, []);

  const handleForgotPassword = async () => {
    const validationError = getResetIdentifierError(identifier);
    if (validationError) {
      Alert.alert('Invalid Details', validationError);
      return;
    }

    const normalizedIdentifier = normalizeResetIdentifier(identifier);

    setLoading(true);
    try {
      const existingSession = await passwordResetStorage.getSession();
      const response = await authApi.forgotPassword({
        identifier: normalizedIdentifier,
        sessionToken:
          existingSession?.identifier === normalizedIdentifier ? existingSession.sessionToken : undefined,
      });
      const now = Date.now();

      await passwordResetStorage.saveSession({
        deliveryChannel: response.deliveryChannel || 'email',
        deliveryTarget: response.deliveryTarget || normalizedIdentifier,
        identifier: normalizedIdentifier,
        otpExpiresAt: now + (response.expiresIn || 600) * 1000,
        resendAvailableAt: now + (response.resendAfter || 60) * 1000,
        sessionToken: response.sessionToken,
        accountType: response.accountType || 'customer',
      });

      navigation.navigate('EnterOtp', {
        identifier: normalizedIdentifier,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Unable to Send OTP', message);
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.appName}>CNG Bharat</Text>
          <Text style={styles.tagline}>Recover access to your account</Text>
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
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your registered email or mobile number. For security, we will send the OTP
                to the email linked to your account.
              </Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="person-circle-outline" size={20} color="#10B981" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email or Mobile Number"
                  placeholderTextColor="#9CA3AF"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                />
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color="#059669" />
                <Text style={styles.infoText}>
                  Using your mobile number still sends the OTP to your registered email, matching
                  the current secure reset flow.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.resetButton, loading && styles.resetButtonDisabled]}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.resetGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.resetButtonText}>Send OTP</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.backToLoginContainer}>
                <Text style={styles.backToLoginText}>Remember your password? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  disabled={loading}
                >
                  <Text style={styles.backToLoginLink}>Back to Login</Text>
                </TouchableOpacity>
              </View>
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
    fontSize: 32,
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
    marginBottom: spacing.xl,
    lineHeight: 22,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    height: 56,
  },
  inputIconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  resetButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  backToLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  backToLoginText: {
    fontSize: 16,
    color: '#64748b',
    marginRight: spacing.sm,
  },
  backToLoginLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
});
