import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
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
import { payoutApi } from '../lib/api';
import { authenticateSensitiveAction } from '../lib/biometrics';
import { maskPayoutDestination } from '../lib/security';
import { AppScreenProps } from '../types/navigation';

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

interface PayoutDashboard {
  wallet: {
    availableBalance: number;
    totalCommissionEarned: number;
    pendingCommissions: number;
    pendingWithdrawals?: number;
    totalWithdrawn: number;
    minimumWithdrawal: number;
    maximumWithdrawal: number;
    instantPayoutFee: string;
    razorpayXIntegration: string;
  };
  savedPayoutMethods: SavedMethod[];
  payoutHistory: Array<{
    id: string;
    amount: number;
    feeAmount: number;
    netAmount: number;
    destination: string;
    payoutMethod: string;
    status: string;
    statusMessage?: string | null;
    riskStatus: string;
    instantPayout: boolean;
    createdAt: string;
    referenceId?: string | null;
    receiptLabel: string;
    payoutDeadline?: string;
    adminRemarks?: string | null;
  }>;
  commissionLedger: Array<{
    id: string;
    referredUserName: string;
    planName?: string | null;
    amount: number;
    remainingAmount: number;
    status: string;
    earnedAt: string;
  }>;
  security: {
    otpRequired: boolean;
    suspiciousPayoutsRequireAdminReview: boolean;
    fraudStatus: string;
    fraudScore: number;
  };
}

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

