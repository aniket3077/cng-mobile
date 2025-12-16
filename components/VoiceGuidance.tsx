import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Entypo } from '@expo/vector-icons';

interface VoiceGuidanceProps {
  instruction: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

export default function VoiceGuidance({ instruction, voiceEnabled, onToggleVoice }: VoiceGuidanceProps) {
  if (!instruction) return null;

  return (
    <View style={styles.voiceBar}>
      <TouchableOpacity style={styles.voiceIconBtn} onPress={onToggleVoice}>
        {voiceEnabled ? (
          <Entypo name="sound" size={20} color="#000" />
        ) : (
          <Entypo name="sound-mute" size={20} color="#000" />
        )}
      </TouchableOpacity>
      <Text style={styles.voiceText}>{instruction}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  voiceBar: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  voiceText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
