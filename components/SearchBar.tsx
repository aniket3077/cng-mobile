import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { EvilIcons, Entypo, MaterialCommunityIcons } from '@expo/vector-icons';

interface SearchBarProps {
  destination: string;
  onPress: () => void;
  onProfilePress: () => void;
  fadeAnim: Animated.Value;
}

export default function SearchBar({ destination, onPress, onProfilePress, fadeAnim }: SearchBarProps) {
  return (
    <Animated.View style={[styles.topBar, { opacity: fadeAnim }]}>
      {/* Profile Button */}
      <TouchableOpacity style={styles.profileButton} onPress={onProfilePress}>
        <MaterialCommunityIcons name="account-circle" size={40} color="#5F6368" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.destinationInput} onPress={onPress} activeOpacity={0.7}>
        <Text style={[styles.input, !destination && styles.placeholderText]}>
          {destination || 'Search CNG Bharat Maps'}
        </Text>
        <View style={styles.searchActions}>
          <TouchableOpacity style={styles.iconButton}>
            <EvilIcons name="search" size={28} color="#5F6368" />
          </TouchableOpacity>
          {destination && (
            <TouchableOpacity style={styles.navIconButton} onPress={onPress}>
              <Entypo name="direction" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 30,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  destinationInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F9D58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#5F6368',
  },
  placeholderText: {
    color: '#5F6368',
  },
});
