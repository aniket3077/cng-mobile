import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';

interface LoadingScreenProps {
  pulseAnim: Animated.Value;
}

export default function LoadingScreen({ pulseAnim }: LoadingScreenProps) {
  return (
    <View style={styles.loadingContainer}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={styles.loadingIconContainer}>
          <Text style={styles.loadingIcon}>⛽</Text>
        </View>
      </Animated.View>
      <Text style={styles.loadingTitle}>CNG Finder</Text>
      <Text style={styles.loadingSubtitle}>Finding nearby stations</Text>
      <ActivityIndicator size="large" color="#000" style={styles.loadingSpinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingIcon: {
    fontSize: 48,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
  },
  loadingSpinner: {
    marginTop: 16,
  },
});
