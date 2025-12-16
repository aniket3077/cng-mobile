import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StationSuggestion } from '../types';

interface StationsListProps {
  stations: StationSuggestion[];
  loading: boolean;
  selectedFuelType: string;
}

export default function StationsList({ stations, loading, selectedFuelType }: StationsListProps) {
  return (
    <View style={styles.bottomPanel}>
      <View style={styles.bottomHandle} />
      
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>STATIONS ALONG ROUTE</Text>
        {loading && <ActivityIndicator size="small" color="#000" />}
      </View>
      
      <ScrollView 
        style={styles.stationsList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.stationsListContent}
      >
        {stations.length > 0 ? (
          stations.map((item) => (
            <View key={item.station.id} style={styles.stationCard}>
              <View style={styles.stationLeft}>
                <View style={[
                  styles.fuelBadge,
                  { backgroundColor: item.station.fuelTypes.includes('CNG') ? '#10B981' : '#EF4444' }
                ]}>
                  <Text style={styles.fuelBadgeText}>
                    {item.station.fuelTypes.includes('CNG') ? 'CNG' : 'PETROL'}
                  </Text>
                </View>
                <View style={styles.stationInfo}>
                  <Text style={styles.stationName}>{item.station.name}</Text>
                  <Text style={styles.stationTypes}>{item.station.fuelTypes}</Text>
                </View>
              </View>
              <View style={styles.distanceBox}>
                <Text style={styles.distanceValue}>{item.distance.toFixed(1)}</Text>
                <Text style={styles.distanceUnit}>km</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noStationsContainer}>
            <MaterialCommunityIcons name="gas-station-off" size={48} color="#BDC1C6" />
            <Text style={styles.noStationsTitle}>No stations found</Text>
            <Text style={styles.noStationsText}>
              No {selectedFuelType} stations found within 5km of your route.
            </Text>
            <TouchableOpacity 
              style={styles.expandSearchBtn}
              onPress={() => {
                Alert.alert(
                  'Expand Search',
                  'Would you like to search for stations further from your route?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Yes', onPress: () => console.log('Expand search') }
                  ]
                );
              }}
            >
              <Text style={styles.expandSearchText}>Expand Search Area</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    paddingTop: 8,
  },
  bottomHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
  stationsList: {
    flex: 1,
  },
  stationsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  noStationsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  noStationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginTop: 16,
    marginBottom: 8,
  },
  noStationsText: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  expandSearchBtn: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  expandSearchText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stationLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fuelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  fuelBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  stationTypes: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  distanceBox: {
    alignItems: 'flex-end',
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    lineHeight: 24,
  },
  distanceUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
});