function formatCurrency(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function getStatusMeta(status: string) {
  switch (status) {
    case 'completed':
      return { bg: '#DCFCE7', text: '#166534', label: 'Completed' };
    case 'processing':
      return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Processing' };
    case 'pending':
      return { bg: '#FEF3C7', text: '#92400E', label: 'Pending' };
    case 'failed':
      return { bg: '#FEE2E2', text: '#991B1B', label: 'Failed' };
    default:
      return { bg: '#E2E8F0', text: '#334155', label: status };
  }
}

type Props = AppScreenProps<'Payout'>;

export default function PayoutScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();
  const palette = colorScheme === 'dark' ? darkPalette : lightPalette;
  const [dashboard, setDashboard] = useState<PayoutDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
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

  useEffect(() => {
    loadPayoutData();
  }, []);

  const loadPayoutData = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await payoutApi.getPayoutInfo();
      setDashboard(response);
    } catch (_error) {
      Alert.alert('Unable to load', 'Payout information is unavailable right now.');
    } finally {
      if (mode === 'refresh') {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setForm({
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

  const selectedMethod = dashboard?.savedPayoutMethods.find((method) => method.id === form.payoutMethodId);
  const feePreview = form.instantPayout ? Math.min((Number(form.amount) || 0) * 0.015, 25) : 0;
  const netPreview = Math.max((Number(form.amount) || 0) - feePreview, 0);
  const otpDestination = maskPayoutDestination(
    selectedMethod?.upiId ||
      selectedMethod?.accountNumberMasked ||
      form.upiId ||
      form.accountNumber,
  );

  const handleSubmit = async () => {
    if (!dashboard) {
      return;
    }

    const amount = Number(form.amount);
    if (!amount || Number.isNaN(amount)) {
      Alert.alert('Amount required', 'Enter a valid payout amount.');
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
    if (form.otpCode.trim().length !== 6) {
      Alert.alert('OTP required', 'Enter the 6-digit verification code.');
      return;
    }

    if (!form.payoutMethodId) {
      if (form.payoutMethod === 'upi' && !form.upiId.trim()) {
        Alert.alert('UPI required', 'Enter your UPI ID.');
        return;
      }
      if (
        form.payoutMethod === 'bank_transfer' &&
        (!form.accountNumber.trim() || !form.ifsc.trim() || !form.accountHolderName.trim())
      ) {
        Alert.alert('Bank details required', 'Complete the bank account details.');
        return;
      }
    }

    const biometricResult = await authenticateSensitiveAction('Confirm withdrawal');
    if (!biometricResult.success) {
      Alert.alert('Authentication Required', biometricResult.message);
      return;
    }

    setSubmitting(true);
    try {
      const response = await payoutApi.requestPayout({
        amount,
        payoutMethod: form.payoutMethod,
        payoutMethodId: form.payoutMethodId || undefined,
        instantPayout: form.instantPayout,
        otpCode: form.otpCode,
        accountDetails: form.payoutMethodId
          ? undefined
          : {
              accountNumber: form.accountNumber,
              ifsc: form.ifsc,
              accountHolderName: form.accountHolderName,
              upiId: form.upiId || undefined,
            },
      });

      Alert.alert('Payout queued', response.payoutRequest?.statusMessage || 'Your payout request is being processed.');
      setShowRequestModal(false);
      resetForm();
      await loadPayoutData('refresh');
    } catch (error: any) {
      Alert.alert('Payout failed', error.response?.data?.error || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={[styles.loadingText, { color: palette.textSoft }]}>Preparing payout center…</Text>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <TouchableOpacity onPress={() => loadPayoutData()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry loading payouts</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <Modal visible={showRequestModal} transparent animationType="slide" onRequestClose={() => setShowRequestModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Withdraw commission</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowRequestModal(false)}>
                <Ionicons name="close" size={18} color={palette.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>Amount</Text>
                <TextInput
                  value={form.amount}
                  onChangeText={(value) => setForm((current) => ({ ...current, amount: value.replace(/[^0-9.]/g, '') }))}
                  placeholder="Enter amount"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  style={[styles.input, { color: palette.text }]}
                />
                <Text style={[styles.helperText, { color: palette.textSoft }]}>
                  Fee {formatCurrency(feePreview)} • Net {formatCurrency(netPreview)}
                </Text>
              </View>

              {dashboard.savedPayoutMethods.length > 0 ? (
                <View style={styles.savedMethodsSection}>
                  {dashboard.savedPayoutMethods.map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      onPress={() => setForm((current) => ({
                        ...current,
                        payoutMethodId: current.payoutMethodId === method.id ? '' : method.id,
                        payoutMethod: method.type,
                      }))}
                      style={[
                        styles.savedMethodCard,
                        {
                          backgroundColor: form.payoutMethodId === method.id ? 'rgba(16,185,129,0.14)' : palette.mutedCard,
                          borderColor: form.payoutMethodId === method.id ? '#10B981' : palette.border,
                        },
                      ]}
                    >
                      <View style={styles.savedMethodCopy}>
                        <Text style={[styles.savedMethodTitle, { color: palette.text }]}>{method.label}</Text>
                        <Text style={[styles.savedMethodBody, { color: palette.textSoft }]}>
                          {method.type === 'upi'
                            ? method.upiId
                            : `${method.accountNumberMasked || ''} ${method.ifsc || ''}`.trim()}
                        </Text>
                      </View>
                      {method.isDefault ? <Text style={styles.defaultChip}>Default</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.togglePill, form.payoutMethod === 'upi' && styles.togglePillActive]}
                  onPress={() => setForm((current) => ({ ...current, payoutMethod: 'upi', payoutMethodId: '' }))}
                >
                  <Text style={[styles.toggleText, form.payoutMethod === 'upi' && styles.toggleTextActive]}>UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.togglePill, form.payoutMethod === 'bank_transfer' && styles.togglePillActive]}
                  onPress={() => setForm((current) => ({ ...current, payoutMethod: 'bank_transfer', payoutMethodId: '' }))}
                >
                  <Text style={[styles.toggleText, form.payoutMethod === 'bank_transfer' && styles.toggleTextActive]}>Bank</Text>
                </TouchableOpacity>
              </View>

              {!selectedMethod ? (
                <>
                  {form.payoutMethod === 'upi' ? (
                    <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                      <Text style={[styles.inputLabel, { color: palette.text }]}>UPI ID</Text>
                      <TextInput
                        value={form.upiId}
                        onChangeText={(value) => setForm((current) => ({ ...current, upiId: value }))}
                        placeholder="yourname@bank"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        style={[styles.input, { color: palette.text }]}
                      />
                    </View>
                  ) : (
                    <>
                      <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>Account holder</Text>
                        <TextInput
                          value={form.accountHolderName}
                          onChangeText={(value) => setForm((current) => ({ ...current, accountHolderName: value }))}
                          placeholder="Enter account holder name"
                          placeholderTextColor="#94A3B8"
                          style={[styles.input, { color: palette.text }]}
                        />
                      </View>
                      <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>Account number</Text>
                        <TextInput
                          value={form.accountNumber}
                          onChangeText={(value) => setForm((current) => ({ ...current, accountNumber: value.replace(/[^0-9]/g, '') }))}
                          placeholder="Enter account number"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          style={[styles.input, { color: palette.text }]}
                        />
                      </View>
                      <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                        <Text style={[styles.inputLabel, { color: palette.text }]}>IFSC</Text>
                        <TextInput
                          value={form.ifsc}
                          onChangeText={(value) => setForm((current) => ({ ...current, ifsc: value.toUpperCase() }))}
                          placeholder="Enter IFSC"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                          style={[styles.input, { color: palette.text }]}
                        />
                      </View>
                    </>
                  )}
                </>
              ) : null}

              <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={[styles.inputLabel, { color: palette.text }]}>Instant payout</Text>
                    <Text style={[styles.helperText, { color: palette.textSoft }]}>
                      {dashboard.wallet.instantPayoutFee}
                    </Text>
                  </View>
                  <Switch
                    value={form.instantPayout}
                    onValueChange={(value) => setForm((current) => ({ ...current, instantPayout: value }))}
                    trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                    thumbColor={form.instantPayout ? '#10B981' : '#94A3B8'}
                  />
                </View>
              </View>

              <View style={[styles.inputCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                <Text style={[styles.inputLabel, { color: palette.text }]}>OTP verification</Text>
                <TextInput
                  value={form.otpCode}
                  onChangeText={(value) => setForm((current) => ({ ...current, otpCode: value.replace(/[^0-9]/g, '') }))}
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

              <View style={[styles.noticeBanner, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.15)' }]}>
                <Ionicons name="time" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={{ color: palette.textSoft, fontSize: 12, flex: 1, fontWeight: '500' }}>
                  Withdrawals are manually reviewed and processed within 24 hours.
                </Text>
              </View>
              
              <View style={[styles.noticeBanner, { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.15)', marginBottom: 16 }]}>
                <Ionicons name="calendar" size={16} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={{ color: palette.textSoft, fontSize: 12, flex: 1, fontWeight: '500' }}>
                  Estimated payout time: {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </Text>
              </View>

              <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.primaryButton}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Submit withdrawal</Text>
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
        <LinearGradient colors={palette.hero} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroButton}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => loadPayoutData('refresh')} style={styles.heroButton}>
              {refreshing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="refresh" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.heroEyebrow}>RazorpayX payout center</Text>
          <Text style={styles.heroTitle}>Withdraw verified subscription commissions securely.</Text>
          <Text style={styles.heroSubtitle}>
            OTP-secured withdrawals, saved payout methods, and admin review for suspicious requests.
          </Text>

          <View style={styles.heroBalanceCard}>
            <Text style={styles.heroBalanceLabel}>Available now</Text>
            <Text style={styles.heroBalanceValue}>{formatCurrency(dashboard.wallet.availableBalance)}</Text>
            <Text style={styles.heroBalanceMeta}>
              Min {formatCurrency(dashboard.wallet.minimumWithdrawal)} • {dashboard.wallet.instantPayoutFee}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setShowRequestModal(true)}>
            <LinearGradient colors={['#A3E635', '#84CC16']} style={styles.withdrawButton}>
              <Ionicons name="wallet" size={16} color="#0F172A" />
              <Text style={styles.withdrawButtonText}>Request withdrawal</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        <View style={[styles.mainNoticeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
            <Ionicons name="time" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>24-Hour Processing Notice</Text>
            <Text style={{ color: palette.textSoft, fontSize: 11, marginTop: 2 }}>
              Withdrawals are manually reviewed and processed within 24 hours.
            </Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          {[
            { label: 'Total earned', value: formatCurrency(dashboard.wallet.totalCommissionEarned), tint: '#8B5CF6', icon: 'sparkles' },
            { label: 'Pending review', value: formatCurrency(dashboard.wallet.pendingCommissions), tint: '#F59E0B', icon: 'time' },
            { label: 'Total withdrawn', value: formatCurrency(dashboard.wallet.totalWithdrawn), tint: '#10B981', icon: 'cash' },
            { label: 'Fraud score', value: dashboard.security.fraudScore.toString(), tint: '#EF4444', icon: 'shield-checkmark' },
          ].map((item) => (
            <View key={item.label} style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.metricIcon, { backgroundColor: `${item.tint}1F` }]}>
                <Ionicons name={item.icon as any} size={18} color={item.tint} />
              </View>
              <Text style={[styles.metricValue, { color: palette.text }]}>{item.value}</Text>
              <Text style={[styles.metricLabel, { color: palette.textSoft }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Saved payout methods</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
            Reuse verified payout destinations for faster withdrawals.
          </Text>
          {dashboard.savedPayoutMethods.length > 0 ? (
            dashboard.savedPayoutMethods.map((method) => (
              <View key={method.id} style={[styles.methodCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                <View>
                  <Text style={[styles.methodTitle, { color: palette.text }]}>{method.label}</Text>
                  <Text style={[styles.methodBody, { color: palette.textSoft }]}>
                    {method.type === 'upi'
                      ? method.upiId
                      : `${method.accountNumberMasked || ''} ${method.ifsc || ''}`.trim()}
                  </Text>
                </View>
                {method.isDefault ? <Text style={styles.defaultChip}>Default</Text> : null}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: palette.textSoft }]}>
              Your first withdrawal method will be saved automatically after submission.
            </Text>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Withdrawal history</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
            Track every payout request from queue to completion.
          </Text>
          {dashboard.payoutHistory.length > 0 ? (
            dashboard.payoutHistory.map((item) => {
              const badge = getStatusMeta(item.status);
              return (
                <View key={item.id} style={[styles.historyCard, { backgroundColor: palette.mutedCard, borderColor: palette.border }]}>
                  <View style={styles.historyTopRow}>
                    <View>
                      <Text style={[styles.historyAmount, { color: palette.text }]}>{formatCurrency(item.netAmount)}</Text>
                      <Text style={[styles.historyBody, { color: palette.textSoft }]}>
                        {item.destination} • Fee {formatCurrency(item.feeAmount)}
                      </Text>
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.historyBody, { color: palette.textSoft }]}>
                    {item.referenceId || item.id.slice(-6)} • {new Date(item.createdAt).toLocaleString('en-IN')}
                  </Text>
                  {item.statusMessage ? (
                    <Text style={[styles.historyBody, { color: palette.textSoft }]}>
                      {item.statusMessage}
                    </Text>
                  ) : null}
                  {item.payoutDeadline && (item.status === 'pending' || item.status === 'processing') ? (
                    <Text style={[styles.historyBody, { color: '#F59E0B', fontWeight: '600' }]}>
                      Est. Payout: {new Date(item.payoutDeadline).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  ) : null}
                  {item.adminRemarks ? (
                    <Text style={[styles.historyBody, { color: '#EF4444', fontWeight: '600' }]}>
                      Remarks: {item.adminRemarks}
                    </Text>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: palette.textSoft }]}>
              No payout requests yet.
            </Text>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Commission ledger</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.textSoft }]}>
            Remaining withdrawable amount across your verified commission entries.
          </Text>
          {dashboard.commissionLedger.slice(0, 6).map((entry) => (
            <View key={entry.id} style={[styles.ledgerRow, { borderColor: palette.border }]}>
              <View>
                <Text style={[styles.ledgerTitle, { color: palette.text }]}>{entry.referredUserName}</Text>
                <Text style={[styles.ledgerBody, { color: palette.textSoft }]}>
                  {entry.planName || 'Paid subscription'} • Remaining {formatCurrency(entry.remainingAmount)}
                </Text>
              </View>
              <Text style={[styles.ledgerAmount, { color: palette.text }]}>{formatCurrency(entry.amount)}</Text>
            </View>
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
    marginTop: 14,
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
  heroCard: {
    margin: 16,
    borderRadius: 28,
    padding: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroButton: {
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
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  heroBalanceCard: {
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 18,
  },
  heroBalanceLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroBalanceValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
  heroBalanceMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 6,
  },
  withdrawButton: {
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  withdrawButtonText: {
    color: '#0F172A',
    fontWeight: '800',
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
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
  methodCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  methodBody: {
    marginTop: 4,
    fontSize: 12,
  },
  defaultChip: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  historyBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
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
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  ledgerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ledgerBody: {
    marginTop: 4,
    fontSize: 12,
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    marginTop: 12,
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.48)',
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
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
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
    marginTop: 10,
    fontSize: 15,
    paddingVertical: 0,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  savedMethodsSection: {
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
  mainNoticeCard: {
    borderWidth: 1,
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
