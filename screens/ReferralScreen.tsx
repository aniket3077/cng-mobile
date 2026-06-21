import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { referralApi, payoutApi } from '../lib/api';
import { authenticateSensitiveAction } from '../lib/biometrics';
import { getDeviceFingerprint } from '../lib/deviceFingerprint';
import { maskPayoutDestination } from '../lib/security';
import { AppScreenProps } from '../types/navigation';

interface MonthlyPoint {
  label: string;
  amount: number;
}

interface SavedMethod {
  id: string;
  type: 'upi' | 'bank_transfer';
  label: string;
  isDefault: boolean;
  upiId?: string | null;
  accountNumberMasked?: string | null;
  accountHolderName?: string | null;
  ifsc?: string | null;
}

interface ReferralHistoryItem {
  id: string;
  referredUserName: string;
  subscriptionPlan?: string | null;
  subscriptionAmount: number;
  commissionEarned: number;
  paymentStatus: string;
  referralStatus: string;
  subscriptionDate: string;
  suspicious: boolean;
  eligibleForCommission: boolean;
  ineligibleReason?: string | null;
}

interface CommissionHistoryItem {
  id: string;
  referredUserName: string;
  subscriptionPlan?: string | null;
  sourceAmount: number;
  commissionAmount: number;
  remainingAmount: number;
  status: string;
  earnedAt: string;
  description?: string | null;
}

interface SubscriptionPlanPreview {
  id: string;
  name: string;
  price: number;
  duration: number;
  billingLabel: string;
  cashbackHighlight: string;
  commissionEligible: boolean;
}

interface ReferralDashboard {
  share: {
    referralCode: string;
    referralLink: string;
    deepLink: string;
    inviteMessage: string;
  };
  overview: {
    totalReferralCommissionEarned: number;
    activeSubscribedReferrals: number;
    pendingCommissions: number;
    withdrawableBalance: number;
    paidOutCommissions: number;
    totalReferrals: number;
    conversionRate: number;
    monthlyGraph: MonthlyPoint[];
  };
  wallet: {
    availableBalance: number;
    minimumWithdrawal: number;
    maximumWithdrawal: number;
    instantPayoutEnabled: boolean;
    otpRequired: boolean;
    payoutRail: string;
    savedMethods: SavedMethod[];
  };
  referralHistory: ReferralHistoryItem[];
  commissionHistory: CommissionHistoryItem[];
  payoutHistoryPreview: Array<{
    id: string;
    amount: number;
    netAmount: number;
    feeAmount: number;
    status: string;
    referenceId?: string | null;
    createdAt: string;
  }>;
  subscriptionPlans: SubscriptionPlanPreview[];
  fraudSignals: {
    status: string;
    score: number;
    monitor: string[];
  };
}

type HistoryFilter = 'all' | 'paid' | 'pending' | 'blocked';

const lightPalette = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  mutedCard: '#F8FAFC',
  text: '#0F172A',
  textSoft: '#475569',
  border: '#E2E8F0',
  hero: ['#064E3B', '#047857', '#10B981'] as const,
};

const darkPalette = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  mutedCard: '#F8FAFC',
  text: '#0F172A',
  textSoft: '#475569',
  border: '#E2E8F0',
  hero: ['#064E3B', '#047857', '#10B981'] as const,
};

const historyFilters: HistoryFilter[] = ['all', 'paid', 'pending', 'blocked'];

