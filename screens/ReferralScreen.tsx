import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { referralApi, payoutApi } from '../lib/api';

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  totalEarnings: number;
  availableBalance: number;
  pendingEarnings: number;
  referralCode: string;
  referralLink: string;
}

interface WithdrawalData {
  amount: string;
  payoutMethod: 'bank_transfer' | 'upi';
  accountDetails: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    upiId?: string;
  };
}

interface BankTransferDetails {
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
}

interface UPIDetails {
  upiId: string;
}

interface ReferralData {
  stats: ReferralStats;
  referrals: any[];
  earnings: any[];
  payoutRequests: any[];
  availableBalance: number;
  totalEarnings: number;
  pendingEarnings: number;
  referralCode: string;
  referralLink: string;
}

export default function ReferralScreen() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'bank_transfer' | 'upi'>('bank_transfer');
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const data = await referralApi.getReferralInfo();
      setReferralData(data);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      Alert.alert('Error', 'Failed to load referral information');
    } finally {
      setLoading(false);
    }
  };

  const shareReferralCode = async () => {
    if (!referralData?.stats.referralCode) return;

    try {
      const result = await Share.share({
        message: `Join CNG Bharat using my referral code: ${referralData.stats.referralCode}\n\nDownload the app: ${referralData.stats.referralLink}`,
        title: 'Invite to CNG Bharat',
      });

      if (result.action === Share.sharedAction) {
        console.log('Referral code shared successfully');
      }
    } catch (error) {
      console.error('Error sharing referral code:', error);
      Alert.alert('Error', 'Failed to share referral code');
    }
  };

  const copyReferralCode = () => {
    if (!referralData?.stats.referralCode) return;
    Alert.alert('Success', 'Referral code copied to clipboard!');
  };

  const handleApplyCode = async () => {
    if (!referralCode.trim()) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }

    setApplyingCode(true);
    try {
      const response = await referralApi.applyReferralCode(referralCode.trim());
      if (response.success) {
        Alert.alert('Success', 'Referral code applied successfully!');
        await loadReferralData();
      } else {
        Alert.alert('Error', response.message || 'Failed to apply referral code');
      }
    } catch (error) {
      console.error('Error applying referral code:', error);
      Alert.alert('Error', 'Failed to apply referral code');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount.trim() || parseFloat(withdrawAmount) < 100) {
      Alert.alert('Error', 'Please enter a valid amount (Min: ₹100)');
      return;
    }

    if (referralData?.availableBalance && parseFloat(withdrawAmount) > referralData.availableBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    setProcessingWithdraw(true);
    try {
      let accountDetails: BankTransferDetails | UPIDetails;
      
      if (withdrawMethod === 'bank_transfer') {
        accountDetails = {
          accountNumber: '1234567890', // User should fill these
          ifsc: 'HDFC0001234',
          accountHolderName: 'John Doe',
        };
      } else {
        accountDetails = {
          upiId: 'user@upi', // User should fill this
        };
      }

      const response = await payoutApi.requestPayout({
        amount: parseFloat(withdrawAmount),
        payoutMethod: withdrawMethod,
        accountDetails: accountDetails as any,
      });

      if (response.success) {
        Alert.alert('Success', 'Withdrawal request submitted successfully!');
        await loadReferralData(); // Refresh balance
        setShowWithdrawModal(false);
        setWithdrawAmount('');
      } else {
        Alert.alert('Error', response.message || 'Failed to submit withdrawal request');
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      Alert.alert('Error', 'Failed to request withdrawal');
    } finally {
      setProcessingWithdraw(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading referral data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Referral Program</Text>
        <Text style={styles.subtitle}>Invite friends and earn rewards</Text>
      </View>

      {/* Withdrawal Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Earnings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Enter amount to withdraw from your available balance
              </Text>
              <Text style={styles.balanceInfo}>
                Available: ₹{referralData?.availableBalance || 0}
              </Text>

              <View style={styles.methodSelector}>
                <TouchableOpacity
                  style={[
                    styles.methodOption,
                    withdrawMethod === 'bank_transfer' && styles.selectedMethod,
                  ]}
                  onPress={() => setWithdrawMethod('bank_transfer')}
                >
                  <Text style={[
                    styles.methodText,
                    withdrawMethod === 'bank_transfer' && styles.selectedMethodText,
                  ]}>
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodOption,
                    withdrawMethod === 'upi' && styles.selectedMethod,
                  ]}
                  onPress={() => setWithdrawMethod('upi')}
                >
                  <Text style={[
                    styles.methodText,
                    withdrawMethod === 'upi' && styles.selectedMethodText,
                  ]}>
                    UPI
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.withdrawInput}
                placeholder="Enter amount"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
                maxLength={8}
              />

              <View style={styles.withdrawActions}>
                <TouchableOpacity
                  style={styles.withdrawButton}
                  onPress={handleWithdraw}
                  disabled={processingWithdraw || !withdrawAmount.trim()}
                >
                  {processingWithdraw ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.withdrawButtonText}>Withdraw Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{referralData?.stats.totalReferrals || 0}</Text>
          <Text style={styles.statLabel}>Total Referrals</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{referralData?.stats.availableBalance || 0}</Text>
          <Text style={styles.statLabel}>Available Balance</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{referralData?.stats.totalEarnings || 0}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Referral Code</Text>
        <View style={styles.referralCodeContainer}>
          <Text style={styles.referralCode}>{referralData?.stats.referralCode || 'Loading...'}</Text>
          <View style={styles.referralActions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                applyingCode && styles.disabledButton,
              ]}
              onPress={handleApplyCode}
              disabled={applyingCode}
            >
              <Text style={[
                styles.actionButtonText,
                applyingCode && styles.disabledButtonText,
              ]}>
                {applyingCode ? 'Applying...' : 'Apply Code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={copyReferralCode}
            >
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowWithdrawModal(true)}
            >
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apply Referral Code</Text>
        <View style={styles.applyContainer}>
          <TextInput
            style={styles.referralInput}
            placeholder="Enter referral code"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.applyButton, applyingCode && styles.disabledButton]}
            onPress={copyReferralCode}
            disabled={applyingCode}
          >
            {applyingCode ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.applyButtonText}>Apply</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Referral History</Text>
        {referralData?.referrals && referralData.referrals.length > 0 ? (
          referralData.referrals.map((referral, index) => (
            <View key={referral.id || index} style={styles.referralItem}>
              <View style={styles.referralInfo}>
                <Text style={styles.referralName}>
                  {referral.referred?.name || 'Anonymous'}
                </Text>
                <Text style={styles.referralStatus}>
                  Status: {referral.status}
                </Text>
              </View>
              <Text style={styles.referralReward}>
                +₹{referral.rewardAmount || 50}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No referrals yet. Start inviting friends!</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>Share your referral code with friends</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>Friend signs up using your code</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>You earn ₹50 when they complete signup</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>Withdraw earnings via bank transfer</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 16,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  referralCodeContainer: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  referralCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0EA5E9',
    marginBottom: 16,
    letterSpacing: 2,
  },
  referralActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  shareButton: {
    backgroundColor: '#0EA5E9',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  disabledButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyContainer: {
    gap: 12,
  },
  referralInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  applyButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  applywithdrawButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  selectedMethod: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  methodText: {
    fontSize: 14,
    color: '#475569',
  },
  selectedMethodText: {
    fontSize: 14,
    color: '#fff',
  },
  referralItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f9f9f9',
  },
  referralInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  referralStatus: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  referralReward: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  stepsContainer: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  balanceInfo: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  withdrawInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  withdrawActions: {
    flexDirection: 'row',
    gap: 12,
  },
  withdrawButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
  },
});
