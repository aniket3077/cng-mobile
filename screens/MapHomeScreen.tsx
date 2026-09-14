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
  ScrollView,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { placesApi, routePlanningApi, stationsApi, nearbyStationsApi, customerProfileApi } from '../lib/api';
import { authStorage } from '../lib/auth';
import RoutePlanModal from '../components/RoutePlanModal';
import { logger } from '../lib/logger';
import { colors, spacing } from '../theme';
import { AppScreenProps } from '../types/navigation';
import { decodePolyline } from '../utils/mapHelpers';
import { LIGHT_MAP_STYLE } from '../utils/mapStyle';
import { isLikelyCngStation, hasCngFuel } from '../utils/cngDetector';

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
  rating?: number;
  totalReviews?: number;
  cngAvailable?: boolean;
  cngQuantityKg?: number | null;
  cngStatusUpdatedAt?: string | null;
  cngStatusUpdatedBy?: string | null;
  cngPressure?: string | null;
  cngPressureUpdatedAt?: string | null;
  cngPressureUpdatedBy?: string | null;
  crowdLevel?: 'low' | 'medium' | 'high';
  crowdCount?: number;
  estimatedWaitTime?: number;
  crowdUpdatedAt?: string | null;
  crowdUpdatedBy?: string | null;
}

const formatUpdatedTime = (dateString?: string | null) => {
  if (!dateString) {
    return { timeStr: 'Not updated yet', relativeStr: '' };
  }
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      return { timeStr: 'Not updated yet', relativeStr: '' };
    }

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const timeStr = `${hoursStr}:${minutes} ${ampm} ${day}/${month}/${year}`;

    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relativeStr = '';
    if (diffMins < 1) {
      relativeStr = '(Just now)';
    } else if (diffMins < 60) {
      relativeStr = `(${diffMins} min${diffMins > 1 ? 's' : ''} ago)`;
    } else if (diffHours < 24) {
      relativeStr = `(${diffHours} hr${diffHours > 1 ? 's' : ''} ago)`;
    } else {
      relativeStr = `(${diffDays} day${diffDays > 1 ? 's' : ''} ago)`;
    }

    return { timeStr, relativeStr };
  } catch {
    return { timeStr: 'Recently', relativeStr: '' };
  }
};

const normalizeGoogleNearbyStations = (items: any[]): Station[] => {
  return items
    .filter((item: any) => {
      // Must have valid coordinates
      if (typeof item.coordinates?.lat !== 'number' || typeof item.coordinates?.lng !== 'number') {
        return false;
      }
      // Must be a verified/likely CNG station, filtering out pure petrol/diesel pumps
      return isLikelyCngStation(item.name, item.address);
    })
    .map((item: any) => ({
      id: item.placeId || `${item.coordinates?.lat}-${item.coordinates?.lng}`,
      name: item.name || 'CNG Station',
      address: item.address || '',
      city: '',
      state: '',
      lat: item.coordinates?.lat,
      lng: item.coordinates?.lng,
      fuelTypes: item.fuelTypes || 'CNG',
      isPartner: false,
      cngAvailable: item.openNow ?? undefined,
    }));
};

type Props = AppScreenProps<'MapHome'>;

