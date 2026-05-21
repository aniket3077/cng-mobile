import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { customerProfileApi } from '../lib/api';
import { authStorage } from '../lib/auth';
import { useAuth } from '../lib/authContext';
import type { AppStackParamList } from '../types/navigation';

const PLAN_DATA = [
  {
    type: 'free_trial',
    name: 'Free Trial',
    price: 0,
    duration: '5 days',
    accent: ['#0EA5E9', '#14B8A6'] as const,
    badge: 'Explore',
    highlight: false,
    rewardText: 'No referral commission is triggered on trials',
    features: [
      'Experience premium navigation for 5 days',
      'See cashback-inspired wallet previews',
      'Evaluate upgrade intent before billing starts',
    ],
  },
  {
    type: 'monthly',
    name: '30-Day Plan',
    price: 15,
    duration: '30 days',
    accent: ['#4F46E5', '#06B6D4'] as const,
    badge: 'Starter',
    highlight: false,
    rewardText: 'Triggers 20% commission after verified payment',
    features: [
      'Low-friction entry for referred users',
      'Fastest path to referral conversion',
      'Ideal for price-sensitive first purchases',
    ],
  },
  {
    type: 'quarterly',
    name: '180-Day Plan',
    price: 85,
    duration: '180 days',
    accent: ['#0F766E', '#10B981'] as const,
    badge: 'Best Balance',
    highlight: true,
    rewardText: 'Higher LTV while staying conversion-friendly',
    features: [
      'Longer premium access for frequent drivers',
      'Premium routing and wallet unlocks',
      'Best mix of savings and subscription value',
    ],
  },
  {
    type: 'annual_premium',
    name: '365-Day Plan',
    price: 150,
    duration: '365 days',
    accent: ['#F59E0B', '#F97316'] as const,
    badge: 'Power Plan',
    highlight: false,
    rewardText: 'Highest verified commission value per subscriber',
    features: [
      'Full-year premium access and savings',
      'Lowest effective price per day',
      'Designed for long-term subscriber loyalty',
    ],
  },
] as const;

const lightPalette = {
  bg: '#EEF4FF',
  surface: '#FFFFFF',
  surfaceMuted: 'rgba(255, 255, 255, 0.78)',
  text: '#0F172A',
  textSoft: '#475569',
  border: 'rgba(148, 163, 184, 0.24)',
  hero: ['#0B1020', '#111C3E', '#163C76'] as const,
  tint: '#6D5EF8',
};

const darkPalette = {
  bg: '#040814',
  surface: '#0D172B',
  surfaceMuted: 'rgba(13, 23, 43, 0.84)',
  text: '#F8FAFC',
  textSoft: '#A5B4CC',
  border: 'rgba(148, 163, 184, 0.18)',
  hero: ['#040814', '#0B1735', '#123A7A'] as const,
  tint: '#60A5FA',
};

