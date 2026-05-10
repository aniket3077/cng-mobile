import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { payoutApi } from '../lib/api';

interface PayoutData {
  availableBalance: number;
  totalEarnings: number;
  pendingEarnings: number;
  earnings: any[];
  payoutRequests: any[];
}

export default function PayoutScreen() {
  const [payoutData, setPayoutData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    payoutMethod: 'bank_transfer' as 'bank_transfer' | 'upi',
    accountNumber: '',
    ifsc: '',
    accountHolderName: '',
    upiId: '',
  });

  useEffect(() => {
    loadPayoutData();
  }, []);

  const loadPayoutData = async () => {
    try {
      const data = await payoutApi.getPayoutInfo();
      setPayoutData(data);
    } catch (error) {
      console.error('Failed to load payout data:', error);
      Alert.alert('Error', 'Failed to load payout information');
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!formData.amount || parseFloat(formData.amount) < 100) {
      Alert.alert('Error', 'Minimum payout amount is ₹100');
      return;
    }

    if (parseFloat(formData.amount) > (payoutData?.availableBalance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (formData.payoutMethod === 'bank_transfer') {
      if (!formData.accountNumber || !formData.ifsc || !formData.accountHolderName) {
        Alert.alert('Error', 'Please fill all bank details');
        return;
      }
    } else {
      if (!formData.upiId) {
        Alert.alert('Error', 'Please enter UPI ID');
        return;
      }
    }

    setProcessingPayout(true);
    try {
      const accountDetails = formData.payoutMethod === 'bank_transfer' 
        ? {
            accountNumber: formData.accountNumber,
            ifsc: formData.ifsc,
            accountHolderName: formData.accountHolderName,
          }
        : {
            accountNumber: '',
            ifsc: '',
            accountHolderName: '',
            upiId: formData.upiId,
          };

      const result = await payoutApi.requestPayout({
        amount: parseFloat(formData.amount),
        payoutMethod: formData.payoutMethod,
        accountDetails,
      });

      Alert.alert('Success', result.message || 'Payout request submitted successfully!');
      setShowPayoutModal(false);
      resetForm();
      loadPayoutData();
    } catch (error: any) {
      console.error('Error requesting payout:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to request payout');
    } finally {
      setProcessingPayout(false);
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      payoutMethod: 'bank_transfer',
      accountNumber: '',
      ifsc: '',
      accountHolderName: '',
      upiId: '',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading payout data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Payouts</Text>
        <Text style={styles.subtitle}>Withdraw your referral earnings</Text>
      </View>

      <View style={styles.balanceContainer}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₹{payoutData?.availableBalance || 0}</Text>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Earnings</Text>
          <Text style={styles.balanceAmount}>₹{payoutData?.totalEarnings || 0}</Text>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Pending Earnings</Text>
          <Text style={styles.balanceAmount}>₹{payoutData?.pendingEarnings || 0}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.payoutButton}
        onPress={() => setShowPayoutModal(true)}
        disabled={(payoutData?.availableBalance || 0) < 100}
      >
        <Text style={styles.payoutButtonText}>Request Payout</Text>
        <Text style={styles.payoutButtonSubtext}>
          Min. ₹100 • Available: ₹{payoutData?.availableBalance || 0}
        </Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payout History</Text>
        {payoutData?.payoutRequests && payoutData.payoutRequests.length > 0 ? (
          payoutData.payoutRequests.map((request, index) => (
            <View key={request.id || index} style={styles.payoutItem}>
              <View style={styles.payoutInfo}>
                <Text style={styles.payoutAmount}>₹{request.amount}</Text>
                <Text style={styles.payoutMethod}>{request.payoutMethod}</Text>
                <Text style={styles.payoutDate}>
                  {new Date(request.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.statusBadge, getStatusStyle(request.status)]}>
                <Text style={styles.statusText}>{request.status}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No payout requests yet</Text>
        )}
      </View>

      <Modal
        visible={showPayoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Request Payout</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter amount"
                value={formData.amount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text.replace(/[^0-9.]/g, '') }))}
                keyboardType="numeric"
              />
              <Text style={styles.formHint}>
                Available: ₹{payoutData?.availableBalance || 0} • Min: ₹100 • Max: ₹50000
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Payout Method</Text>
              <View style={styles.methodContainer}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    formData.payoutMethod === 'bank_transfer' && styles.selectedMethod,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, payoutMethod: 'bank_transfer' }))}
                >
                  <Text style={[
                    styles.methodText,
                    formData.payoutMethod === 'bank_transfer' && styles.selectedMethodText,
                  ]}>
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    formData.payoutMethod === 'upi' && styles.selectedMethod,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, payoutMethod: 'upi' }))}
                >
                  <Text style={[
                    styles.methodText,
                    formData.payoutMethod === 'upi' && styles.selectedMethodText,
                  ]}>
                    UPI
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {formData.payoutMethod === 'bank_transfer' ? (
              <>
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Account Holder Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter account holder name"
                    value={formData.accountHolderName}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, accountHolderName: text }))}
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Account Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter account number"
                    value={formData.accountNumber}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, accountNumber: text.replace(/[^0-9]/g, '') }))}
                    keyboardType="numeric"
                    maxLength={18}
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter IFSC code"
                    value={formData.ifsc}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, ifsc: text.toUpperCase() }))}
                    autoCapitalize="characters"
                    maxLength={11}
                  />
                </View>
              </>
            ) : (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>UPI ID</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter UPI ID (e.g., user@paytm)"
                  value={formData.upiId}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, upiId: text }))}
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, processingPayout && styles.disabledButton]}
              onPress={handlePayoutRequest}
              disabled={processingPayout}
            >
              {processingPayout ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'completed':
      return styles.completedStatus;
    case 'pending':
      return styles.pendingStatus;
    case 'processing':
      return styles.processingStatus;
    case 'failed':
      return styles.failedStatus;
    case 'available':
      return styles.availableStatus;
    case 'paid':
      return styles.paidStatus;
    default:
      return styles.defaultStatus;
  }
};

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
  balanceContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0EA5E9',
  },
  payoutButton: {
    margin: 16,
    backgroundColor: '#0EA5E9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  payoutButtonSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
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
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  payoutInfo: {
    flex: 1,
  },
  payoutAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  payoutMethod: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  payoutDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedStatus: {
    backgroundColor: '#dcfce7',
  },
  pendingStatus: {
    backgroundColor: '#fef3c7',
  },
  processingStatus: {
    backgroundColor: '#dbeafe',
  },
  failedStatus: {
    backgroundColor: '#fee2e2',
  },
  availableStatus: {
    backgroundColor: '#dcfce7',
  },
  paidStatus: {
    backgroundColor: '#e0e7ff',
  },
  defaultStatus: {
    backgroundColor: '#f1f5f9',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#64748b',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  placeholder: {
    width: 50,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  formHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  methodButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedMethod: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  selectedMethodText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
