import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { customerProfileApi } from '../lib/api';
import { authStorage } from '../lib/auth';
import { useAuth } from '../lib/authContext';
import type { AppStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.78;
const CARD_SPACING = 16;
const PEAK_WIDTH = (width - CARD_WIDTH - CARD_SPACING * 2) / 2;

const PLAN_DATA = [
  {
    type: 'free_trial',
    name: 'Free Trial',
    price: 0,
    duration: '5 days',
    accent: '#E9D5FF', // Soft lavender / purple
    badge: 'Explore',
    highlight: false,
    rewardText: 'No commission on trials',
    features: [
      '5-day trial access',
      'Premium navigation & routing',
      'Wallet cashback previews',
    ],
  },
  {
    type: 'monthly',
    name: '30-Day Plan',
    price: 15,
    duration: '30 days',
    accent: '#FEF08A', // Soft yellow / cream
    badge: 'Starter',
    highlight: false,
    rewardText: 'Triggers 20% commission',
    features: [
      '30-day premium navigation',
      'Priority wallet cashback',
      'Duplicate-device checks',
    ],
  },
  {
    type: 'quarterly',
    name: '180-Day Plan',
    price: 85,
    duration: '180 days',
    accent: '#84CC16', // Vibrant lime green (Featured plan matching the screenshot)
    badge: 'Best Balance',
    highlight: true,
    rewardText: 'Triggers 20% commission',
    features: [
      '180-day premium navigation',
      'Priority wallet cashback',
      'Instant referral conversion',
    ],
  },
  {
    type: 'annual_premium',
    name: '365-Day Plan',
    price: 150,
    duration: '365 days',
    accent: '#99F6E4', // Soft pastel teal/mint
    badge: 'Power Plan',
    highlight: false,
    rewardText: 'Triggers 20% commission',
    features: [
      'Full-year premium access',
      'Lowest effective daily rate',
      'Designed for frequent drivers',
    ],
  },
] as const;

const lightPalette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  text: '#0F172A',
  textSoft: '#475569',
  border: '#E2E8F0',
  tint: '#84CC16',
};

const darkPalette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  text: '#0F172A',
  textSoft: '#475569',
  border: '#E2E8F0',
  tint: '#84CC16',
};

interface FAQItemProps {
  question: string;
  answer: string;
  palette: typeof lightPalette;
}

