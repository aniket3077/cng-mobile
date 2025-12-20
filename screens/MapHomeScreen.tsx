import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { placesApi, routePlanningApi, stationsApi } from '../lib/api';
import { colors, spacing } from '../theme';
import { decodePolyline } from '../utils/mapHelpers';
import { LIGHT_MAP_STYLE } from '../utils/mapStyle';

interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  fuelTypes: string;
  phone?: string;
  openingHours?: string;
  isPartner: boolean;
  cngAvailable?: boolean;
  cngQuantityKg?: number | null;
}

interface Props {
  navigation: any;
}

export default function MapHomeScreen({ navigation }: Props) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState<Region | null>(null);

  const [showRoutePlanModal, setShowRoutePlanModal] = useState(false);
  const [travelMode, setTravelMode] = useState<'driving' | 'motorcycle' | 'transit' | 'walking' | 'bicycling'>('driving');
  const [startingPoint, setStartingPoint] = useState('Your location');
  const [startingCoords, setStartingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [startingSuggestions, setStartingSuggestions] = useState<any[]>([]);
  const [showStartingSuggestions, setShowStartingSuggestions] = useState(false);
  const [destinationSuggestions, setDestinationSuggestions] = useState<any[]>([]);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);

  const [plannedRouteCoords, setPlannedRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [plannedDestination, setPlannedDestination] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [stationsAlongRoute, setStationsAlongRoute] = useState<Station[]>([]);
  const [stationHighlightRank, setStationHighlightRank] = useState<Record<string, number>>({});

  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationStation, setNavigationStation] = useState<Station | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    requestLocationPermission();
    loadProfileImage();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location services to find nearby CNG stations.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(currentLocation);

      const initialRegion = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

      setRegion(initialRegion);

      // Fetch nearby stations
      await fetchNearbyStations(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
    } catch (error) {
      console.error('Error fetching location:', error);
      Alert.alert('Error', 'Could not fetch your location. Please try again.');
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

  const handleClearSearch = () => {
    setSearchQuery('');
    setStations(allStations);
  };

  const searchPlaces = async (input: string) => {
    const lat = location?.coords.latitude;
    const lng = location?.coords.longitude;

    const res = await placesApi.autocomplete({
      input,
      lat,
      lng,
      radius: 50000,
    });

    return res.predictions || [];
  };

  const onSearchStartingPoint = async (text: string) => {
    setStartingPoint(text);
    setStartingCoords(null);
    setShowStartingSuggestions(true);

    if (text.trim().length < 2) {
      setStartingSuggestions([]);
      return;
    }

    try {
      const predictions = await searchPlaces(text.trim());
      setStartingSuggestions(predictions);
    } catch (e) {
      setStartingSuggestions([]);
    }
  };

  const onSearchDestination = async (text: string) => {
    setDestination(text);
    setDestinationCoords(null);
    setShowDestinationSuggestions(true);

    if (text.trim().length < 2) {
      setDestinationSuggestions([]);
      return;
    }

    try {
      const predictions = await searchPlaces(text.trim());
      setDestinationSuggestions(predictions);
    } catch (e) {
      setDestinationSuggestions([]);
    }
  };

  const onSelectStartingSuggestion = async (prediction: any) => {
    setStartingPoint(prediction.description || prediction.mainText || '');
    setShowStartingSuggestions(false);
    try {
      const details = await placesApi.getDetails(prediction.placeId);
      const loc = details?.place?.location;
      if (loc?.lat != null && loc?.lng != null) {
        setStartingCoords({ lat: loc.lat, lng: loc.lng });
      }
    } catch (e) {
      // ignore
    }
  };

  const onSelectDestinationSuggestion = async (prediction: any) => {
    setDestination(prediction.description || prediction.mainText || '');
    setShowDestinationSuggestions(false);
    try {
      const details = await placesApi.getDetails(prediction.placeId);
      const loc = details?.place?.location;
      if (loc?.lat != null && loc?.lng != null) {
        setDestinationCoords({ lat: loc.lat, lng: loc.lng });
      }
    } catch (e) {
      // ignore
    }
  };

  const onSwapRoutePoints = () => {
    const nextStartingPoint = destination;
    const nextStartingCoords = destinationCoords;
    const nextDestination = startingPoint;
    const nextDestinationCoords = startingCoords;

    setStartingPoint(nextStartingPoint);
    setStartingCoords(nextStartingCoords);
    setDestination(nextDestination);
    setDestinationCoords(nextDestinationCoords);

    setShowStartingSuggestions(false);
    setShowDestinationSuggestions(false);
  };

  const buildLocationObject = (lat: number, lng: number): Location.LocationObject => {
    return {
      coords: {
        latitude: lat,
        longitude: lng,
        altitude: null,
        accuracy: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
  };

  const onStartRouteNavigation = () => {
    if (!destinationCoords) {
      Alert.alert('Select destination', 'Please select a destination first.');
      return;
    }

    const origin =
      startingPoint === 'Your location' || !startingCoords
        ? location
        : buildLocationObject(startingCoords.lat, startingCoords.lng);

    if (!origin) {
      Alert.alert('Location unavailable', 'Unable to determine starting location.');
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const originCoords = {
          lat: origin.coords.latitude,
          lng: origin.coords.longitude,
          address: startingPoint,
        };
        const destCoords = {
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
          address: destination,
        };

        const result = await routePlanningApi.planRoute({
          origin: originCoords,
          destination: destCoords,
          travelMode,
          fuelType: 'CNG',
        });

        const polylineStr: string = result?.route?.polyline || '';
        const decoded = polylineStr ? decodePolyline(polylineStr) : [];
        setPlannedRouteCoords(decoded);
        setPlannedDestination({ lat: destCoords.lat, lng: destCoords.lng, label: destination || 'Destination' });

        const routeStationsRaw = Array.isArray(result?.stations) ? result.stations : [];
        const routeStations: Station[] = routeStationsRaw
          .map((s: any) => s?.station)
          .filter(Boolean);
        setStationsAlongRoute(routeStations);

        const ranked = routeStationsRaw
          .slice()
          .sort((a: any, b: any) => (a?.distanceToRoute ?? 999999) - (b?.distanceToRoute ?? 999999));
        const rankMap: Record<string, number> = {};
        ranked.forEach((entry: any, idx: number) => {
          const id = entry?.station?.id;
          if (id) rankMap[id] = idx;
        });
        setStationHighlightRank(rankMap);

        if (mapRef.current && decoded.length > 0) {
          mapRef.current.fitToCoordinates(decoded, {
            edgePadding: { top: 120, right: 60, bottom: 340, left: 60 },
            animated: true,
          });
        }

        // Enable navigation mode with Exit button
        setIsNavigating(true);
        setNavigationStation({
          id: 'route-destination',
          name: destination || 'Destination',
          lat: destCoords.lat,
          lng: destCoords.lng,
          address: destination || '',
          city: '',
          state: '',
          fuelTypes: 'CNG',
        } as Station);

        setSelectedStation(null);
        setShowRoutePlanModal(false);
        setShowStartingSuggestions(false);
        setShowDestinationSuggestions(false);
      } catch (e) {
        Alert.alert('Error', 'Failed to plan route');
      } finally {
        setLoading(false);
      }
    })();
  };

  const getDisplayedStations = () => {
    if (!stationsAlongRoute.length) return stations;
    const byId = new Map<string, Station>();
    stations.forEach(s => byId.set(s.id, s));
    stationsAlongRoute.forEach(s => {
      const existing = byId.get(s.id);
      byId.set(s.id, existing ? { ...existing, ...s } : s);
    });
    return Array.from(byId.values());
  };

  const getMarkerVisual = (stationId: string) => {
    const rank = stationHighlightRank[stationId];
    if (rank === undefined) {
      return { pin: colors.accent, scale: 1 };
    }
    if (rank === 0) return { pin: '#F59E0B', scale: 1.2 };
    if (rank === 1) return { pin: '#3B82F6', scale: 1.14 };
    if (rank === 2) return { pin: '#10B981', scale: 1.1 };
    return { pin: colors.accent, scale: 1.06 };
  };

  const fetchNearbyStations = async (lat: number, lng: number, radius: number = 10) => {
    try {
      setLoading(true);
      const response = await stationsApi.list({
        lat,
        lng,
        radius,
        fuelType: 'CNG',
      });

      const nextStations: Station[] = response.stations || [];
      setAllStations(nextStations);
      setStations(nextStations);
    } catch (error: any) {
      console.error('Fetch stations error:', error);
      Alert.alert('Error', 'Failed to fetch nearby stations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setStations(allStations);
    }
  }, [searchQuery, allStations]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Enter Search Query', 'Please enter a location or station name');
      return;
    }

    // Simple search implementation - you can enhance with Google Places API
    const filtered = allStations.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length > 0) {
      setStations(filtered);
      // Center map on first result
      const station = filtered[0];
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: station.lat,
          longitude: station.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } else {
      Alert.alert('No Results', 'No stations found matching your search');
    }
  };

  const handleMarkerPress = (station: Station) => {
    setSelectedStation(station);

    // Center map on selected station
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: station.lat,
        longitude: station.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const handleMyLocation = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      // Refresh stations
      fetchNearbyStations(
        location.coords.latitude,
        location.coords.longitude
      );
    }
  };

  const handleStartNavigation = async () => {
    if (!selectedStation || !location) return;

    try {
      setLoading(true);

      // Get actual road route from route planning API
      const originCoords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        address: 'Current Location',
      };

      const destCoords = {
        lat: selectedStation.lat,
        lng: selectedStation.lng,
        address: selectedStation.name,
      };

      const result = await routePlanningApi.planRoute({
        origin: originCoords,
        destination: destCoords,
        travelMode: 'driving',
        fuelType: 'CNG',
      });

      console.log('Route planning result:', result);
      console.log('Polyline from result:', result?.route?.polyline);

      // Decode polyline to get actual route coordinates
      const polylineStr: string = result?.route?.polyline || '';
      console.log('Polyline string:', polylineStr);

      let decoded;
      if (polylineStr) {
        decoded = decodePolyline(polylineStr);
        console.log('Decoded coordinates count:', decoded.length);
        console.log('First coord:', decoded[0]);
        console.log('Last coord:', decoded[decoded.length - 1]);
      } else {
        console.warn('No polyline received from API, using fallback');
        decoded = [
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: selectedStation.lat,
            longitude: selectedStation.lng,
          },
        ];
      }

      setPlannedRouteCoords(decoded);
      setPlannedDestination({
        lat: selectedStation.lat,
        lng: selectedStation.lng,
        label: selectedStation.name,
      });

      setNavigationStation(selectedStation);
      setIsNavigating(true);
      setSelectedStation(null); // Close bottom sheet

      // Fit map to show route
      if (mapRef.current && decoded.length > 0) {
        mapRef.current.fitToCoordinates(decoded, {
          edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to start navigation. Showing direct route.');

      // Fallback to straight line if API fails
      const fallbackRoute = [
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        {
          latitude: selectedStation.lat,
          longitude: selectedStation.lng,
        },
      ];

      setPlannedRouteCoords(fallbackRoute);
      setPlannedDestination({
        lat: selectedStation.lat,
        lng: selectedStation.lng,
        label: selectedStation.name,
      });
      setNavigationStation(selectedStation);
      setIsNavigating(true);
      setSelectedStation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEndNavigation = () => {
    setIsNavigating(false);
    setNavigationStation(null);
    setPlannedRouteCoords([]);
    setPlannedDestination(null);
  };

  // YouTube-style spinner animation
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading && !region) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [loading, region]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading && !region) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Image
            source={require('../assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png')}
            style={styles.loadingLogo}
            resizeMode="cover"
          />
          <Text style={styles.loadingTitle}>CNG Bharat</Text>

          {/* YouTube-style circular spinner */}
          <View style={styles.spinnerContainer}>
            <Animated.View
              style={[
                styles.spinner,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <View style={styles.spinnerArc} />
            </Animated.View>
          </View>

          <Text style={styles.loadingText}>Finding your location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map View */}
      {region && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          showsPointsOfInterest={false}
          showsBuildings={false}
          customMapStyle={LIGHT_MAP_STYLE}
          loadingEnabled
          toolbarEnabled={false}
        >
          {plannedRouteCoords.length > 0 && (
            <Polyline coordinates={plannedRouteCoords} strokeColor={colors.primary} strokeWidth={5} />
          )}

          {plannedDestination && (
            <Marker
              anchor={{ x: 0.5, y: 1 }}
              coordinate={{ latitude: plannedDestination.lat, longitude: plannedDestination.lng }}
              title={plannedDestination.label}
            >
              <View style={styles.pinWrapper}>
                <View style={[styles.pinHead, styles.pinHeadDestination]}>
                  <View style={styles.pinInner}>
                    <Ionicons name="location" size={18} color={colors.danger} />
                  </View>
                </View>
                <View style={[styles.pinTail, styles.pinTailDestination]} />
              </View>
            </Marker>
          )}

          {getDisplayedStations().map((station) => (
            <Marker
              key={station.id}
              anchor={{ x: 0.5, y: 1 }}
              coordinate={{
                latitude: station.lat,
                longitude: station.lng,
              }}
              title={station.name}
              description={station.address}
              onPress={() => handleMarkerPress(station)}
            >
              <View style={[styles.pinWrapper, { transform: [{ scale: getMarkerVisual(station.id).scale }] }]}>
                <View style={[styles.pinHead, { backgroundColor: getMarkerVisual(station.id).pin }]}>
                  <View style={styles.pinInner}>
                    <MaterialCommunityIcons name="gas-station" size={18} color={getMarkerVisual(station.id).pin} />
                  </View>
                </View>
                <View style={[styles.pinTail, { backgroundColor: getMarkerVisual(station.id).pin }]} />
              </View>
            </Marker>
          ))}
        </MapView>
      )}


      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.logoRow}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/Gemini_Generated_Image_6b1drx6b1drx6b1d.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appTitle}>CNG Bharat</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBar, styles.searchBarFlex]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for CNG station or place..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.profileIconButton}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person-circle-outline" size={30} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* My Location Button */}
      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={handleMyLocation}
      >
        <Ionicons name="locate" size={24} color={colors.primary} />
      </TouchableOpacity>

      {/* Voice Search Button */}
      <TouchableOpacity
        style={styles.voiceButton}
        onPress={() => navigation.navigate('VoiceSearch')}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Route Planner Button */}
      <TouchableOpacity
        style={styles.routePlanButton}
        onPress={() => setShowRoutePlanModal(true)}
      >
        <MaterialCommunityIcons name="routes" size={24} color="#fff" />
      </TouchableOpacity>


      {/* Station Details Bottom Sheet */}
      {selectedStation && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedStation(null)}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={styles.stationName}>{selectedStation.name}</Text>
              {selectedStation.isPartner && (
                <View style={styles.partnerBadge}>
                  <Text style={styles.partnerBadgeText}>Partner</Text>
                </View>
              )}
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                {selectedStation.address}, {selectedStation.city}
              </Text>
            </View>

            {selectedStation.phone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>{selectedStation.phone}</Text>
              </View>
            )}

            {selectedStation.openingHours && (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>{selectedStation.openingHours}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="gas-cylinder" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>CNG Status:</Text>
              <View
                style={[
                  styles.cngStatusBadge,
                  {
                    backgroundColor:
                      selectedStation.cngAvailable === false
                        ? colors.danger
                        : selectedStation.cngAvailable === true
                          ? colors.accent
                          : colors.secondary,
                  },
                ]}
              >
                <Text style={styles.cngStatusText}>
                  {selectedStation.cngAvailable === false
                    ? 'Unavailable'
                    : selectedStation.cngAvailable === true
                      ? 'Available'
                      : 'Unknown'}
                  {selectedStation.cngAvailable === true &&
                    typeof selectedStation.cngQuantityKg === 'number'
                    ? ` (${selectedStation.cngQuantityKg} kg)`
                    : ''}
                </Text>
              </View>
            </View>

            <View style={styles.fuelTypes}>
              <Text style={styles.fuelTypeLabel}>Available Fuel:</Text>
              <Text style={styles.fuelTypeText}>{selectedStation.fuelTypes}</Text>
            </View>

            <TouchableOpacity
              style={styles.navigationButton}
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.navigationButtonText}>Start Navigation</Text>
            </TouchableOpacity>
          </View>
        </View>
      )
      }

      {/* Loading Overlay */}
      {
        loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )
      }

      {/* TODO: RoutePlanModal component needs to be created
      <RoutePlanModal
        visible={showRoutePlanModal}
        onClose={() => {
          setShowRoutePlanModal(false);
          setShowStartingSuggestions(false);
          setShowDestinationSuggestions(false);
        }}
        travelMode={travelMode}
        setTravelMode={setTravelMode}
        startingPoint={startingPoint}
        setStartingPoint={setStartingPoint}
        destination={destination}
        setDestination={setDestination}
        onSearchStartingPoint={onSearchStartingPoint}
        onSearchDestination={onSearchDestination}
        startingSuggestions={startingSuggestions}
        showStartingSuggestions={showStartingSuggestions}
        destinationSuggestions={destinationSuggestions}
        showDestinationSuggestions={showDestinationSuggestions}
        onSelectStartingSuggestion={onSelectStartingSuggestion}
        onSelectDestinationSuggestion={onSelectDestinationSuggestion}
        onSwap={onSwapRoutePoints}
        onStartNavigation={onStartRouteNavigation}
        destinationCoords={destinationCoords}
      />
      */}


      {/* Navigation Panel - Shows when navigating - MUST BE LAST TO APPEAR ON TOP */}
      {isNavigating && navigationStation && (
        <View style={styles.navigationPanel}>
          <View style={styles.navigationHeader}>
            <View style={styles.navigationInfo}>
              <Ionicons name="navigate" size={24} color={colors.primary} />
              <View style={styles.navigationTextContainer}>
                <Text style={styles.navigationTitle}>Navigating to</Text>
                <Text style={styles.navigationDestination}>{navigationStation.name}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.endNavigationButton}
              onPress={handleEndNavigation}
            >
              <Ionicons name="close-circle" size={28} color="#fff" />
              <Text style={styles.endNavigationText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  searchBarFlex: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  profileIconButton: {
    backgroundColor: '#fff',
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  // ...
  myLocationButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 240,
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
  // ...
  voiceButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 180,
    backgroundColor: colors.primary,
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
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 10,
  },
  pinHead: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTail: {
    width: 14,
    height: 14,
    marginTop: -6,
    transform: [{ rotate: '45deg' }],
    borderBottomRightRadius: 3,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinHeadDestination: {
    backgroundColor: colors.danger,
  },
  pinTailDestination: {
    backgroundColor: colors.danger,
  },
  routePlanButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 120,
    backgroundColor: colors.accent,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 50,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  sheetContent: {
    padding: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  partnerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  partnerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  cngStatusBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cngStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fuelTypes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  fuelTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  fuelTypeText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationPanel: {
    position: 'absolute',
    bottom: spacing.xl + 20,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    zIndex: 1000,
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navigationTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  navigationTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  navigationDestination: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  endNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  endNavigationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#10B981',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  spinnerContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  spinner: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerArc: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: '#E5E7EB',
    borderTopColor: '#10B981',
    borderRightColor: '#10B981',
  },
});
