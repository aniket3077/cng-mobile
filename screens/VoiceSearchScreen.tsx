import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { colors, spacing } from '../theme';
import { voiceQueryApi } from '../lib/api';

interface Props {
  navigation: any;
}

export default function VoiceSearchScreen({ navigation }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [processingQuery, setProcessingQuery] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (isListening) {
      startPulseAnimation();
    }
  }, [isListening]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startVoiceRecognition = async () => {
    try {
      // Note: expo-speech doesn't have voice recognition
      // For production, use @react-native-voice/voice or Google Speech API
      
      setIsListening(true);
      speak('I am listening. Please tell me what you need.');
      
      // Simulate voice recognition for demo
      setTimeout(() => {
        simulateVoiceInput();
      }, 3000);
      
    } catch (error) {
      console.error('Voice recognition error:', error);
      Alert.alert('Error', 'Failed to start voice recognition');
      setIsListening(false);
    }
  };

  const simulateVoiceInput = () => {
    // For demo - in production, this would be actual voice recognition
    const sampleQueries = [
      'Find nearby CNG pump',
      'Navigate to nearest CNG station',
      'Is CNG available nearby',
      'Show me CNG stations in Delhi',
    ];
    
    const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
    setRecognizedText(randomQuery);
    setIsListening(false);
    processVoiceQuery(randomQuery);
  };

  const processVoiceQuery = async (query: string) => {
    setProcessingQuery(true);
    
    try {
      // Get current location (optional but improves results)
      let lat: number | undefined;
      let lng: number | undefined;
      let currentLocation: Location.LocationObject | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = currentLocation.coords.latitude;
          lng = currentLocation.coords.longitude;
        }
      } catch {
        // Location is optional for voice search
      }

      const res = await voiceQueryApi.processQuery({
        query,
        lat,
        lng,
      });

      if (!res?.success) {
        speak('Sorry, I could not process your request right now.');
        return;
      }

      // Speak backend-generated response (already limited to our approved CNG Bharat stations)
      speak(res.response || 'Here are CNG Bharat stations I found.');

      // If user asked to navigate, start navigation to nearest station
      if (res.intent === 'navigation' && res.nearestStation && currentLocation) {
        const station = res.nearestStation;
        navigation.navigate('Navigation', {
          station: {
            id: station.id,
            name: station.name,
            address: station.address,
            city: station.city,
            lat: station.lat,
            lng: station.lng,
          },
          currentLocation,
        });
        return;
      }

      // For other intents, go back to map (it will show nearby stations)
      setTimeout(() => {
        navigation.navigate('MapHome');
      }, 1500);
    } catch (error) {
      console.error('Process query error:', error);
      speak('Sorry, I encountered an error processing your request');
    } finally {
      setProcessingQuery(false);
    }
  };

  const speak = (text: string) => {
    Speech.speak(text, {
      language: 'en-IN', // Indian English
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const stopListening = () => {
    setIsListening(false);
    pulseAnim.setValue(1);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
      </View>

      {/* Voice Animation */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.microphoneContainer,
            {
              transform: [{ scale: isListening ? pulseAnim : 1 }],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.microphoneButton,
              isListening && styles.microphoneButtonActive,
            ]}
            onPress={isListening ? stopListening : startVoiceRecognition}
            disabled={processingQuery}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={80}
              color="#fff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Status Text */}
        <Text style={styles.statusText}>
          {isListening
            ? 'Listening...'
            : processingQuery
            ? 'Processing...'
            : 'Tap to speak'}
        </Text>

        {/* Recognized Text */}
        {recognizedText && (
          <View style={styles.recognizedContainer}>
            <Text style={styles.recognizedLabel}>You said:</Text>
            <Text style={styles.recognizedText}>{recognizedText}</Text>
          </View>
        )}

        {/* Suggestions */}
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Try saying:</Text>
          {[
            'Find nearby CNG pump',
            'Navigate to nearest CNG station',
            'Is CNG available nearby?',
            'Show CNG stations in [city name]',
          ].map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => {
                setRecognizedText(suggestion);
                processVoiceQuery(suggestion);
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Info Footer */}
      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.footerText}>
          Voice assistant works hands-free while driving
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  microphoneContainer: {
    marginBottom: spacing.xl,
  },
  microphoneButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  microphoneButtonActive: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  recognizedContainer: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.xl,
    width: '100%',
  },
  recognizedLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  recognizedText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  suggestionsContainer: {
    width: '100%',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});
