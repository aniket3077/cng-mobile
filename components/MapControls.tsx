import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Entypo } from '@expo/vector-icons';

interface MapControlsProps {
  onCenterLocation: () => void;
  onToggleMapType: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function MapControls({
  onCenterLocation,
  onToggleMapType,
  onZoomIn,
  onZoomOut,
}: MapControlsProps) {
  return (
    <View style={styles.mapControls}>
      {/* Location Center Button */}
      <TouchableOpacity style={styles.mapControlBtn} onPress={onCenterLocation}>
        <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#5F6368" />
      </TouchableOpacity>

      {/* Layers Button */}
      <TouchableOpacity style={styles.mapControlBtn} onPress={onToggleMapType}>
        <MaterialCommunityIcons name="layers" size={24} color="#5F6368" />
      </TouchableOpacity>

      {/* Zoom In/Out Buttons */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomBtn} onPress={onZoomIn}>
          <Entypo name="plus" size={24} color="#5F6368" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={onZoomOut}>
          <Entypo name="minus" size={24} color="#5F6368" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 40,
    gap: 12,
    zIndex: 10,
  },
  mapControlBtn: {
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
  zoomControls: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E8EAED',
  },
});
