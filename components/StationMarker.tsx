import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface StationMarkerProps {
  station: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    cngAvailable?: number;
  };
}

export default function StationMarker({ station }: StationMarkerProps) {
  const cngAvailable = station.cngAvailable || 0;
  const cngStatus = cngAvailable > 500 ? 'Full' : cngAvailable > 200 ? 'Available' : cngAvailable > 0 ? 'Low' : 'Empty';

  return (
    <Marker
      coordinate={{
        latitude: station.lat,
        longitude: station.lng,
      }}
      title={station.name}
      description={`${station.address}\n🔋 CNG Available: ${cngAvailable} kg (${cngStatus})`}
    >
      <View style={styles.gasStationMarker}>
        <MaterialCommunityIcons name="gas-station" size={32} color="#FFFFFF" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  gasStationMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
});
