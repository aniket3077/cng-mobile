import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Modal,
  Linking,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStorage } from '../lib/auth';
import { useAuth } from '../lib/authContext';
import { customerProfileApi } from '../lib/api';
import { colors, spacing } from '../theme';

interface Props {
  navigation: any;
}

interface Vehicle {
  id: string;
  plate: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  vehicles?: Vehicle[];
  tripCount?: number;
  favoriteCount?: number;
}

export default function ProfileScreen({ navigation }: Props) {
  const { setIsAuthenticated } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [tripCount, setTripCount] = useState<number | null>(null);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const handleOpenEditModal = () => {
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: user.phone || '',
      });
      setShowEditModal(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }
    if (editForm.phone && !/^\d{10,15}$/.test(editForm.phone)) {
      Alert.alert('Validation Error', 'Phone must be between 10 and 15 digits');
      return;
    }

    setSubmittingEdit(true);
    try {
      const response = await customerProfileApi.update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
      });
      
      Alert.alert('Success', 'Profile updated successfully');
      
      if (response.user) {
        setUser(response.user);
        await authStorage.saveUser(response.user);
      }
      setShowEditModal(false);
    } catch (error: any) {
      const errMsg = error.response?.data?.error || error.message || 'Failed to update profile';
      Alert.alert('Error', errMsg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({
    category: 'app_bug',
    subject: '',
    description: '',
  });
  const [submittingSupport, setSubmittingSupport] = useState(false);

  const [showDataModal, setShowDataModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    notificationsEnabled: true,
    locationTrackingEnabled: true,
  });

  const handleOpenSupport = () => {
    setSupportForm({
      category: 'app_bug',
      subject: '',
      description: '',
    });
    setShowSupportModal(true);
  };

  const handleContactWhatsApp = () => {
    Linking.openURL('https://wa.me/919999999999?text=Hello%20CNG%20Bharat%20Support');
  };

  const handleContactEmail = () => {
    Linking.openURL('mailto:support@cngbharat.com?subject=CNG%20Bharat%20Support%20Request');
  };

  const handleContactPhone = () => {
    Linking.openURL('tel:+919999999999');
  };

  const handleSubmitSupport = async () => {
    if (!supportForm.subject.trim() || !supportForm.description.trim()) {
      Alert.alert('Validation Error', 'Please complete the subject and description.');
      return;
    }

    setSubmittingSupport(true);
    try {
      const res = await customerProfileApi.submitSupportTicket({
        subject: supportForm.subject.trim(),
        description: supportForm.description.trim(),
        category: supportForm.category,
      });

      const ticketNum = res.ticket?.ticketNumber || 'Submitted';
      Alert.alert(
        'Ticket Created',
        `Your support request has been submitted successfully.\n\nTicket Number: ${ticketNum}\nOur team will contact you shortly.`,
        [{ text: 'OK', onPress: () => setShowSupportModal(false) }]
      );
    } catch (error: any) {
      const errMsg = error.response?.data?.error || error.message || 'Failed to submit support request';
      Alert.alert('Error', errMsg);
    } finally {
      setSubmittingSupport(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
    loadProfileImage();
  }, []);

  const loadUserProfile = async () => {
    try {
      const storedUser = await authStorage.getUser();
      if (storedUser) {
        setUser(storedUser);
      }

      const res = await customerProfileApi.get();
      if (res?.user) {
        setUser(res.user);
        await authStorage.saveUser(res.user);
        setTripCount(res.user.tripCount ?? null);
        setFavoriteCount(res.user.favoriteCount ?? null);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileImage = async () => {
    try {
      const savedImage = await AsyncStorage.getItem('profileImage');
      if (savedImage) {
        setProfileImage(savedImage);
      }
    } catch (error) {
      console.error('Failed to load profile image:', error);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to set a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        await AsyncStorage.setItem('profileImage', imageUri);
        Alert.alert('Success', 'Profile picture updated!');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await authStorage.clearAuth();
            setIsAuthenticated(false);
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.\n\nYour personal data will be anonymized immediately. Financial records will be retained for 7 years for legal compliance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await customerProfileApi.deleteAccount();
              Alert.alert(
                'Account Deleted',
                response.message || 'Your account has been deleted.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await authStorage.clearAuth();
                      setIsAuthenticated(false);
                    },
                  },
                ]
              );
            } catch (error: any) {
              const errMsg = error.response?.data?.error || error.message || 'Failed to delete account';
              Alert.alert('Error', errMsg);
            }
          },
        },
      ]
    );
  };

  const MenuItem = ({ icon, title, onPress, iconColor = '#444', showArrow = true }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.menuText}>{title}</Text>
      {showArrow && <Ionicons name="chevron-forward" size={20} color="#999" />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Account</Text>
                <Text style={styles.modalSubtitle}>
                  Update your contact details below.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  value={editForm.name}
                  onChangeText={(value) => setEditForm((current) => ({ ...current, name: value }))}
                  placeholder="Enter your name"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  value={editForm.phone}
                  onChangeText={(value) => setEditForm((current) => ({ ...current, phone: value.replace(/[^0-9]/g, '') }))}
                  placeholder="Enter phone number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={15}
                  style={styles.input}
                />
              </View>

              <TouchableOpacity onPress={handleSaveProfile} disabled={submittingEdit} activeOpacity={0.92}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.primaryButton}>
                  {submittingEdit ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Save Details</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSupportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.supportHeader}>
              <View>
                <Text style={styles.modalTitle}>Help & Support</Text>
                <Text style={styles.modalSubtitle}>
                  Contact us or submit a ticket below.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSupportModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Contact Channels */}
              <View style={styles.contactRow}>
                <TouchableOpacity onPress={handleContactWhatsApp} style={styles.contactButton}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={styles.contactButtonText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleContactEmail} style={styles.contactButton}>
                  <Ionicons name="mail-outline" size={18} color="#EA4335" />
                  <Text style={styles.contactButtonText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleContactPhone} style={styles.contactButton}>
                  <Ionicons name="call-outline" size={18} color="#0F172A" />
                  <Text style={styles.contactButtonText}>Call Us</Text>
                </TouchableOpacity>
              </View>

              {/* Category Pills */}
              <Text style={styles.categoryLabel}>Select Category</Text>
              <View style={styles.categoryPills}>
                {[
                  { id: 'app_bug', label: 'Technical Issue' },
                  { id: 'payment', label: 'Payments' },
                  { id: 'pump', label: 'CNG Pump Info' },
                  { id: 'referral', label: 'Refer & Earn' },
                  { id: 'other', label: 'Other Feedback' },
                ].map((cat) => {
                  const isActive = supportForm.category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSupportForm((current) => ({ ...current, category: cat.id }))}
                      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                    >
                      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Subject Input */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  value={supportForm.subject}
                  onChangeText={(value) => setSupportForm((current) => ({ ...current, subject: value }))}
                  placeholder="Summarize your issue"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              {/* Description Input */}
              <View style={[styles.inputCard, { minHeight: 120 }]}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  value={supportForm.description}
                  onChangeText={(value) => setSupportForm((current) => ({ ...current, description: value }))}
                  placeholder="Describe details of your request..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  style={[styles.input, { textAlignVertical: 'top' }]}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity onPress={handleSubmitSupport} disabled={submittingSupport} activeOpacity={0.92}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.primaryButton}>
                  {submittingSupport ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Submit Ticket</Text>
                      <Ionicons name="send" size={16} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDataModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDataModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.supportHeader}>
              <View>
                <Text style={styles.modalTitle}>Your Data & Privacy</Text>
                <Text style={styles.modalSubtitle}>
                  Below is a summary of personal information we store.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDataModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Profile Info</Text>
                <Text style={[styles.dataText, { marginTop: 8 }]}>Name: {user?.name}</Text>
                <Text style={styles.dataText}>Email: {user?.email}</Text>
                <Text style={styles.dataText}>Phone: {user?.phone || 'Not provided'}</Text>
              </View>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Registered Vehicles</Text>
                {user?.vehicles && user.vehicles.length > 0 ? (
                  user.vehicles.map((v, i) => (
                    <Text key={v.id} style={[styles.dataText, i === 0 && { marginTop: 8 }]}>
                      • {v.plate}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.dataText, { marginTop: 8 }]}>No vehicles registered</Text>
                )}
              </View>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Privacy Rights</Text>
                <Text style={[styles.dataText, { marginTop: 8, lineHeight: 18 }]}>
                  Your data is protected under CNG Bharat's strict privacy policy. You can request a copy of your records or permanently delete your account at any time.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Data Exported',
                    JSON.stringify(
                      {
                        profile: {
                          name: user?.name,
                          email: user?.email,
                          phone: user?.phone,
                        },
                        vehicles: user?.vehicles?.map((v) => v.plate) || [],
                        timestamp: new Date().toISOString(),
                      },
                      null,
                      2
                    )
                  );
                }}
                activeOpacity={0.92}
              >
                <LinearGradient colors={['#10B981', '#059669']} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Download Data Summary</Text>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.supportHeader}>
              <View>
                <Text style={styles.modalTitle}>Settings</Text>
                <Text style={styles.modalSubtitle}>
                  Configure your application preferences.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.inputLabel}>Push Notifications</Text>
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      Receive updates on queue times and new CNG stations.
                    </Text>
                  </View>
                  <Switch
                    value={settingsForm.notificationsEnabled}
                    onValueChange={(value) => setSettingsForm((current) => ({ ...current, notificationsEnabled: value }))}
                    trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                    thumbColor={settingsForm.notificationsEnabled ? '#10B981' : '#94A3B8'}
                  />
                </View>
              </View>

              <View style={styles.inputCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.inputLabel}>Location Tracking</Text>
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      Permits showing nearby pumps on the home navigation screen.
                    </Text>
                  </View>
                  <Switch
                    value={settingsForm.locationTrackingEnabled}
                    onValueChange={(value) => setSettingsForm((current) => ({ ...current, locationTrackingEnabled: value }))}
                    trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                    thumbColor={settingsForm.locationTrackingEnabled ? '#10B981' : '#94A3B8'}
                  />
                </View>
              </View>

              <TouchableOpacity onPress={() => setShowSettingsModal(false)} activeOpacity={0.92}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Close Settings</Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emailText}>{user?.email || 'No email'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#444" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <Image source={require('../assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png')} style={styles.avatarLogo} />
              )}
            </View>
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.greeting}>Hi, {firstName}!</Text>

          <TouchableOpacity style={styles.manageButton} onPress={handleOpenEditModal}>
            <Text style={styles.manageButtonText}>Manage your account</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.vehicles?.length || 0}</Text>
            <Text style={styles.statLabel}>Vehicles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tripCount !== null ? tripCount : '--'}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{favoriteCount !== null ? favoriteCount : '--'}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        {/* More from CNG Bharat */}
        <Text style={styles.sectionHeader}>More from CNG Bharat</Text>

        <View style={styles.menuCard}>
          <MenuItem
            icon="car-outline"
            title="My Vehicles"
            iconColor="#6366F1"
            onPress={() => Alert.alert('My Vehicles', user?.vehicles?.map((v, i) => `${i + 1}. ${v.plate}`).join('\n') || 'No vehicles')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="location-outline"
            title="Saved Stations"
            iconColor="#EF4444"
            onPress={() => Alert.alert('Saved Stations', 'Coming soon')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="time-outline"
            title="Trip History"
            iconColor="#F59E0B"
            onPress={() => Alert.alert('Trip History', 'Coming soon')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="card-outline"
            title="Buy Subscription"
            iconColor="#F59E0B"
            onPress={() => navigation.navigate('Subscription')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="people-outline"
            title="Refer & Earn"
            iconColor="#10B981"
            onPress={() => navigation.navigate('Referral')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="wallet-outline"
            title="Payouts"
            iconColor="#6366F1"
            onPress={() => navigation.navigate('Payout')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="download-outline"
            title="Offline Maps"
            iconColor="#10B981"
            onPress={() => Alert.alert('Offline Maps', 'Coming soon')}
          />
        </View>

        {/* Data & Privacy */}
        <Text style={styles.sectionHeader}>Data & Privacy</Text>

        <View style={styles.menuCard}>
          <MenuItem
            icon="shield-checkmark-outline"
            title="Your data in CNG Bharat"
            iconColor="#0EA5E9"
            onPress={() => setShowDataModal(true)}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="settings-outline"
            title="Settings"
            iconColor="#6B7280"
            onPress={() => setShowSettingsModal(true)}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            title="Help & Support"
            iconColor="#8B5CF6"
            onPress={handleOpenSupport}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="trash-outline"
            title="Delete Account"
            iconColor="#EF4444"
            onPress={handleDeleteAccount}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </View>
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
  },
  emailText: {
    fontSize: 15,
    color: '#444',
    fontWeight: '500',
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 4,
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: '#fff',
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
  },
  avatarLogo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: spacing.md,
  },
  manageButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  manageButtonText: {
    fontSize: 15,
    color: '#3B82F6',
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    padding: spacing.lg,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  menuCard: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  menuIconContainer: {
    marginRight: spacing.md,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    padding: spacing.lg,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  bottomSpace: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.48)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    color: '#6B7280',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  inputCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  input: {
    fontSize: 15,
    marginTop: 10,
    paddingVertical: 0,
    color: '#1F2937',
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
  supportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  contactButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    gap: 6,
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryPillTextActive: {
    color: '#10B981',
  },
  dataText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
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
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
});