export default function SubscriptionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'Subscription'>>();
  const { checkSubscription } = useAuth();
  const colorScheme = useColorScheme();
  const palette = colorScheme === 'dark' ? darkPalette : lightPalette;
  const isMandatory = route.params?.isMandatory;

  const [selectedPlan, setSelectedPlan] = useState('quarterly');
  const [loading, setLoading] = useState(false);
  const [autoPay, setAutoPay] = useState(true);

  const currentPlan = PLAN_DATA.find((plan) => plan.type === selectedPlan) || PLAN_DATA[2];

  const completeSubscription = async (message?: string) => {
    setLoading(true);
    try {
      const profile = await customerProfileApi.get();
      if (profile?.user) {
        await authStorage.saveUser(profile.user);
      }

      await checkSubscription();
      Alert.alert('Subscription Active', message || `${currentPlan.name} unlocked successfully.`);

      if (!isMandatory) {
        navigation.goBack();
      }
    } catch (_error) {
      Alert.alert('Subscription Active', message || `${currentPlan.name} unlocked successfully.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (selectedPlan === 'free_trial') {
      Alert.alert(
        'Start Free Trial',
        'Trial access starts instantly for 5 days. Referral commission only begins when the first paid plan is verified.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Trial',
            onPress: async () => {
              setLoading(true);
              try {
                await customerProfileApi.subscribe({
                  planType: selectedPlan,
                  autoPay,
                });
                await completeSubscription(
                  autoPay
                    ? 'Free trial activated with 30-day auto-upgrade enabled.'
                    : 'Free trial activated successfully.',
                );
              } catch (_error) {
                Alert.alert('Error', 'Unable to start the free trial right now.');
              } finally {
                setLoading(false);
              }
            },
          },
        ],
      );
      return;
    }

    navigation.navigate('Payment', {
      planId: currentPlan.type,
      planName: currentPlan.name,
      amountRupees: currentPlan.price,
      color: currentPlan.accent[0],
      autoPay,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <LinearGradient colors={palette.hero} style={styles.heroShell}>
        <View style={styles.header}>
          {!isMandatory ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconSpacer} />
          )}
          <Text style={styles.headerTitle}>Premium Plans</Text>
          <View style={styles.iconSpacer} />
        </View>

        <View style={styles.heroContent}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Subscription Commission Engine</Text>
            <Text style={styles.heroTitle}>Convert referrals into verified recurring revenue.</Text>
            <Text style={styles.heroSubtitle}>
              Referrers earn 20% only after the referred user completes their first paid subscription and payment verification succeeds.
            </Text>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroGlassCard}>
              <Text style={styles.heroStatValue}>20%</Text>
              <Text style={styles.heroStatLabel}>First plan commission</Text>
            </View>
            <View style={styles.heroGlassCard}>
              <Text style={styles.heroStatValue}>OTP</Text>
              <Text style={styles.heroStatLabel}>Secure payout flow</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.infoCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIcon, { backgroundColor: `${palette.tint}22` }]}>
              <Ionicons name="sparkles" size={18} color={palette.tint} />
            </View>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Commission policy</Text>
          </View>
          <Text style={[styles.infoBody, { color: palette.textSoft }]}>
            No earnings on signup, free trials, fake accounts, or unpaid plans. Only the first successful paid subscription generates a referral commission.
          </Text>
        </View>

        <View style={styles.planList}>
          {PLAN_DATA.map((plan) => {
            const selected = selectedPlan === plan.type;

            return (
              <TouchableOpacity
                key={plan.type}
                activeOpacity={0.92}
                onPress={() => setSelectedPlan(plan.type)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: selected ? plan.accent[0] : palette.border,
                  },
                  selected && styles.planCardSelected,
                ]}
              >
                <LinearGradient colors={plan.accent} style={styles.planTopBand}>
                  <View>
                    <Text style={styles.planBadge}>{plan.badge}</Text>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planPrice}>₹{plan.price}</Text>
                    <Text style={styles.planDuration}>{plan.duration}</Text>
                  </View>
                  <View style={[styles.selectionDot, selected && styles.selectionDotActive]}>
                    {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  </View>
                </LinearGradient>

                <View style={styles.planBody}>
                  {plan.highlight ? (
                    <View style={styles.popularPill}>
                      <Ionicons name="diamond" size={14} color="#0F172A" />
                      <Text style={styles.popularPillText}>Most balanced for conversion</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.rewardText, { color: palette.text }]}>
                    {plan.rewardText}
                  </Text>

                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={18} color={plan.accent[0]} />
                      <Text style={[styles.featureText, { color: palette.textSoft }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="repeat" size={18} color="#16A34A" />
            </View>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Auto-renewal</Text>
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: palette.text }]}>
                {selectedPlan === 'free_trial' ? 'Auto-upgrade to 30-Day Plan' : 'Keep subscription active'}
              </Text>
              <Text style={[styles.switchBody, { color: palette.textSoft }]}>
                {selectedPlan === 'free_trial'
                  ? 'Automatically move into the 30-Day plan when trial access ends.'
                  : 'Reduce churn and keep premium access running without interruption.'}
              </Text>
            </View>
            <Switch
              value={autoPay}
              onValueChange={setAutoPay}
              trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
              thumbColor={autoPay ? '#16A34A' : '#94A3B8'}
            />
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#2563EB" />
            </View>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Trust and verification</Text>
          </View>
          <Text style={[styles.infoBody, { color: palette.textSoft }]}>
            Payment verification, duplicate-device checks, OTP-secured withdrawals, and suspicious-activity review are all applied before payouts are released.
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.92} onPress={handleSubscribe} disabled={loading}>
          <LinearGradient colors={currentPlan.accent} style={styles.ctaButton}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {currentPlan.type === 'free_trial'
                    ? 'Start Free Trial'
                    : `Activate ${currentPlan.name}`}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => Linking.openURL('https://cngbharat.com/terms')}>
          <Text style={[styles.termsText, { color: palette.textSoft }]}>
            Subscription payment is processed securely. By continuing you agree to the{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>.
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroShell: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 26,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: {
    width: 38,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  heroCopy: {
    gap: 10,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 21,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroGlassCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    padding: 16,
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 18,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  planList: {
    gap: 16,
  },
  planCard: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
  planCardSelected: {
    transform: [{ scale: 1.01 }],
  },
  planTopBand: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planBadge: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  planName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  planPrice: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 12,
  },
  planDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  selectionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionDotActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  planBody: {
    padding: 20,
    gap: 12,
  },
  popularPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  popularPillText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  rewardText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  switchBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  ctaButton: {
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  termsText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