function formatCurrency(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatPlanLabel(plan?: string | null) {
  if (!plan) {
    return 'Awaiting first paid plan';
  }

  const knownPlans: Record<string, string> = {
    free_trial: '5-Day Free Trial',
    monthly: '30-Day Plan',
    quarterly: '180-Day Plan',
    annual_premium: '365-Day Plan',
  };

  return knownPlans[plan] || plan
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function getStatusMeta(status: string) {
  switch (status) {
    case 'available':
    case 'paid':
    case 'completed':
      return { bg: '#DCFCE7', text: '#166534', label: 'Verified' };
    case 'pending':
    case 'processing':
      return { bg: '#FEF3C7', text: '#92400E', label: 'Pending' };
    case 'failed':
    case 'blocked':
    case 'expired':
      return { bg: '#FEE2E2', text: '#991B1B', label: 'Blocked' };
    default:
      return { bg: '#DBEAFE', text: '#1D4ED8', label: status };
  }
}

type Props = AppScreenProps<'Referral'>;

export default function ReferralScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();
  const palette = colorScheme === 'dark' ? darkPalette : lightPalette;
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingCode, setApplyingCode] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('all');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    payoutMethod: 'upi' as 'upi' | 'bank_transfer',
    payoutMethodId: '',
    instantPayout: true,
    otpCode: '',
    upiId: '',
    accountNumber: '',
    ifsc: '',
    accountHolderName: '',
  });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const orbOne = useRef(new Animated.Value(0)).current;
  const orbTwo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReferralData();

    const animationOne = Animated.loop(
      Animated.sequence([
        Animated.timing(orbOne, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(orbOne, {
          toValue: 0,
          duration: 2800,
          useNativeDriver: true,
        }),
      ]),
    );

    const animationTwo = Animated.loop(
      Animated.sequence([
        Animated.timing(orbTwo, {
          toValue: 1,
          duration: 3600,
          useNativeDriver: true,
        }),
        Animated.timing(orbTwo, {
          toValue: 0,
          duration: 3600,
          useNativeDriver: true,
        }),
      ]),
    );

    animationOne.start();
    animationTwo.start();

    return () => {
      animationOne.stop();
      animationTwo.stop();
    };
  }, []);

  const loadReferralData = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await referralApi.getReferralInfo();
      setDashboard(response);
    } catch (_error) {
      Alert.alert('Unable to load', 'Referral commission data could not be fetched right now.');
    } finally {
      if (mode === 'refresh') {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const filteredHistory = dashboard
    ? dashboard.referralHistory.filter((item) => {
        if (selectedFilter === 'all') {
          return true;
        }
        if (selectedFilter === 'paid') {
          return item.paymentStatus === 'paid' && item.referralStatus === 'completed';
        }
        if (selectedFilter === 'pending') {
          return item.paymentStatus !== 'paid' && item.eligibleForCommission;
        }

        return !item.eligibleForCommission || item.referralStatus === 'expired';
      })
    : [];

  const maxGraphValue = Math.max(
    1,
    ...(dashboard?.overview.monthlyGraph.map((point) => point.amount) || [0]),
  );

  const handleShare = async () => {
    if (!dashboard) {
      return;
    }

    try {
      await Share.share({
        title: 'Refer subscribers and earn',
        message: `${dashboard.share.inviteMessage}\n\n${dashboard.share.referralLink}`,
      });
    } catch (_error) {
      Alert.alert('Share unavailable', 'The share sheet could not be opened.');
    }
  };

  const handleApplyCode = async () => {
    if (!referralCodeInput.trim()) {
      Alert.alert('Referral code required', 'Enter a referral code to link your first paid subscription.');
      return;
    }

    setApplyingCode(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const response = await referralApi.applyReferralCode({
        referralCode: referralCodeInput.trim().toUpperCase(),
        deviceFingerprint,
        referralSource: 'wallet_manual_entry',
      });
      Alert.alert('Referral linked', response.message || 'Your referral has been recorded.');
      setReferralCodeInput('');
      await loadReferralData('refresh');
    } catch (error: any) {
      Alert.alert('Unable to link code', error.response?.data?.error || 'Please try again.');
    } finally {
      setApplyingCode(false);
    }
  };

  const resetWithdrawForm = () => {
    setWithdrawForm({
      amount: '',
      payoutMethod: 'upi',
      payoutMethodId: '',
      instantPayout: true,
      otpCode: '',
      upiId: '',
      accountNumber: '',
      ifsc: '',
      accountHolderName: '',
    });
  };

  const handleSubmitWithdrawal = async () => {
    if (!dashboard) {
      return;
    }

    const amount = Number(withdrawForm.amount);
    if (!amount || Number.isNaN(amount)) {
      Alert.alert('Amount required', 'Enter a valid withdrawal amount.');
      return;
    }

    if (amount < dashboard.wallet.minimumWithdrawal || amount > dashboard.wallet.maximumWithdrawal) {
      Alert.alert(
        'Amount out of range',
        `Withdrawals must be between ${formatCurrency(dashboard.wallet.minimumWithdrawal)} and ${formatCurrency(dashboard.wallet.maximumWithdrawal)}.`,
      );
      return;
    }

    if (amount > dashboard.wallet.availableBalance) {
      Alert.alert('Insufficient balance', 'Your withdrawable balance is lower than this request.');
      return;
    }

    if (withdrawForm.otpCode.trim().length !== 6) {
      Alert.alert('OTP required', 'Enter the 6-digit payout verification OTP.');
      return;
    }

    if (!withdrawForm.payoutMethodId) {
      if (withdrawForm.payoutMethod === 'upi' && !withdrawForm.upiId.trim()) {
        Alert.alert('UPI required', 'Enter a valid UPI ID to continue.');
        return;
      }

      if (
        withdrawForm.payoutMethod === 'bank_transfer' &&
        (!withdrawForm.accountNumber.trim() || !withdrawForm.ifsc.trim() || !withdrawForm.accountHolderName.trim())
      ) {
        Alert.alert('Bank details required', 'Complete the account details to continue.');
        return;
      }
    }

    setSubmittingPayout(true);
    try {
      const biometricResult = await authenticateSensitiveAction('Confirm withdrawal');
      if (!biometricResult.success) {
        setSubmittingPayout(false);
        Alert.alert('Authentication Required', biometricResult.message);
        return;
      }

      const response = await payoutApi.requestPayout({
        amount,
        payoutMethod: withdrawForm.payoutMethod,
        payoutMethodId: withdrawForm.payoutMethodId || undefined,
        instantPayout: withdrawForm.instantPayout,
        otpCode: withdrawForm.otpCode,
        accountDetails: withdrawForm.payoutMethodId
          ? undefined
          : {
              accountNumber: withdrawForm.accountNumber,
              ifsc: withdrawForm.ifsc,
              accountHolderName: withdrawForm.accountHolderName,
              upiId: withdrawForm.upiId || undefined,
            },
      });

      Alert.alert(
        'Withdrawal queued',
        response.payoutRequest?.statusMessage || 'Your payout request has been submitted.',
      );
      setShowWithdrawModal(false);
      resetWithdrawForm();
      await loadReferralData('refresh');
    } catch (error: any) {
      Alert.alert('Withdrawal failed', error.response?.data?.error || 'Please try again.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const selectedMethod = dashboard?.wallet.savedMethods.find(
    (method) => method.id === withdrawForm.payoutMethodId,
  );
  const payoutFeePreview = withdrawForm.instantPayout
    ? Math.min((Number(withdrawForm.amount) || 0) * 0.015, 25)
    : 0;
  const netPreview = Math.max((Number(withdrawForm.amount) || 0) - payoutFeePreview, 0);
  const otpDestination = maskPayoutDestination(
    selectedMethod?.upiId ||
      selectedMethod?.accountNumberMasked ||
      withdrawForm.upiId ||
      withdrawForm.accountNumber,
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={[styles.loadingText, { color: palette.textSoft }]}>Preparing your commission dashboard…</Text>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <TouchableOpacity onPress={() => loadReferralData()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry loading dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <Modal
        visible={showWithdrawModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.text }]}>Secure withdrawal</Text>
                <Text style={[styles.modalSubtitle, { color: palette.textSoft }]}>
                  OTP verification and payout checks run before release.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Amount</Text>
                <TextInput
                  value={withdrawForm.amount}
                  onChangeText={(value) => setWithdrawForm((current) => ({ ...current, amount: value.replace(/[^0-9.]/g, '') }))}
                  placeholder="Enter amount"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  style={[styles.input, { color: palette.text }]}
                />
                <Text style={[styles.helperText, { color: palette.textSoft }]}>
                  Available {formatCurrency(dashboard.wallet.availableBalance)} • Fee preview {formatCurrency(payoutFeePreview)} • Net {formatCurrency(netPreview)}
                </Text>
              </View>

              {dashboard.wallet.savedMethods.length > 0 ? (
                <View style={styles.savedMethodSection}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>Saved payout methods</Text>
                  {dashboard.wallet.savedMethods.map((method) => {
                    const isSelected = withdrawForm.payoutMethodId === method.id;
                    return (
                      <TouchableOpacity
                        key={method.id}
                        onPress={() =>
                          setWithdrawForm((current) => ({
                            ...current,
                            payoutMethodId: isSelected ? '' : method.id,
                            payoutMethod: method.type,
                          }))
                        }
                        style={[
                          styles.savedMethodCard,
                          {
                            backgroundColor: isSelected ? 'rgba(16,185,129,0.14)' : '#F8FAFC',
                            borderColor: isSelected ? '#10B981' : '#E2E8F0',
                          },
                        ]}
                      >
                        <View style={styles.savedMethodCopy}>
                          <Text style={[styles.savedMethodTitle, { color: '#1E293B' }]}>{method.label}</Text>
                          <Text style={[styles.savedMethodBody, { color: '#64748B' }]}>
                            {method.type === 'upi'
                              ? method.upiId
                              : `${method.accountNumberMasked || ''} ${method.ifsc || ''}`.trim()}
                          </Text>
                        </View>
                        {method.isDefault ? <Text style={styles.defaultChip}>Default</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.togglePill,
                    withdrawForm.payoutMethod === 'upi' && styles.togglePillActive,
                  ]}
                  onPress={() => setWithdrawForm((current) => ({ ...current, payoutMethod: 'upi', payoutMethodId: '' }))}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      withdrawForm.payoutMethod === 'upi' && styles.toggleTextActive,
                    ]}
                  >
                    UPI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.togglePill,
                    withdrawForm.payoutMethod === 'bank_transfer' && styles.togglePillActive,
                  ]}
                  onPress={() =>
                    setWithdrawForm((current) => ({
                      ...current,
                      payoutMethod: 'bank_transfer',
                      payoutMethodId: '',
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.toggleText,
                      withdrawForm.payoutMethod === 'bank_transfer' && styles.toggleTextActive,
                    ]}
                  >
                    Bank
                  </Text>
                </TouchableOpacity>
              </View>

              {!selectedMethod ? (
                <View style={styles.manualMethodFields}>
                  {withdrawForm.payoutMethod === 'upi' ? (
                    <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                      <Text style={[styles.inputLabel, { color: palette.text }]}>UPI ID</Text>
                      <TextInput
                        value={withdrawForm.upiId}
                        onChangeText={(value) => setWithdrawForm((current) => ({ ...current, upiId: value }))}
                        placeholder="yourname@bank"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        style={[styles.input, { color: palette.text }]}
                      />
                    </View>
                  ) : (
                    <>
                      <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>Account holder name</Text>
                        <TextInput
                          value={withdrawForm.accountHolderName}
                          onChangeText={(value) => setWithdrawForm((current) => ({ ...current, accountHolderName: value }))}
                          placeholder="Enter account holder name"
                          placeholderTextColor="#94A3B8"
                          style={[styles.input, { color: palette.text }]}
                        />
                      </View>
                      <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>Account number</Text>
                        <TextInput
                          value={withdrawForm.accountNumber}
                          onChangeText={(value) => setWithdrawForm((current) => ({ ...current, accountNumber: value.replace(/[^0-9]/g, '') }))}
                          placeholder="Enter account number"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          style={[styles.input, { color: palette.text }]}
                        />
                      </View>
                      <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>IFSC</Text>
                        <TextInput
                          value={withdrawForm.ifsc}
                          onChangeText={(value) => setWithdrawForm((current) => ({ ...current, ifsc: value.toUpperCase() }))}
                          placeholder="Enter IFSC"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                          style={[styles.input, { color: palette.text }]}
                        />
                      </View>
                    </>
                  )}
                </View>
              ) : null}

              <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Instant payout</Text>
                    <Text style={[styles.helperText, { color: palette.textSoft }]}>
                      Uses RazorpayX placeholder rails with capped instant fee.
                    </Text>
                  </View>
                  <Switch
                    value={withdrawForm.instantPayout}
                    onValueChange={(value) => setWithdrawForm((current) => ({ ...current, instantPayout: value }))}
                    trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                    thumbColor={withdrawForm.instantPayout ? '#10B981' : '#94A3B8'}
                  />
                </View>
              </View>

              <View style={[styles.inputCard, { borderColor: palette.border, backgroundColor: palette.mutedCard }]}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>OTP verification</Text>
                <TextInput
                  value={withdrawForm.otpCode}
                  onChangeText={(value) => setWithdrawForm((current) => ({ ...current, otpCode: value.replace(/[^0-9]/g, '') }))}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={6}
                  style={[styles.input, { color: palette.text }]}
                />
                <Text style={[styles.helperText, { color: palette.textSoft }]}>
                  Verify this withdrawal for {otpDestination}.
                </Text>
              </View>

              <TouchableOpacity onPress={handleSubmitWithdrawal} disabled={submittingPayout} activeOpacity={0.92}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.primaryButton}>
                  {submittingPayout ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Confirm withdrawal</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={palette.hero} style={styles.heroSection}>
          <Animated.View
            style={[
              styles.floatingOrb,
              styles.orbLeft,
              {
                transform: [
                  {
                    translateY: orbOne.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -16],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.floatingOrb,
              styles.orbRight,
              {
                transform: [
                  {
                    translateY: orbTwo.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 18],
                    }),
                  },
                ],
              },
            ]}
          />

          <View style={styles.heroHeaderRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.heroBackButton}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => loadReferralData('refresh')}
              style={styles.heroBackButton}
            >
              {refreshing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="refresh" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.heroEyebrow}>Verified subscription commissions</Text>
          <Text style={styles.heroTitle}>Invite paid subscribers. Withdraw real commission.</Text>
          <Text style={styles.heroSubtitle}>
            Your wallet grows only when referred users complete their first paid plan and the payment is verified successfully.
          </Text>

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="flash" size={14} color="#FACC15" />
              <Text style={styles.heroBadgeText}>20% first-plan commission</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#86EFAC" />
              <Text style={styles.heroBadgeText}>
                Fraud status: {dashboard.fraudSignals.status}
              </Text>
            </View>
          </View>

          <View style={styles.walletGlassCard}>
            <Text style={styles.walletLabel}>Withdrawable balance</Text>
            <Text style={styles.walletValue}>{formatCurrency(dashboard.wallet.availableBalance)}</Text>
            <Text style={styles.walletMeta}>
              {dashboard.wallet.payoutRail} • OTP secured
            </Text>

            <View style={styles.walletActionRow}>
              <TouchableOpacity onPress={handleShare} style={styles.walletActionButton}>
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.walletActionText}>Share invite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowWithdrawModal(true)}
                style={[styles.walletActionButton, styles.walletActionPrimary]}
              >
                <Ionicons name="wallet" size={16} color="#0F172A" />
                <Text style={[styles.walletActionText, styles.walletActionPrimaryText]}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.metricsGrid}>
          {[
            {
              label: 'Total earned',
              value: formatCurrency(dashboard.overview.totalReferralCommissionEarned),
              icon: 'sparkles',
              tint: '#8B5CF6',
            },
            {
              label: 'Active paid referrals',
              value: dashboard.overview.activeSubscribedReferrals.toString(),
              icon: 'people',
              tint: '#0EA5E9',
            },
            {
              label: 'Pending review',
              value: formatCurrency(dashboard.overview.pendingCommissions),
              icon: 'time',
              tint: '#F59E0B',
            },
            {
              label: 'Conversion rate',
              value: `${dashboard.overview.conversionRate}%`,
              icon: 'bar-chart',
              tint: '#10B981',
            },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={[styles.metricIcon, { backgroundColor: `${item.tint}1F` }]}>
                <Ionicons name={item.icon as any} size={18} color={item.tint} />
              </View>
              <Text style={[styles.metricValue, { color: palette.text }]}>{item.value}</Text>
              <Text style={[styles.metricLabel, { color: palette.textSoft }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Referral code</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
                Share this before the first paid subscription is purchased.
              </Text>
            </View>
            <Text style={styles.referralCodeText}>{dashboard.share.referralCode}</Text>
          </View>

          <View style={styles.deepLinkCard}>
            <Text style={styles.deepLinkLabel}>Deep link</Text>
            <Text style={styles.deepLinkValue} numberOfLines={1}>
              {dashboard.share.deepLink}
            </Text>
          </View>

          <View style={styles.applySection}>
            <TextInput
              value={referralCodeInput}
              onChangeText={setReferralCodeInput}
              placeholder="Enter a referral code"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              style={[styles.applyInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.mutedCard }]}
            />
            <TouchableOpacity
              onPress={handleApplyCode}
              disabled={applyingCode}
              style={styles.applyButton}
            >
              {applyingCode ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.applyButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Monthly earnings graph</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
                Verified commissions across recent months.
              </Text>
            </View>
          </View>

          <View style={styles.graphRow}>
            {dashboard.overview.monthlyGraph.map((point) => (
              <View key={point.label} style={styles.graphColumn}>
                <View style={styles.graphBarShell}>
                  <LinearGradient
                    colors={['#10B981', '#34D399']}
                    style={[
                      styles.graphBar,
                      {
                        height: `${Math.max((point.amount / maxGraphValue) * 100, point.amount ? 18 : 6)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.graphValue, { color: palette.text }]}>{point.amount ? `₹${Math.round(point.amount)}` : '0'}</Text>
                <Text style={[styles.graphLabel, { color: palette.textSoft }]}>{point.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Referral history</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
                Every commission is tied to a verified first paid subscription.
              </Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            {historyFilters.map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[
                  styles.filterPill,
                  selectedFilter === filter && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedFilter === filter && styles.filterTextActive,
                  ]}
                >
                  {filter.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => {
              const badge = getStatusMeta(
                item.eligibleForCommission
                  ? item.paymentStatus === 'paid'
                    ? 'completed'
                    : item.paymentStatus
                  : 'blocked',
              );

              return (
                <View
                  key={item.id}
                  style={[styles.historyRow, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}
                >
                  <View style={styles.historyTopRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {item.referredUserName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.historyCopy}>
                      <Text style={[styles.historyName, { color: palette.text }]}>{item.referredUserName}</Text>
                      <Text style={[styles.historyMeta, { color: palette.textSoft }]}>
                        {formatPlanLabel(item.subscriptionPlan)} • {formatCurrency(item.subscriptionAmount)}
                      </Text>
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <View style={styles.historyBottomRow}>
                    <Text style={[styles.historyCommission, { color: palette.text }]}>
                      {formatCurrency(item.commissionEarned)}
                    </Text>
                    <Text style={[styles.historyMeta, { color: palette.textSoft }]}>
                      {new Date(item.subscriptionDate).toLocaleDateString('en-IN')}
                    </Text>
                  </View>

                  {!item.eligibleForCommission && item.ineligibleReason ? (
                    <Text style={styles.blockedNote}>
                      Blocked: {item.ineligibleReason.replace(/_/g, ' ')}
                    </Text>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: palette.textSoft }]}>
              No referrals match this filter yet.
            </Text>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Commission ledger</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
                Wallet-ready earnings from verified subscription payments.
              </Text>
            </View>
          </View>

          {dashboard.commissionHistory.slice(0, 5).map((item) => {
            const badge = getStatusMeta(item.status);
            return (
              <View key={item.id} style={[styles.ledgerRow, { borderColor: palette.border }]}>
                <View>
                  <Text style={[styles.ledgerTitle, { color: palette.text }]}>{item.referredUserName}</Text>
                  <Text style={[styles.ledgerBody, { color: palette.textSoft }]}>
                    {formatPlanLabel(item.subscriptionPlan)} • Source {formatCurrency(item.sourceAmount)}
                  </Text>
                </View>
                <View style={styles.ledgerRight}>
                  <Text style={[styles.ledgerAmount, { color: palette.text }]}>
                    {formatCurrency(item.commissionAmount)}
                  </Text>
                  <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Payout preview</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
                Recent withdrawal requests and their release status.
              </Text>
            </View>
          </View>

          {dashboard.payoutHistoryPreview.length > 0 ? (
            dashboard.payoutHistoryPreview.map((item) => {
              const badge = getStatusMeta(item.status);
              return (
                <View key={item.id} style={[styles.ledgerRow, { borderColor: palette.border }]}>
                  <View>
                    <Text style={[styles.ledgerTitle, { color: palette.text }]}>
                      {formatCurrency(item.netAmount)}
                    </Text>
                    <Text style={[styles.ledgerBody, { color: palette.textSoft }]}>
                      Fee {formatCurrency(item.feeAmount)} • Ref {item.referenceId || item.id.slice(-6)}
                    </Text>
                  </View>
                  <View style={styles.ledgerRight}>
                    <Text style={[styles.ledgerBody, { color: palette.textSoft }]}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                    <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: palette.textSoft }]}>
              No withdrawals yet. Your first payout will appear here.
            </Text>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Subscription plan conversion tracks</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
                Choose the plan experiences that drive the strongest verified commissions.
              </Text>
            </View>
          </View>

          {dashboard.subscriptionPlans
            .filter((plan) => plan.commissionEligible)
            .map((plan) => (
              <TouchableOpacity
                key={plan.id}
                onPress={() => navigation.navigate('Subscription')}
                style={[styles.planPreviewCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}
              >
                <View>
                  <Text style={[styles.planPreviewName, { color: palette.text }]}>{plan.name}</Text>
                  <Text style={[styles.planPreviewBody, { color: palette.textSoft }]}>
                    {formatCurrency(plan.price)} • {plan.billingLabel}
                  </Text>
                </View>
                <Text style={styles.planPreviewHighlight}>{plan.cashbackHighlight}</Text>
              </TouchableOpacity>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  heroSection: {
    margin: 16,
    borderRadius: 30,
    padding: 22,
    overflow: 'hidden',
  },
  floatingOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orbLeft: {
    top: -10,
    right: -16,
  },
  orbRight: {
    bottom: 110,
    left: -28,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16,185,129,0.22)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heroBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: 10,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  walletGlassCard: {
    marginTop: 22,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 18,
  },
  walletLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  walletValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 10,
  },
  walletMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 6,
  },
  walletActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  walletActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  walletActionPrimary: {
    backgroundColor: '#84CC16',
    borderColor: '#84CC16',
  },
  walletActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  walletActionPrimaryText: {
    color: '#0F172A',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  metricCard: {
    width: '48%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 6,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    marginTop: 6,
    fontSize: 13,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  referralCodeText: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  deepLinkCard: {
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    padding: 14,
  },
  deepLinkLabel: {
    color: '#64748B',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  deepLinkValue: {
    color: '#0F172A',
    marginTop: 6,
    fontSize: 13,
  },
  applySection: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  applyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  applyButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  graphRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  graphColumn: {
    flex: 1,
    alignItems: 'center',
  },
  graphBarShell: {
    height: 150,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.12)',
    padding: 8,
  },
  graphBar: {
    width: '100%',
    borderRadius: 12,
  },
  graphValue: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  graphLabel: {
    marginTop: 4,
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#10B981',
  },
  filterText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#fff',
  },
  historyRow: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#064E3B',
    fontWeight: '800',
  },
  historyCopy: {
    flex: 1,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    alignItems: 'center',
  },
  historyCommission: {
    fontSize: 18,
    fontWeight: '800',
  },
  blockedNote: {
    marginTop: 10,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  ledgerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ledgerBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  ledgerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  planPreviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  planPreviewName: {
    fontSize: 15,
    fontWeight: '700',
  },
  planPreviewBody: {
    marginTop: 4,
    fontSize: 12,
  },
  planPreviewHighlight: {
    marginTop: 10,
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.48)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 260,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  inputCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    fontSize: 15,
    marginTop: 10,
    paddingVertical: 0,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  savedMethodSection: {
    marginBottom: 12,
  },
  savedMethodCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedMethodCopy: {
    flex: 1,
  },
  savedMethodTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  savedMethodBody: {
    marginTop: 4,
    fontSize: 12,
  },
  defaultChip: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  togglePill: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: '#10B981',
  },
  toggleText: {
    color: '#334155',
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#fff',
  },
  manualMethodFields: {
    marginBottom: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  switchCopy: {
    flex: 1,
  },
  primaryButton: {
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