export default function MapHomeScreen({ navigation, route }: Props) {
  const SHOW_ONLY_GOOGLE = false; // Disabled Google Maps for available CNG stations
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [isMapReady, setIsMapReady] = useState(false);

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
  const [updatingField, setUpdatingField] = useState<'status' | 'pressure' | 'crowd' | null>(null);

  const handleUpdateStatus = async (available: boolean) => {
    if (!selectedStation) return;

    try {
      setUpdatingField('status');
      const user = await authStorage.getUser();
      const userName = user?.name || user?.email?.split('@')[0] || 'You';
      const nowIso = new Date().toISOString();

      const updatedStation: Station = {
        ...selectedStation,
        cngAvailable: available,
        cngStatusUpdatedAt: nowIso,
        cngStatusUpdatedBy: userName,
      };

      setSelectedStation(updatedStation);
      setStations((prev) =>
        prev.map((s) => (s.id === selectedStation.id ? { ...s, ...updatedStation } : s))
      );
      setAllStations((prev) =>
        prev.map((s) => (s.id === selectedStation.id ? { ...s, ...updatedStation } : s))
      );

      await stationsApi.updateStatus(selectedStation.id, {
        cngAvailable: available,
        stationName: selectedStation.name,
        address: selectedStation.address,
        city: selectedStation.city,
        state: selectedStation.state,
        lat: selectedStation.lat,
        lng: selectedStation.lng,
      });

      Alert.alert(
        'Status Updated',
        `Station marked as ${available ? 'Available' : 'Not Available'}. Thank you!`
      );
    } catch (error) {
      logger.warn('Failed to update station status', error);
      Alert.alert('Notice', 'Status updated locally. Please login to sync community updates.');
    } finally {
      setUpdatingField(null);
    }
  };

  const handleUpdatePressure = async (pressure: string) => {
    if (!selectedStation) return;

    try {
      setUpdatingField('pressure');
      const user = await authStorage.getUser();
      const userName = user?.name || user?.email?.split('@')[0] || 'You';
      const nowIso = new Date().toISOString();

      const updatedStation: Station = {
        ...selectedStation,
        cngPressure: pressure,
        cngPressureUpdatedAt: nowIso,
        cngPressureUpdatedBy: userName,
      };

      setSelectedStation(updatedStation);
      setStations((prev) =>
        prev.map((s) => (s.id === selectedStation.id ? { ...s, ...updatedStation } : s))
      );
      setAllStations((prev) =>
        prev.map((s) => (s.id === selectedStation.id ? { ...s, ...updatedStation } : s))
      );

      await stationsApi.updatePressure(selectedStation.id, {
        cngPressure: pressure,
        stationName: selectedStation.name,
        address: selectedStation.address,
        city: selectedStation.city,
        state: selectedStation.state,
        lat: selectedStation.lat,
        lng: selectedStation.lng,
      });

      Alert.alert('Pressure Updated', `Dispenser pressure updated to ${pressure}. Thank you!`);
    } catch (error) {
      logger.warn('Failed to update station pressure', error);
      Alert.alert('Notice', 'Pressure updated locally. Please login to sync community updates.');
    } finally {
      setUpdatingField(null);
    }
  };

  const handleUpdateCrowd = async (level: 'low' | 'medium' | 'high') => {
    if (!selectedStation) return;

    try {
      setUpdatingField('crowd');
      const user = await authStorage.getUser();
      const userName = user?.name || user?.email?.split('@')[0] || 'You';
      const nowIso = new Date().toISOString();

      const waitTimeMap: Record<'low' | 'medium' | 'high', number> = {
        low: 5,
        medium: 15,
        high: 30,
      };

      const updatedStation: Station = {
        ...selectedStation,
        crowdLevel: level,
        estimatedWaitTime: waitTimeMap[level],
        crowdUpdatedAt: nowIso,
        crowdUpdatedBy: userName,
      };

      setSelectedStation(updatedStation);
      setStations((prev) =>
        prev.map((s) => (s.id === selectedStation.id ? { ...s, ...updatedStation } : s))
      );
      setAllStations((prev) =>
        prev.map((s) => (s.id === selectedStation.id ? { ...s, ...updatedStation } : s))
      );

      await stationsApi.updateCrowd(selectedStation.id, {
        crowdLevel: level,
        stationName: selectedStation.name,
        address: selectedStation.address,
        city: selectedStation.city,
        state: selectedStation.state,
        lat: selectedStation.lat,
        lng: selectedStation.lng,
      });

      Alert.alert(
        'Crowd Status Updated',
        `Crowd level marked as ${level.toUpperCase()} (~${waitTimeMap[level]} min wait). Thank you!`
      );
    } catch (error) {
      logger.warn('Failed to update crowd level', error);
      Alert.alert('Notice', 'Crowd updated locally. Please login to sync community updates.');
    } finally {
      setUpdatingField(null);
    }
  };

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkSubscriptionStatus();

      // Handle incoming navigation requests (e.g. from Voice Search)
      if (route?.params?.targetStation) {
        const target = route.params.targetStation;
        setSelectedStation(target);

        // Center map
        if (mapRef.current && isMapReady) {
          mapRef.current.animateToRegion({
            latitude: target.lat,
            longitude: target.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        }

        // If auto-navigation requested
        if (route.params.autoNavigate) {
          // We need a slight delay to let state update or just call a modified function
          // Since handleStartNavigation relies on state, we might need to pass params to it or use a separate effect.
          // For now, let's just create a dedicated effect or helper.
          initiateRouteToStation(target);
        }

        // Clear params to prevent re-running
        navigation.setParams({ targetStation: null, autoNavigate: null });
      }
    });

    checkSubscriptionStatus();
    requestLocationPermission();
    loadProfileImage();

    return unsubscribe;
  }, [navigation, route?.params]); // Trigger when params change

  // Helper to start navigation to a specific station (bypassing selectedStation state reliance if needed)
  const initiateRouteToStation = async (station: Station) => {
    // Wait for location if not ready
    if (!location) {
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      executeNavigation(loc, station);
    } else {
      executeNavigation(location, station);
    }
  };

  const executeNavigation = async (originLoc: Location.LocationObject, targetStation: Station) => {
    // Re-use logic from handleStartNavigation but with explicit params
    if (!checkFeatureAccess()) return;

    try {
      setLoading(true);
      const originCoords = {
        lat: originLoc.coords.latitude,
        lng: originLoc.coords.longitude,
        address: 'Current Location',
      };
      const destCoords = {
        lat: targetStation.lat,
        lng: targetStation.lng,
        address: targetStation.name,
      };

      const result = await routePlanningApi.planRoute({
        origin: originCoords,
        destination: destCoords,
        travelMode: 'driving',
        fuelType: 'CNG',
      });

      const decoded = await getRouteCoordinatesFromApi(
        originCoords,
        destCoords,
        result?.route?.polyline || ''
      );

      setPlannedRouteCoords(decoded);
      setPlannedDestination({
        lat: targetStation.lat,
        lng: targetStation.lng,
        label: targetStation.name,
      });

      setNavigationStation(targetStation);
      setIsNavigating(true);
      setSelectedStation(null);

      if (mapRef.current && decoded.length > 0 && isMapReady) {
        mapRef.current.fitToCoordinates(decoded, {
          edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
          animated: true,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate route.');
    } finally {
      setLoading(false);
    }
  };

  const [isSubscribed, setIsSubscribed] = useState(false);

  const checkSubscriptionStatus = async () => {
    try {
      const subscriptionStatus = await customerProfileApi.getSubscriptionStatus();
      setIsSubscribed(Boolean(subscriptionStatus?.subscription?.isActive));
    } catch (_error) {
      // Default to false on error to be safe, or true if benevolent. Safe is false.
      setIsSubscribed(false);
    }
  };

  const checkFeatureAccess = () => {
    if (!isSubscribed) {
      Alert.alert(
        'Subscription Required',
        'You need an active subscription to use navigation features.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => navigation.navigate('Subscription')
          }
        ]
      );
      return false;
    }
    return true;
  };

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
    } catch (_error) {
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
    } catch (_error) {}
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
    setStartingPoint(prediction.mainText || prediction.description || '');
    setShowStartingSuggestions(false);
    try {
      const details = await placesApi.getDetails(prediction.placeId);
      const loc = details?.place?.location;
      if (loc?.lat != null && loc?.lng != null) {
        setStartingCoords({ lat: loc.lat, lng: loc.lng });
      }
    } catch (_error) {
      Alert.alert('Location unavailable', 'We could not load that starting point.');
    }
  };

  const onSelectDestinationSuggestion = async (prediction: any) => {
    setDestination(prediction.mainText || prediction.description || '');
    setShowDestinationSuggestions(false);
    try {
      const details = await placesApi.getDetails(prediction.placeId);
      const loc = details?.place?.location;
      if (loc?.lat != null && loc?.lng != null) {
        setDestinationCoords({ lat: loc.lat, lng: loc.lng });
      }
    } catch (_error) {
      Alert.alert('Location unavailable', 'We could not load that destination.');
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
    if (!checkFeatureAccess()) return;

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

        if (mapRef.current && decoded.length > 0 && isMapReady) {
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

  const getCrowdIndicator = (crowdLevel?: string) => {
    switch (crowdLevel) {
      case 'low':
        return { color: '#10B981', icon: 'checkmark-circle', label: 'Not Busy' };
      case 'high':
        return { color: '#EF4444', icon: 'alert-circle', label: 'Very Busy' };
      case 'medium':
      default:
        return { color: '#F59E0B', icon: 'information-circle', label: 'Moderate' };
    }
  };

  const fetchNearbyStations = async (lat: number, lng: number, radius: number = 10) => {
    try {
      setLoading(true);

      // Fetch Google Nearby Stations and local Database Stations in parallel
      const [googleResponse, databaseResponse] = await Promise.allSettled([
        nearbyStationsApi.list({
          lat,
          lng,
          radius: Math.round(radius * 1000),
          limit: 60,
          googleOnly: SHOW_ONLY_GOOGLE,
        }),
        stationsApi.list({
          lat,
          lng,
          radius,
          fuelType: 'CNG',
        })
      ]);

      let googleStations: Station[] = [];
      if (googleResponse.status === 'fulfilled') {
        googleStations = normalizeGoogleNearbyStations(googleResponse.value?.stations || []);
      } else {
        logger.warn('Google Places nearby lookup failed', googleResponse.reason);
      }

      let databaseStations: Station[] = [];
      if (databaseResponse.status === 'fulfilled') {
        databaseStations = databaseResponse.value?.stations || [];
      } else {
        logger.warn('Database local station lookup failed', databaseResponse.reason);
      }

      // Merge Google stations and local database stations
      // Prioritize database stations since they contain rich custom details (partner status, cngQuantityKg, crowd level)
      const mergedMap = new Map<string, Station>();

      // Add database stations first
      databaseStations.forEach((station) => {
        const key = `${station.lat.toFixed(4)}_${station.lng.toFixed(4)}`;
        mergedMap.set(key, station);
      });

      // Add google stations only if no database station exists at the same approximate location
      if (!SHOW_ONLY_GOOGLE) {
        googleStations.forEach((station) => {
          const key = `${station.lat.toFixed(4)}_${station.lng.toFixed(4)}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, station);
          }
        });
      } else {
        // If show only google requested, only keep google stations
        mergedMap.clear();
        googleStations.forEach((station) => {
          const key = `${station.lat.toFixed(4)}_${station.lng.toFixed(4)}`;
          mergedMap.set(key, station);
        });
      }

      const nextStations = Array.from(mergedMap.values());
      setAllStations(nextStations);
      setStations(nextStations);
    } catch (error: any) {
      logger.warn('Fetch nearby stations master process failed', error);
      Alert.alert('Error', 'Failed to fetch nearby stations');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchSuggestions([]);
    setShowSearchSuggestions(false);
    setStations(allStations);
  };

  const handleSearchTextChange = (text: string) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!text.trim() || text.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      setStations(allStations);
      return;
    }

    setShowSearchSuggestions(true);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        // 1. Check local stations matching
        const localMatches = allStations
          .filter(
            (s) =>
              s.name.toLowerCase().includes(text.toLowerCase()) ||
              s.city.toLowerCase().includes(text.toLowerCase()) ||
              s.address.toLowerCase().includes(text.toLowerCase())
          )
          .slice(0, 3)
          .map((s) => ({
            id: s.id,
            place_id: s.id,
            isLocalStation: true,
            stationData: s,
            description: `${s.name}, ${s.address || s.city}`,
            structured_formatting: {
              main_text: s.name,
              secondary_text: s.address || s.city,
            },
          }));

        // 2. Google Places predictions
        const predictions = await searchPlaces(text.trim());
        const googleMatches = (predictions || []).slice(0, 5).map((p: any) => ({
          ...p,
          isLocalStation: false,
        }));

        setSearchSuggestions([...localMatches, ...googleMatches]);
      } catch (error) {
        logger.warn('Search autocomplete error', error);
      }
    }, 300);
  };

  const handleSelectSearchSuggestion = async (suggestion: any) => {
    Keyboard.dismiss();
    setShowSearchSuggestions(false);
    setSearchQuery(suggestion.structured_formatting?.main_text || suggestion.description || '');

    if (suggestion.isLocalStation && suggestion.stationData) {
      const s = suggestion.stationData;
      setSelectedStation(s);
      if (mapRef.current && isMapReady) {
        mapRef.current.animateToRegion({
          latitude: s.lat,
          longitude: s.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
      return;
    }

    // Google Place suggestion
    try {
      setLoading(true);
      const details = await placesApi.getDetails(suggestion.place_id);
      const coords = details?.location;

      if (coords?.lat && coords?.lng) {
        const isCng = isLikelyCngStation(suggestion.description || '', '');

        if (mapRef.current && isMapReady) {
          mapRef.current.animateToRegion({
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }

        // Fetch stations around this searched location
        await fetchNearbyStations(coords.lat, coords.lng, 15);

        if (isCng) {
          setSelectedStation({
            id: suggestion.place_id,
            name:
              suggestion.structured_formatting?.main_text ||
              suggestion.description ||
              'CNG Station',
            address: details.formattedAddress || suggestion.description || '',
            city: '',
            state: '',
            lat: coords.lat,
            lng: coords.lng,
            fuelTypes: 'CNG',
            isPartner: false,
            cngAvailable: true,
          });
        }
      }
    } catch (e) {
      logger.warn('Failed to get place details', e);
      Alert.alert('Search Error', 'Could not locate the selected place');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Enter Search Query', 'Please enter a location or station name');
      return;
    }

    Keyboard.dismiss();
    setShowSearchSuggestions(false);

    // 1. Check local stations
    const filtered = allStations.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length > 0) {
      setStations(filtered);
      const station = filtered[0];
      setSelectedStation(station);
      if (mapRef.current && isMapReady) {
        mapRef.current.animateToRegion({
          latitude: station.lat,
          longitude: station.lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        });
      }
      return;
    }

    // 2. Search via Google Places
    try {
      setLoading(true);
      const predictions = await searchPlaces(searchQuery.trim());
      if (predictions && predictions.length > 0) {
        const topResult = predictions[0];
        const details = await placesApi.getDetails(topResult.place_id);
        const coords = details?.location;

        if (coords?.lat && coords?.lng) {
          if (mapRef.current && isMapReady) {
            mapRef.current.animateToRegion({
              latitude: coords.lat,
              longitude: coords.lng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
          }

          await fetchNearbyStations(coords.lat, coords.lng, 15);
          return;
        }
      }

      Alert.alert('No Results', 'No stations or places found matching your search');
    } catch (e) {
      logger.warn('Search failed', e);
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = (station: Station) => {
    setSelectedStation(station);

    // Center map on selected station
    if (mapRef.current && isMapReady) {
      mapRef.current.animateToRegion({
        latitude: station.lat,
        longitude: station.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const handleMyLocation = () => {
    if (location && mapRef.current && isMapReady) {
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
    if (!checkFeatureAccess()) return;

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

      const decoded = await getRouteCoordinatesFromApi(
        originCoords,
        destCoords,
        result?.route?.polyline || ''
      );

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
      if (mapRef.current && decoded.length > 0 && isMapReady) {
        mapRef.current.fitToCoordinates(decoded, {
          edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
          animated: true,
        });
      }
    } catch (_error) {
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

  const getRouteCoordinatesFromApi = async (
    originCoords: { lat: number; lng: number },
    destinationCoords: { lat: number; lng: number },
    routePolyline: string
  ) => {
    if (routePolyline) {
      const decoded = decodePolyline(routePolyline);
      if (decoded.length >= 2) {
        return decoded;
      }
    }

    return [
      { latitude: originCoords.lat, longitude: originCoords.lng },
      { latitude: destinationCoords.lat, longitude: destinationCoords.lng },
    ];
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
          mapType={mapType}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          showsPointsOfInterests={false}
          showsBuildings={true}
          customMapStyle={mapType === 'standard' ? LIGHT_MAP_STYLE : undefined}
          loadingEnabled
          toolbarEnabled={false}
          onMapReady={() => setIsMapReady(true)}
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

          {getDisplayedStations().map((station) => {
            const crowdIndicator = getCrowdIndicator(station.crowdLevel);
            return (
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
                  
                  {/* Crowd Badge */}
                  {station.crowdLevel && (
                    <View style={[styles.crowdBadge, { backgroundColor: crowdIndicator.color }]}>
                      <Ionicons name={crowdIndicator.icon as any} size={12} color="#fff" />
                    </View>
                  )}
                </View>
              </Marker>
            );
          })}
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
              onChangeText={handleSearchTextChange}
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

        {/* Live Search Suggestions Dropdown */}
        {showSearchSuggestions && searchSuggestions.length > 0 && (
          <View style={styles.suggestionsDropdown}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              style={{ maxHeight: 240 }}
            >
              {searchSuggestions.map((item, index) => (
                <TouchableOpacity
                  key={`${item.place_id || item.id || index}`}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSearchSuggestion(item)}
                >
                  <View style={styles.suggestionIconContainer}>
                    {item.isLocalStation ? (
                      <MaterialCommunityIcons name="gas-station" size={20} color={colors.primary} />
                    ) : (
                      <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                      {item.structured_formatting?.main_text || item.description || ''}
                    </Text>
                    {item.structured_formatting?.secondary_text ? (
                      <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                        {item.structured_formatting.secondary_text}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Map Layer Button */}
      <TouchableOpacity
        style={styles.mapLayerButton}
        onPress={() => setMapType(prev => prev === 'standard' ? 'satellite' : 'standard')}
      >
        <Ionicons name={mapType === 'standard' ? "layers" : "map"} size={24} color={colors.primary} />
      </TouchableOpacity>

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
        onPress={() => {
          if (checkFeatureAccess()) {
            navigation.navigate('VoiceSearch');
          }
        }}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Route Planner Button */}
      <TouchableOpacity
        style={styles.routePlanButton}
        onPress={() => {
          if (checkFeatureAccess()) {
            setShowRoutePlanModal(true);
          }
        }}
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

          <ScrollView
            style={styles.sheetScrollView}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Station Title */}
            <View style={styles.sheetHeader}>
              <Text style={styles.stationName}>{selectedStation.name}</Text>
              {selectedStation.isPartner && (
                <View style={styles.partnerBadge}>
                  <Text style={styles.partnerBadgeText}>Partner</Text>
                </View>
              )}
            </View>

            {/* Rating & Reviews */}
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {selectedStation.rating ? selectedStation.rating.toFixed(1) : '4.5'}{' '}
                {selectedStation.totalReviews && selectedStation.totalReviews > 0
                  ? `${selectedStation.totalReviews} Reviews`
                  : 'No Reviews Yet'}
              </Text>
            </View>

            {/* Address */}
            <View style={styles.addressRow}>
              <Ionicons name="location-sharp" size={16} color="#6B7280" />
              <Text style={styles.addressText}>
                {selectedStation.address || 'Address not available'}
                {selectedStation.city ? `, ${selectedStation.city}` : ''}
              </Text>
            </View>

            {/* Gas Status & Pressure summary tags */}
            <View style={styles.summaryTagRow}>
              <View style={styles.summaryTag}>
                <MaterialCommunityIcons
                  name="gas-station"
                  size={16}
                  color={selectedStation.cngAvailable === false ? '#EF4444' : '#10B981'}
                />
                <Text
                  style={[
                    styles.summaryTagText,
                    { color: selectedStation.cngAvailable === false ? '#EF4444' : '#10B981' },
                  ]}
                >
                  {selectedStation.cngAvailable === false ? 'Gas Unavailable' : 'Gas Available'}
                </Text>
              </View>

              <View style={[styles.summaryTag, { marginLeft: 12 }]}>
                <Ionicons name="speedometer-outline" size={16} color="#6B7280" />
                <Text style={styles.summaryTagTextSecondary}>
                  {selectedStation.cngPressure || '200 - 210'}
                </Text>
              </View>

              <View style={[styles.summaryTag, { marginLeft: 12 }]}>
                <Ionicons
                  name={getCrowdIndicator(selectedStation.crowdLevel).icon as any}
                  size={16}
                  color={getCrowdIndicator(selectedStation.crowdLevel).color}
                />
                <Text
                  style={[
                    styles.summaryTagTextSecondary,
                    { color: getCrowdIndicator(selectedStation.crowdLevel).color },
                  ]}
                >
                  {getCrowdIndicator(selectedStation.crowdLevel).label}
                  {selectedStation.estimatedWaitTime ? ` (~${selectedStation.estimatedWaitTime}m)` : ''}
                </Text>
              </View>
            </View>

            {/* Update Station Status Section */}
            <View style={styles.updateCard}>
              <View style={styles.updateCardHeader}>
                <Text style={styles.updateCardTitle}>Update Station Status</Text>
                <View style={styles.updateCardTimeContainer}>
                  <Text style={styles.updateTimeLabel}>Last Updated At</Text>
                  <Text style={styles.updateTimeValue}>
                    {formatUpdatedTime(selectedStation.cngStatusUpdatedAt).timeStr}
                  </Text>
                  {formatUpdatedTime(selectedStation.cngStatusUpdatedAt).relativeStr ? (
                    <Text style={styles.updateTimeRelative}>
                      {formatUpdatedTime(selectedStation.cngStatusUpdatedAt).relativeStr}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.statusButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    selectedStation.cngAvailable !== false
                      ? styles.statusButtonActive
                      : styles.statusButtonInactive,
                  ]}
                  onPress={() => handleUpdateStatus(true)}
                  disabled={updatingField === 'status'}
                >
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={selectedStation.cngAvailable !== false ? '#FFFFFF' : '#65A30D'}
                  />
                  <Text
                    style={[
                      styles.statusButtonText,
                      selectedStation.cngAvailable !== false
                        ? styles.statusButtonTextActive
                        : styles.statusButtonTextInactive,
                    ]}
                  >
                    Available
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    selectedStation.cngAvailable === false
                      ? styles.statusButtonActive
                      : styles.statusButtonInactive,
                  ]}
                  onPress={() => handleUpdateStatus(false)}
                  disabled={updatingField === 'status'}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={selectedStation.cngAvailable === false ? '#FFFFFF' : '#65A30D'}
                  />
                  <Text
                    style={[
                      styles.statusButtonText,
                      selectedStation.cngAvailable === false
                        ? styles.statusButtonTextActive
                        : styles.statusButtonTextInactive,
                    ]}
                  >
                    Not Available
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.updatedByText}>
                Last Station Status have been updated by{' '}
                <Text style={styles.updatedByHighlight}>
                  {selectedStation.cngStatusUpdatedBy || 'Amit'}
                </Text>
              </Text>
            </View>

            {/* Update Station Pressure Section */}
            <View style={styles.updateCard}>
              <View style={styles.updateCardHeader}>
                <Text style={styles.updateCardTitle}>Update Station Pressure</Text>
                <View style={styles.updateCardTimeContainer}>
                  <Text style={styles.updateTimeLabel}>Last Updated At</Text>
                  <Text style={styles.updateTimeValue}>
                    {formatUpdatedTime(selectedStation.cngPressureUpdatedAt).timeStr}
                  </Text>
                  {formatUpdatedTime(selectedStation.cngPressureUpdatedAt).relativeStr ? (
                    <Text style={styles.updateTimeRelative}>
                      {formatUpdatedTime(selectedStation.cngPressureUpdatedAt).relativeStr}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Pressure Chips Grid */}
              <View style={styles.pressureChipsContainer}>
                {['Low', '180 - 190', '190 - 200', '200 - 210', '210 - 220'].map((val) => {
                  const isSelected = (selectedStation.cngPressure || '200 - 210') === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.pressureChip,
                        isSelected ? styles.pressureChipActive : styles.pressureChipInactive,
                      ]}
                      onPress={() => handleUpdatePressure(val)}
                      disabled={updatingField === 'pressure'}
                    >
                      <Text
                        style={[
                          styles.pressureChipText,
                          isSelected
                            ? styles.pressureChipTextActive
                            : styles.pressureChipTextInactive,
                        ]}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.updatedByText}>
                Last Station Pressure have been updated by{' '}
                <Text style={styles.updatedByHighlight}>
                  {selectedStation.cngPressureUpdatedBy || 'cngnav'}
                </Text>
              </Text>
            </View>

            {/* Update Station Crowd Level Section */}
            <View style={styles.updateCard}>
              <View style={styles.updateCardHeader}>
                <Text style={styles.updateCardTitle}>Update Station Crowd</Text>
                <View style={styles.updateCardTimeContainer}>
                  <Text style={styles.updateTimeLabel}>Last Updated At</Text>
                  <Text style={styles.updateTimeValue}>
                    {formatUpdatedTime(selectedStation.crowdUpdatedAt).timeStr}
                  </Text>
                  {formatUpdatedTime(selectedStation.crowdUpdatedAt).relativeStr ? (
                    <Text style={styles.updateTimeRelative}>
                      {formatUpdatedTime(selectedStation.crowdUpdatedAt).relativeStr}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Crowd Buttons */}
              <View style={styles.crowdButtonsRow}>
                {[
                  { level: 'low', label: 'Low', wait: '~5 min', color: '#10B981', icon: 'checkmark-circle' },
                  { level: 'medium', label: 'Moderate', wait: '~15 min', color: '#F59E0B', icon: 'information-circle' },
                  { level: 'high', label: 'Heavy', wait: '~30 min', color: '#EF4444', icon: 'alert-circle' },
                ].map((item) => {
                  const isSelected = (selectedStation.crowdLevel || 'low') === item.level;
                  return (
                    <TouchableOpacity
                      key={item.level}
                      style={[
                        styles.crowdButton,
                        isSelected
                          ? { backgroundColor: item.color, borderColor: item.color }
                          : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
                      ]}
                      onPress={() => handleUpdateCrowd(item.level as any)}
                      disabled={updatingField === 'crowd'}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? '#FFFFFF' : item.color}
                      />
                      <Text
                        style={[
                          styles.crowdButtonText,
                          { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.crowdButtonWaitText,
                          { color: isSelected ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
                        ]}
                      >
                        {item.wait}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.updatedByText}>
                Last Station Crowd have been updated by{' '}
                <Text style={styles.updatedByHighlight}>
                  {selectedStation.crowdUpdatedBy || 'Amit'}
                </Text>
              </Text>
            </View>

            {/* NAVIGATE BUTTON */}
            <TouchableOpacity
              style={styles.navigateActionButton}
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.navigateActionText}>NAVIGATE</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Loading Overlay */}
      {
        loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )
      }

      {/* Route Plan Modal */}
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
  suggestionsDropdown: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionIconContainer: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  suggestionSecondaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mapLayerButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 300,
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
    position: 'relative',
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
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 12,
    maxHeight: '75%',
  },
  sheetScrollView: {
    maxHeight: 520,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: 30,
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
    marginLeft: spacing.sm,
  },
  partnerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
    lineHeight: 18,
  },
  summaryTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryTagTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  updateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  updateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  updateCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  updateCardTimeContainer: {
    alignItems: 'flex-end',
  },
  updateTimeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  updateTimeValue: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  updateTimeRelative: {
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 6,
  },
  statusButtonActive: {
    backgroundColor: '#70B85E',
    borderColor: '#70B85E',
  },
  statusButtonInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#70B85E',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  statusButtonTextInactive: {
    color: '#70B85E',
  },
  pressureChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pressureChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressureChipActive: {
    backgroundColor: '#70B85E',
    borderColor: '#70B85E',
  },
  pressureChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#70B85E',
  },
  pressureChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressureChipTextActive: {
    color: '#FFFFFF',
  },
  pressureChipTextInactive: {
    color: '#70B85E',
  },
  crowdButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  crowdButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  crowdButtonText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  crowdButtonWaitText: {
    fontSize: 10,
    fontWeight: '500',
  },
  updatedByText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  updatedByHighlight: {
    color: '#2B80B9',
    fontWeight: '700',
  },
  navigateActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#70B85E',
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  navigateActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
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
  crowdBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 8,
  },
  crowdDetailRow: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  crowdLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  crowdLevelIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  crowdCountText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  estimatedWaitText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: spacing.sm,
    fontWeight: '600',
    marginTop: 4,
  },
});
