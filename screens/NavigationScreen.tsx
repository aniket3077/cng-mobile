import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { colors, spacing } from '../theme';
import { LIGHT_MAP_STYLE } from '../utils/mapStyle';

interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

interface Props {
  navigation?: any;
  route?: {
    params: {
      station: Station;
      currentLocation: Location.LocationObject;
    };
  };
}

export default function NavigationScreen({ navigation, route }: Props) {
  const { station, currentLocation: initialLocation } = route?.params || {};

  // Early return if required params are missing
  if (!station || !initialLocation) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Navigation data not available</Text>
      </View>
    );
  }

  const [currentLocation, setCurrentLocation] = useState(initialLocation);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [currentInstruction, setCurrentInstruction] = useState('Starting navigation...');
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    startNavigation();
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const startNavigation = async () => {
    try {
      // Get route from current location to destination
      await fetchRoute();

      // Start location tracking
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          setCurrentLocation(location);
          updateNavigationStatus(location);
        }
      );

      setLocationSubscription(subscription);

      // Announce navigation start
      speak(`Starting navigation to ${station.name}. Distance ${distance}`);
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to start navigation');
    }
  };

  const fetchRoute = async () => {
    // In production, use Google Directions API or Mapbox Directions API
    // For now, create a simple straight line route
    const coords = [
      {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      },
      {
        latitude: station.lat,
        longitude: station.lng,
      },
    ];

    setRouteCoordinates(coords);

    // Calculate distance (simple Haversine formula)
    const dist = calculateDistance(
      initialLocation.coords.latitude,
      initialLocation.coords.longitude,
      station.lat,
      station.lng
    );

    setDistance(`${dist.toFixed(1)} km`);
    setDuration(calculateDuration(dist));

    // Center map on route
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  };

  const updateNavigationStatus = (location: Location.LocationObject) => {
    // Calculate remaining distance
    const remainingDist = calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      station.lat,
      station.lng
    );

    setDistance(`${remainingDist.toFixed(1)} km`);
    setDuration(calculateDuration(remainingDist));

    // Check if arrived
    if (remainingDist < 0.1) { // Within 100 meters
      handleArrival();
    } else {
      // Update instruction based on distance
      const instruction = getNavigationInstruction(remainingDist);
      if (instruction !== currentInstruction) {
        setCurrentInstruction(instruction);
        speak(instruction);
      }
    }
  };

  const getNavigationInstruction = (distanceKm: number): string => {
    if (distanceKm < 0.1) {
      return 'You have arrived at your destination';
    } else if (distanceKm < 0.5) {
      return `In ${(distanceKm * 1000).toFixed(0)} meters, you will arrive at ${station.name}`;
    } else if (distanceKm < 1) {
      return `Continue for ${(distanceKm * 1000).toFixed(0)} meters`;
    } else {
      return `Continue for ${distanceKm.toFixed(1)} kilometers`;
    }
  };

  const handleArrival = () => {
    speak(`You have arrived at ${station.name}`);

    Alert.alert(
      'Arrived!',
      `You have reached ${station.name}`,
      [
        {
          text: 'End Navigation',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const calculateDuration = (distanceKm: number): string => {
    // Assume average speed of 40 km/h in city
    const hours = distanceKm / 40;
    const minutes = Math.round(hours * 60);

    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;

    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs} hr ${mins} min`;
  };

  const speak = (text: string) => {
    Speech.speak(text, {
      language: 'en-IN',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const handleEndNavigation = () => {
    Alert.alert(
      'End Navigation',
      'Are you sure you want to end navigation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            if (locationSubscription) {
              locationSubscription.remove();
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        followsUserLocation
        showsPointsOfInterest={false}
        showsBuildings={false}
        customMapStyle={LIGHT_MAP_STYLE}
        loadingEnabled
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}

        {/* Destination Marker */}
        <Marker
          coordinate={{
            latitude: station.lat,
            longitude: station.lng,
          }}
          title={station.name}
          description={station.address}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="location" size={40} color="#FF3B30" />
          </View>
        </Marker>
      </MapView>

      {/* Navigation Info Panel */}
      <View style={styles.infoPanel}>
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>{distance}</Text>
          <Text style={styles.durationText}>{duration}</Text>
        </View>

        <View style={styles.instructionContainer}>
          <Ionicons name="navigate" size={24} color={colors.primary} />
          <Text style={styles.instructionText}>{currentInstruction}</Text>
        </View>

        <View style={styles.destinationInfo}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.destinationText}>{station.name}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndNavigation}
        >
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.soundButton}
          onPress={() => speak(currentInstruction)}
        >
          <Ionicons name="volume-high" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginTop: 50,
  },
  map: {
    flex: 1,
  },
  destinationMarker: {
    alignItems: 'center',
  },
  infoPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  distanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  distanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  durationText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500',
  },
  destinationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  destinationText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  soundButton: {
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});