function FAQItem({ question, answer, palette }: FAQItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setExpanded(!expanded)}
      style={[
        styles.faqCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: palette.text }]}>{question}</Text>
        <View style={[styles.faqToggleIcon, { borderColor: palette.border }]}>
          <Ionicons
            name={expanded ? 'remove' : 'add'}
            size={16}
            color={palette.text}
          />
        </View>
      </View>
      {expanded ? (
        <Text style={[styles.faqAnswer, { color: palette.textSoft }]}>{answer}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

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

  const scrollViewRef = useRef<ScrollView>(null);
  const currentPlan = PLAN_DATA.find((plan) => plan.type === selectedPlan) || PLAN_DATA[2];

  useEffect(() => {
    // Scroll to the default quarterly plan (index 2) on mount
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: 2 * (CARD_WIDTH + CARD_SPACING),
        animated: false,
      });
    }, 150);
  }, []);

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
    if (index >= 0 && index < PLAN_DATA.length) {
      setSelectedPlan(PLAN_DATA[index].type);
    }
  };

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

  const handleSubscribe = async (planType: string) => {
    const targetPlan = PLAN_DATA.find((p) => p.type === planType);
    if (!targetPlan) {
      return;
    }

    if (targetPlan.type === 'free_trial') {
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
                  planType: targetPlan.type,
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
      planId: targetPlan.type,
      planName: targetPlan.name,
      amountRupees: targetPlan.price,
      color: targetPlan.accent,
      autoPay,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {!isMandatory ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconSpacer} />
        )}
        <Text style={[styles.headerTitle, { color: palette.text }]}>Subscription Plans</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Title block */}
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: palette.text }]}>Get Premium</Text>
          <Text style={[styles.heroSubtitle, { color: palette.textSoft }]}>
            Subscribe to Premium for exclusive features and priority navigation!
          </Text>
        </View>

        {/* Horizontal Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            snapToAlignment="center"
            contentContainerStyle={{
              paddingHorizontal: PEAK_WIDTH + CARD_SPACING,
              paddingVertical: 12,
            }}
            onMomentumScrollEnd={onScroll}
          >
            {PLAN_DATA.map((plan) => {
              const selected = selectedPlan === plan.type;
              return (
                <View
                  key={plan.type}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: plan.accent,
                      width: CARD_WIDTH,
                      marginRight: CARD_SPACING,
                      transform: [{ scale: selected ? 1.02 : 0.98 }],
                    },
                    selected && styles.planCardActive,
                  ]}
                >
                  {/* Top crown icon */}
                  <View style={styles.cardHeader}>
                    <View style={styles.crownOutline}>
                      <Ionicons name="sparkles" size={32} color="#0F172A" />
                    </View>
                    <Text style={styles.planBadge}>{plan.badge}</Text>
                  </View>

                  {/* Pricing */}
                  <View style={styles.priceContainer}>
                    <Text style={styles.planPrice}>₹{plan.price}</Text>
                    <Text style={styles.planDuration}>/{plan.duration}</Text>
                  </View>

                  {/* Feature check list */}
                  <View style={styles.featuresList}>
                    {plan.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <View style={styles.checkmarkCircle}>
                          <Ionicons name="checkmark" size={12} color="#0F172A" />
                        </View>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {/* White CTA Button inside card */}
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => handleSubscribe(plan.type)}
                    style={styles.planButton}
                    disabled={loading}
                  >
                    {loading && selected ? (
                      <ActivityIndicator color="#0F172A" />
                    ) : (
                      <Text style={styles.planButtonText}>
                        {plan.type === 'free_trial' ? 'Start Trial' : 'Activate plan'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Auto-renewal and commission policies */}
        <View style={styles.policiesContainer}>
          <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: palette.text }]}>
                  {selectedPlan === 'free_trial' ? 'Auto-upgrade after trial' : 'Auto-renew subscription'}
                </Text>
                <Text style={[styles.switchBody, { color: palette.textSoft }]}>
                  Keep premium access active without interruption.
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
              <View style={[styles.infoIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="sparkles" size={18} color="#059669" />
              </View>
              <Text style={[styles.infoTitle, { color: palette.text }]}>Commission policy</Text>
            </View>
            <Text style={[styles.infoBody, { color: palette.textSoft }]}>
              Earn 20% commission on your referral's first paid subscription. No earnings on trials.
            </Text>
          </View>
        </View>

        {/* FAQs */}
        <View style={styles.faqSection}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Frequently asked questions</Text>
          <FAQItem
            question="How does the referral commission work?"
            answer="Earn a 20% commission on the first paid subscription purchased by your referred friend. Commissions are verified upon successful payment."
            palette={palette}
          />
          <FAQItem
            question="When can I withdraw my earnings?"
            answer="You can request a withdrawal once your balance reaches the minimum limit of ₹100. Payouts are approved and sent to your saved UPI or bank details."
            palette={palette}
          />
          <FAQItem
            question="Are withdrawals secure?"
            answer="Yes, every payout request is secured with 6-digit OTP verification and biometric checks, and goes through a fraud-monitoring review."
            palette={palette}
          />
        </View>

        {/* Footer links */}
        <TouchableOpacity onPress={() => Linking.openURL('https://cngbharat.com/terms')}>
          <Text style={[styles.termsText, { color: palette.textSoft }]}>
            Subscription payment is processed securely. By continuing you agree to the{' '}
            <Text style={[styles.termsLink, { color: palette.tint }]}>Terms of Service</Text>.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  heroCopy: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  carouselContainer: {
    marginVertical: 16,
  },
  planCard: {
    borderRadius: 28,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  planCardActive: {
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crownOutline: {
    opacity: 0.85,
  },
  planBadge: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    color: '#0F172A',
    fontSize: 34,
    fontWeight: '900',
  },
  planDuration: {
    color: 'rgba(15, 23, 42, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  featuresList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkmarkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  planButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  planButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  policiesContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  switchBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  faqSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
  },
  faqCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  faqToggleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqAnswer: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  termsText: {
    marginTop: 20,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
  },
  termsLink: {
    fontWeight: '700',
  },
});
