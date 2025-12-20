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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

export default function ProfileScreen({ navigation }: Props) {
  const { setIsAuthenticated } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);

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

          <TouchableOpacity style={styles.manageButton} onPress={() => Alert.alert('Edit Profile', 'Feature coming soon')}>
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
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>8</Text>
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
            onPress={() => Alert.alert('Data Privacy', 'Coming soon')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="settings-outline"
            title="Settings"
            iconColor="#6B7280"
            onPress={() => Alert.alert('Settings', 'Coming soon')}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            title="Help & Support"
            iconColor="#8B5CF6"
            onPress={() => Alert.alert('Help & Support', 'Coming soon')}
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
});
