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
  getPasswordStrength,
  passwordResetStorage,
  PasswordResetSession,
} from '../lib/passwordReset';

const { height } = Dimensions.get('window');

interface Props {
  navigation: any;
  route: any;
}

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [session, setSession] = useState<PasswordResetSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

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
    const loadSession = async () => {
      const savedSession = await passwordResetStorage.getSession();
      const routeIdentifier = route?.params?.identifier;
      const sessionExpired = !savedSession?.resetTokenExpiresAt || savedSession.resetTokenExpiresAt <= Date.now();

      if (
        !savedSession ||
        !savedSession.resetToken ||
        sessionExpired ||
        (routeIdentifier && savedSession.identifier !== routeIdentifier)
      ) {
        await passwordResetStorage.clearSession();
        setIsLoadingSession(false);
        Alert.alert('Reset Session Expired', 'Please verify a fresh OTP to reset your password.', [
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

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = Boolean(session?.resetToken) && passwordStrength.isValid && passwordsMatch;

  const handleResetPassword = async () => {
    if (!session?.resetToken) {
      Alert.alert('Reset Session Expired', 'Please verify a fresh OTP to continue.');
      navigation.replace('ForgotPassword');
      return;
    }

    if (!passwordsMatch) {
      Alert.alert('Passwords Do Not Match', 'Please confirm your new password.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.resetPassword({
        identifier: session.identifier,
        resetToken: session.resetToken,
        newPassword,
      });

      if (response.success ?? true) {
        await passwordResetStorage.clearSession();
        Alert.alert(
          'Password Updated',
          'Your password has been reset successfully. Please sign in with your new password.',
          [
            {
              text: 'Go to Login',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Unable to Reset Password', response.message || 'Please try again.');
      }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to reset password. Please try again.';
      const shouldRestartFlow =
        message.toLowerCase().includes('expired') || message.toLowerCase().includes('session');

      if (shouldRestartFlow) {
        await passwordResetStorage.clearSession();
        Alert.alert('Reset Session Expired', message, [
          {
            text: 'Start Again',
            onPress: () => navigation.replace('ForgotPassword'),
          },
        ]);
        return;
      }

      Alert.alert('Unable to Reset Password', message);
    } finally {
      setLoading(false);
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
          <Text style={styles.appName}>Create New Password</Text>
          <Text style={styles.tagline}>Choose a secure password for your account</Text>
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
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Your OTP has been verified for {session.deliveryTarget}. Set your new password
                below.
              </Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#10B981" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor="#9CA3AF"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password-new"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((currentValue) => !currentValue)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password-new"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((currentValue) => !currentValue)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordCard}>
                <View style={styles.passwordHeader}>
                  <Text style={styles.passwordCardTitle}>Password strength</Text>
                  <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>

                {passwordStrength.rules.map((rule) => (
                  <View key={rule.label} style={styles.passwordRuleRow}>
                    <Ionicons
                      name={rule.met ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={rule.met ? '#059669' : '#9CA3AF'}
                    />
                    <Text style={[styles.passwordRuleText, rule.met && styles.passwordRuleTextMet]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}

                {confirmPassword.length > 0 && (
                  <View style={styles.passwordRuleRow}>
                    <Ionicons
                      name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={passwordsMatch ? '#059669' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.passwordRuleText,
                        passwordsMatch ? styles.passwordRuleTextMet : styles.passwordRuleTextError,
                      ]}
                    >
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.resetButton,
                  (loading || !isFormValid) && styles.resetButtonDisabled,
                ]}
                onPress={handleResetPassword}
                disabled={loading || !isFormValid}
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
                      <Text style={styles.resetButtonText}>Update Password</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await passwordResetStorage.clearSession();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }}
                style={styles.backContainer}
                disabled={loading}
              >
                <Text style={styles.backLink}>Cancel and return to login</Text>
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
    fontSize: 28,
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
  eyeButton: {
    padding: spacing.xs,
  },
  passwordCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  passwordCardTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
  },
  passwordStrengthText: {
    fontSize: 13,
    fontWeight: '700',
  },
  passwordRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  passwordRuleText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  passwordRuleTextMet: {
    color: '#059669',
  },
  passwordRuleTextError: {
    color: '#DC2626',
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
  backContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  backLink: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
});
