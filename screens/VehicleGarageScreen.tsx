import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { vehicleApi } from '../lib/api';
import { isValidIndianVehicleNumber, normalizeVehicleNumber } from '../lib/security';
import { AppScreenProps } from '../types/navigation';

interface Vehicle {
  id: string;
  plate: string;
  createdAt: string;
}

type Props = AppScreenProps<'VehicleGarage'>;

export default function VehicleGarageScreen({ navigation }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [plateInput, setPlateInput] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await vehicleApi.list();
      setVehicles(data.vehicles || []);
    } catch {
      Alert.alert('Error', 'Could not load your vehicles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setPlateInput('');
    setShowModal(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setPlateInput(vehicle.plate);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVehicle(null);
    setPlateInput('');
  };

  const handleSave = async () => {
    const trimmed = normalizeVehicleNumber(plateInput);
    if (!isValidIndianVehicleNumber(trimmed)) {
      Alert.alert('Invalid plate', 'Enter a valid Indian vehicle registration number (e.g. MH12AB1234).');
      return;
    }

    setSaving(true);
    try {
      if (editingVehicle) {
        const data = await vehicleApi.update(editingVehicle.id, trimmed);
        setVehicles((prev) =>
          prev.map((v) => (v.id === editingVehicle.id ? data.vehicle : v))
        );
        Alert.alert('Updated ✓', `Plate updated to ${data.vehicle.plate}`);
      } else {
        const data = await vehicleApi.add(trimmed);
        setVehicles((prev) => [data.vehicle, ...prev]);
        Alert.alert('Added ✓', `${data.vehicle.plate} added to your garage.`);
      }
      closeModal();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to save vehicle.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.plate} from your garage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await vehicleApi.remove(vehicle.id);
              setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error || 'Could not remove vehicle.');
            }
          },
        },
      ]
    );
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <View style={styles.vehicleCard}>
      <LinearGradient
        colors={['#0F2027', '#203A43', '#2C5364']}
        style={styles.plateGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Indian plate top strip */}
        <View style={styles.plateStrip}>
          <View style={styles.plateFlag}>
            <View style={[styles.flagBar, { backgroundColor: '#FF9933' }]} />
            <View style={[styles.flagBar, { backgroundColor: '#ffffff' }]} />
            <View style={[styles.flagBar, { backgroundColor: '#138808' }]} />
          </View>
          <Text style={styles.plateCountry}>IND</Text>
          <View style={styles.cngBadge}>
            <Text style={styles.cngBadgeText}>CNG</Text>
          </View>
        </View>
        <Text style={styles.plateNumber}>{item.plate}</Text>
      </LinearGradient>

      <View style={styles.cardActions}>
        <Text style={styles.addedOn}>
          Added {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="pencil" size={16} color="#2563EB" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash" size={16} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>My Garage</Text>
          <Text style={styles.headerSub}>Your CNG vehicles</Text>
        </View>
        <TouchableOpacity
          onPress={openAddModal}
          style={[styles.addBtnHeader, vehicles.length >= 5 && styles.addBtnDisabled]}
          disabled={vehicles.length >= 5}
        >
          <Ionicons name="add" size={24} color={vehicles.length >= 5 ? '#94A3B8' : '#2563EB'} />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{vehicles.length}</Text>
          <Text style={styles.statLabel}>Vehicles</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{5 - vehicles.length}</Text>
          <Text style={styles.statLabel}>Slots left</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="leaf" size={18} color="#10B981" />
          <Text style={[styles.statLabel, { color: '#10B981' }]}>CNG Only</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your garage…</Text>
        </View>
      ) : vehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.emptyIconBg}>
            <Ionicons name="car-outline" size={56} color="#2563EB" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>No vehicles yet</Text>
          <Text style={styles.emptyBody}>Add your CNG vehicle number plate to track your CNG fuelling history and preferences.</Text>
          <TouchableOpacity style={styles.addFirstBtn} onPress={openAddModal}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.addFirstBtnGrad}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.addFirstBtnText}>Add First Vehicle</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            vehicles.length < 5 ? (
              <TouchableOpacity style={styles.addMoreCard} onPress={openAddModal}>
                <Ionicons name="add-circle-outline" size={22} color="#2563EB" />
                <Text style={styles.addMoreText}>Add another vehicle</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.maxReachedText}>Maximum 5 vehicles reached</Text>
            )
          }
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingVehicle ? 'Edit Vehicle Plate' : 'Add CNG Vehicle'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Enter your vehicle registration number exactly as on the plate.
            </Text>

            {/* Live plate preview */}
            <View style={styles.previewContainer}>
              <LinearGradient
                colors={['#0F2027', '#203A43', '#2C5364']}
                style={styles.previewPlate}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.plateStrip}>
                  <View style={styles.plateFlag}>
                    <View style={[styles.flagBar, { backgroundColor: '#FF9933' }]} />
                    <View style={[styles.flagBar, { backgroundColor: '#ffffff' }]} />
                    <View style={[styles.flagBar, { backgroundColor: '#138808' }]} />
                  </View>
                  <Text style={styles.plateCountry}>IND</Text>
                  <View style={styles.cngBadge}>
                    <Text style={styles.cngBadgeText}>CNG</Text>
                  </View>
                </View>
                <Text style={styles.plateNumber}>
                  {plateInput.trim().toUpperCase() || 'MH 12 AB 1234'}
                </Text>
              </LinearGradient>
            </View>

            <TextInput
              style={styles.plateInput}
              value={plateInput}
              onChangeText={(t) => setPlateInput(normalizeVehicleNumber(t))}
              placeholder="e.g. MH 12 AB 1234"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={15}
            />

            <Text style={styles.inputHint}>
              Format: State Code + District + Series + Number (e.g. MH12AB1234)
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{editingVehicle ? 'Update' : 'Add Vehicle'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  headerSub: { fontSize: 13, color: '#64748B', marginTop: 1 },
  addBtnHeader: { marginLeft: 'auto', padding: 6, backgroundColor: '#EFF6FF', borderRadius: 10 },
  addBtnDisabled: { backgroundColor: '#F1F5F9' },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  statDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },

  listContent: { padding: 16, gap: 16 },

  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  plateGradient: {
    padding: 16,
    paddingBottom: 20,
  },
  plateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  plateFlag: { flexDirection: 'row', height: 10, width: 16, borderRadius: 2, overflow: 'hidden' },
  flagBar: { flex: 1 },
  plateCountry: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cngBadge: {
    marginLeft: 'auto',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cngBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  plateNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addedOn: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  editBtn: { backgroundColor: '#EFF6FF' },
  editBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FEF2F2' },
  deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },

  addMoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
  },
  addMoreText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  maxReachedText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, paddingVertical: 16 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  emptyBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21 },
  addFirstBtn: { marginTop: 8 },
  addFirstBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  addFirstBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 20 },

  previewContainer: { alignItems: 'center', marginBottom: 20 },
  previewPlate: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 20,
  },

  plateInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    textAlign: 'center',
    backgroundColor: '#F8FAFF',
  },
  inputHint: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 24,
  },

  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#475569', fontSize: 15, fontWeight: '700' },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 14,
    gap: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
