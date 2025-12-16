import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { EvilIcons, Entypo, MaterialCommunityIcons } from '@expo/vector-icons';
import { suggestPumpsApi, routePlanningApi, placesApi } from '../lib/api';
import { StationSuggestion } from '../types';

const { width, height } = Dimensions.get('window');

interface Props {
  navigation: any;
}

export default function CreateOrderScreen({ navigation }: Props) {
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stationsAlongRoute, setStationsAlongRoute] = useState<StationSuggestion[]>([]);
  const [allStations, setAllStations] = useState<StationSuggestion[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState<'CNG'>('CNG');
  const [showRoutePlanModal, setShowRoutePlanModal] = useState(false);
  const [startingPoint, setStartingPoint] = useState('Your location');
  const [travelMode, setTravelMode] = useState<'driving' | 'motorcycle' | 'transit' | 'walking' | 'bicycling'>('driving');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStations, setLoadingStations] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{latitude: number; longitude: number}>>([]);
  const [startingPointCoords, setStartingPointCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeSummary, setRouteSummary] = useState<{distance: string; duration: string} | null>(null);
  const [destinationSuggestions, setDestinationSuggestions] = useState<any[]>([]);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [startingSuggestions, setStartingSuggestions] = useState<any[]>([]);
  const [showStartingSuggestions, setShowStartingSuggestions] = useState(false);
  const mapRef = useRef<MapView>(null);
  const destinationSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getCurrentLocation();
    fetchAllStations();
    
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for loading
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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

    // Simulate initial loading
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, []);

  const fetchAllStations = async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      console.log('🔍 Fetching stations from:', `${apiUrl}/api/stations`);
      
      const response = await fetch(`${apiUrl}/api/stations`);
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Total stations received:', data.stations?.length || 0);
        
        // Filter only approved CNG stations
        const activeStations = data.stations
          .filter((station: any) => {
            const isApproved = station.approvalStatus === 'approved';
            const hasCNG = station.fuelTypes?.includes('CNG');
            console.log(`Station: ${station.name}, Approved: ${isApproved}, Has CNG: ${hasCNG}, Lat: ${station.lat}, Lng: ${station.lng}`);
            return isApproved && hasCNG;
          })
          .map((station: any) => ({
            station: {
              id: station.id,
              name: station.name,
              address: station.address,
              city: station.city,
              state: station.state,
              lat: parseFloat(station.lat),
              lng: parseFloat(station.lng),
              fuelTypes: station.fuelTypes,
              phone: station.phone,
              openingHours: station.openingHours,
              cngAvailable: station.cngAvailable || 0,
            },
            distance: 0,
            score: 0,
            reason: 'Active CNG Station',
          }));
        
        console.log(`✅ Loaded ${activeStations.length} CNG stations for map display`);
        console.log('Stations:', activeStations.map(s => ({ name: s.station.name, lat: s.station.lat, lng: s.station.lng })));
        setAllStations(activeStations);
      } else {
        console.error('❌ Failed to fetch stations:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching stations:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (error) {
      console.error('Location error:', error);
      setIsLoading(false);
    }
  };

  const centerToUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    }
  };

  const zoomIn = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 300);
    }
  };

  const zoomOut = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      }, 300);
    }
  };

  const getDirections = async (start: {lat: number; lng: number}, end: {lat: number; lng: number}) => {
    try {
      const origin = `${start.lat},${start.lng}`;
      const destination = `${end.lat},${end.lng}`;
      const apiKey = 'AIzaSyCuZ7Yw0Qe1gxJt9FUrHFCQvNBymm_XFn0';
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${travelMode}&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoordinates(points);
        return data.routes[0];
      }
    } catch (error) {
      console.error('Directions error:', error);
    }
    return null;
  };

  const decodePolyline = (encoded: string) => {
    const points: Array<{latitude: number; longitude: number}> = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return points;
  };

  const startNavigation = async () => {
    const origin = startingPointCoords || userLocation;
    
    if (!origin) {
      Alert.alert('Error', 'Unable to get starting location. Please enable location services.');
      return;
    }

    if (!destinationCoords) {
      Alert.alert(
        'Select Destination', 
        'Please type in the destination field and select a location from the dropdown suggestions that appear.'
      );
      return;
    }

    // If destination text is empty but we have coordinates, use coordinates as text
    const destinationText = destination || `${destinationCoords.lat.toFixed(4)}, ${destinationCoords.lng.toFixed(4)}`;

    // Start navigation immediately
    setIsNavigating(true);
    setCurrentInstruction('Preparing route...');
    setLoadingStations(true);
    
    try {
      // Use the backend route planning API
      const routeData = await routePlanningApi.planRoute({
        origin: {
          lat: origin.lat,
          lng: origin.lng,
          address: startingPoint || 'Your location',
        },
        destination: {
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
          address: destinationText,
        },
        travelMode: travelMode,
        fuelType: selectedFuelType,
      });

      if (routeData.success) {
        // Decode and set route polyline
        const routePoints = decodePolyline(routeData.route.polyline);
        setRouteCoordinates(routePoints);

        // Set route summary (distance and duration)
        setRouteSummary({
          distance: routeData.route.summary.distance.text || `${routeData.route.summary.distance.value / 1000} km`,
          duration: routeData.route.summary.duration.text || `${Math.round(routeData.route.summary.duration.value / 60)} min`,
        });

        // Set stations along route
        const stations = routeData.stations?.map((s: any) => ({
          station: s.station,
          distance: s.distanceToRoute,
          score: 0,
          reason: `${s.distanceFromOrigin.toFixed(1)}km from start`,
        })) || [];
        console.log(`Found ${stations.length} stations along route`);
        setStationsAlongRoute(stations);

        // Zoom map to show route
        if (mapRef.current && routePoints.length > 0) {
          mapRef.current.fitToCoordinates(routePoints, {
            edgePadding: { top: 80, right: 40, bottom: 450, left: 40 },
            animated: true,
          });
        }

        setCurrentInstruction(`${routeSummary?.duration || 'Navigate'} via ${routeData.route.summary.startAddress.split(',')[0]}`);
      } else {
        throw new Error('Failed to get route');
      }
    } catch (error: any) {
      console.error('Route planning error:', error);
      
      // Fallback to old method if API fails
      if (origin && destinationCoords) {
        await getDirections(origin, destinationCoords);
        
        const response = await suggestPumpsApi.suggest({
          lat: origin.lat,
          lng: origin.lng,
          fuelType: selectedFuelType,
          radiusKm: 50,
        });

        const sortedStations = (response.suggestions || [])
          .sort((a: StationSuggestion, b: StationSuggestion) => a.distance - b.distance)
          .slice(0, 8);

        setStationsAlongRoute(sortedStations);
      }
      
      setCurrentInstruction('Navigation started');
    } finally {
      setLoadingStations(false);
    }
  };

  const selectDestinationFromMap = async (event: any) => {
    if (!isNavigating) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const newDestCoords = { lat: latitude, lng: longitude };
      setDestinationCoords(newDestCoords);
      setDestination(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      
      // Show route when destination is selected on map
      if (startingPointCoords) {
        await getDirections(startingPointCoords, newDestCoords);
      } else if (userLocation) {
        await getDirections(userLocation, newDestCoords);
      }
    }
  };

  // Search for destination suggestions as user types
  const searchDestinationSuggestions = async (query: string) => {
    setDestination(query);
    
    if (query.length < 2) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }

    // Debounce the search
    if (destinationSearchTimeout.current) {
      clearTimeout(destinationSearchTimeout.current);
    }

    destinationSearchTimeout.current = setTimeout(async () => {
      try {
        const response = await placesApi.autocomplete({
          input: query,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
        });

        if (response.success && response.predictions) {
          setDestinationSuggestions(response.predictions);
          setShowDestinationSuggestions(true);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 500); // 500ms debounce
  };

  // Search for starting point suggestions
  const searchStartingSuggestions = async (query: string) => {
    setStartingPoint(query);
    
    if (query.length < 2) {
      setStartingSuggestions([]);
      setShowStartingSuggestions(false);
      return;
    }

    // Debounce the search
    if (destinationSearchTimeout.current) {
      clearTimeout(destinationSearchTimeout.current);
    }

    destinationSearchTimeout.current = setTimeout(async () => {
      try {
        const response = await placesApi.autocomplete({
          input: query,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
        });

        if (response.success && response.predictions) {
          setStartingSuggestions(response.predictions);
          setShowStartingSuggestions(true);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 500);
  };

  // Select a destination from suggestions
  const selectDestinationSuggestion = async (prediction: any) => {
    setDestination(prediction.description);
    setShowDestinationSuggestions(false);
    
    try {
      const response = await placesApi.getDetails(prediction.placeId);
      if (response.success && response.place) {
        const newDestCoords = {
          lat: response.place.location.lat,
          lng: response.place.location.lng,
        };
        setDestinationCoords(newDestCoords);
        
        // Automatically show route when destination is selected
        if (startingPointCoords) {
          await getDirections(startingPointCoords, newDestCoords);
        } else if (userLocation) {
          await getDirections(userLocation, newDestCoords);
        }
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  };

  // Select a starting point from suggestions
  const selectStartingSuggestion = async (prediction: any) => {
    setStartingPoint(prediction.description);
    setShowStartingSuggestions(false);
    
    try {
      const response = await placesApi.getDetails(prediction.placeId);
      if (response.success && response.place) {
        const newStartCoords = {
          lat: response.place.location.lat,
          lng: response.place.location.lng,
        };
        setStartingPointCoords(newStartCoords);
        
        // Automatically show route when starting point is selected
        if (destinationCoords) {
          await getDirections(newStartCoords, destinationCoords);
        }
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  };

  // Loading Screen
  if (isLoading) {
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

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType={mapType}
        initialRegion={{
          latitude: userLocation?.lat || 19.1136,  // Mumbai - Andheri
          longitude: userLocation?.lng || 72.8697,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={mapType === 'standard'}
        onPress={selectDestinationFromMap}
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#1A73E8"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Destination Marker */}
        {destinationCoords && (
          <Marker
            coordinate={{
              latitude: destinationCoords.lat,
              longitude: destinationCoords.lng,
            }}
            pinColor="#35ea83ff"
          />
        )}

        {/* Station Markers - Show all approved stations */}
        {!isNavigating && allStations.length > 0 && allStations.map((item) => {
          console.log('🗺️ Rendering marker for:', item.station.name, 'at', item.station.lat, item.station.lng);
          const cngAvailable = item.station.cngAvailable || 0;
          const cngStatus = cngAvailable > 500 ? 'Full' : cngAvailable > 200 ? 'Available' : cngAvailable > 0 ? 'Low' : 'Empty';
          return (
            <Marker
              key={item.station.id}
              coordinate={{
                latitude: item.station.lat,
                longitude: item.station.lng,
              }}
              title={item.station.name}
              description={`${item.station.address}\n🔋 CNG Available: ${cngAvailable} kg (${cngStatus})`}
            >
              <View style={styles.gasStationMarker}>
                <MaterialCommunityIcons name="gas-station" size={32} color="#FFFFFF" />
              </View>
            </Marker>
          );
        })}
        
        {/* Debug: Show if no stations loaded */}
        {!isNavigating && allStations.length === 0 && (
          <>
            <Marker
              coordinate={{ latitude: 19.0596, longitude: 72.8295 }}
              title="Test Station 1"
              description="Bandra West\n🔋 CNG Available: 434 kg (Available)"
            >
              <View style={styles.gasStationMarker}>
                <MaterialCommunityIcons name="gas-station" size={32} color="#FFFFFF" />
              </View>
            </Marker>
            <Marker
              coordinate={{ latitude: 19.1136, longitude: 72.8697 }}
              title="Test Station 2"
              description="Andheri West\n🔋 CNG Available: 295 kg (Available)"
            >
              <View style={styles.gasStationMarker}>
                <MaterialCommunityIcons name="gas-station" size={32} color="#FFFFFF" />
              </View>
            </Marker>
            <Marker
              coordinate={{ latitude: 19.1868, longitude: 72.8479 }}
              title="Test Station 3"
              description="Malad\n🔋 CNG Available: 579 kg (Full)"
            >
              <View style={styles.gasStationMarker}>
                <MaterialCommunityIcons name="gas-station" size={32} color="#FFFFFF" />
              </View>
            </Marker>
            <Marker
              coordinate={{ latitude: 19.1663, longitude: 72.8526 }}
              title="Test Station 4"
              description="Goregaon West\n🔋 CNG Available: 122 kg (Low)"
            >
              <View style={styles.gasStationMarker}>
                <MaterialCommunityIcons name="gas-station" size={32} color="#FFFFFF" />
              </View>
            </Marker>
          </>
        )}

        {/* Station Markers - During navigation */}
        {isNavigating && stationsAlongRoute.map((item) => (
          <Marker
            key={item.station.id}
            coordinate={{
              latitude: item.station.lat,
              longitude: item.station.lng,
            }}
            pinColor={item.station.fuelTypes.includes('CNG') ? '#10B981' : '#EF4444'}
          >
            <View style={styles.stationMarker}>
              <Text style={styles.stationMarkerText}>⛽</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Google Maps Style Category Bar */}
      {!isNavigating && (
        <Animated.View style={[styles.categoryBar, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            <TouchableOpacity
              style={[styles.categoryPill, styles.categoryPillActive]}
              activeOpacity={0.8}
            >
              <View style={styles.iconCircle}>
                <Text style={[styles.categoryIconText, styles.categoryIconActive]}>C</Text>
              </View>
              <Text style={[styles.categoryText, styles.categoryTextActive]}>CNG</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      )}

      {/* Google Maps Style Search Bar */}
      {!isNavigating && (
        <Animated.View style={[styles.topBar, { opacity: fadeAnim }]}>
          {/* Profile Button */}
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialCommunityIcons name="account-circle" size={40} color="#5F6368" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.destinationInput}
            onPress={() => setShowRoutePlanModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.input, !destination && styles.placeholderText]}>
              {destination || 'Search CNG Bharat Maps'}
            </Text>
            <View style={styles.searchActions}>
              <TouchableOpacity style={styles.iconButton}>
                <EvilIcons name="search" size={28} color="#5F6368" />
              </TouchableOpacity>
              {destination && (
                <TouchableOpacity 
                  style={styles.navIconButton}
                  onPress={() => setShowRoutePlanModal(true)}
                >
                  <Entypo name="direction" size={20} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Map Control Buttons */}
      {!isNavigating && (
        <View style={styles.mapControls}>
          {/* Location Center Button */}
          <TouchableOpacity 
            style={styles.mapControlBtn}
            onPress={centerToUserLocation}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#5F6368" />
          </TouchableOpacity>

          {/* Layers Button */}
          <TouchableOpacity 
            style={styles.mapControlBtn}
            onPress={() => {
              if (mapType === 'standard') setMapType('satellite');
              else if (mapType === 'satellite') setMapType('terrain');
              else setMapType('standard');
            }}
          >
            <MaterialCommunityIcons name="layers" size={24} color="#5F6368" />
          </TouchableOpacity>

          {/* Zoom In/Out Buttons */}
          <View style={styles.zoomControls}>
            <TouchableOpacity 
              style={styles.zoomBtn}
              onPress={zoomIn}
            >
              <Entypo name="plus" size={24} color="#5F6368" />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity 
              style={styles.zoomBtn}
              onPress={zoomOut}
            >
              <Entypo name="minus" size={24} color="#5F6368" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Back Button (when navigating) */}
      {isNavigating && (
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            setIsNavigating(false);
            setRouteCoordinates([]);
            setStationsAlongRoute([]);
            setCurrentInstruction('');
            setDestination('');
            setDestinationCoords(null);
            setStartingPoint('');
            setStartingPointCoords(null);
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>Exit Navigation</Text>
        </TouchableOpacity>
      )}

      {/* Voice Guidance Instruction (when navigating) */}
      {isNavigating && currentInstruction && (
        <View style={styles.voiceBar}>
          <TouchableOpacity 
            style={styles.voiceIconBtn}
            onPress={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? (
              <Entypo name="sound" size={20} color="#000" />
            ) : (
              <Entypo name="sound-mute" size={20} color="#000" />
            )}
          </TouchableOpacity>
          <Text style={styles.voiceText}>{currentInstruction}</Text>
        </View>
      )}

      {/* Route Planning Modal */}
      {showRoutePlanModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.routePlanModal}>
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowRoutePlanModal(false)}
            >
              <Entypo name="cross" size={28} color="#333" />
            </TouchableOpacity>

            {/* Travel Modes */}
            <View style={styles.travelModesBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.travelModesContent}>
                <TouchableOpacity
                  style={[styles.travelModeBtn, travelMode === 'driving' && styles.travelModeBtnActive]}
                  onPress={() => setTravelMode('driving')}
                >
                  <View style={[styles.travelIconCircle, travelMode === 'driving' && styles.travelIconActive]}>
                    <MaterialCommunityIcons name="car" size={22} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelModeBtn, travelMode === 'motorcycle' && styles.travelModeBtnActive]}
                  onPress={() => setTravelMode('motorcycle')}
                >
                  <View style={[styles.travelIconCircle, travelMode === 'motorcycle' && styles.travelIconActive]}>
                    <MaterialCommunityIcons name="motorbike" size={22} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelModeBtn, travelMode === 'transit' && styles.travelModeBtnActive]}
                  onPress={() => setTravelMode('transit')}
                >
                  <View style={[styles.travelIconCircle, travelMode === 'transit' && styles.travelIconActive]}>
                    <MaterialCommunityIcons name="bus" size={22} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelModeBtn, travelMode === 'walking' && styles.travelModeBtnActive]}
                  onPress={() => setTravelMode('walking')}
                >
                  <View style={[styles.travelIconCircle, travelMode === 'walking' && styles.travelIconActive]}>
                    <MaterialCommunityIcons name="walk" size={22} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.travelModeBtn, travelMode === 'bicycling' && styles.travelModeBtnActive]}
                  onPress={() => setTravelMode('bicycling')}
                >
                  <View style={[styles.travelIconCircle, travelMode === 'bicycling' && styles.travelIconActive]}>
                    <MaterialCommunityIcons name="bicycle" size={22} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.travelModeBtn}>
                  <View style={styles.travelIconCircle}>
                    <Entypo name="retweet" size={18} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Route Inputs Section */}
            <View style={styles.routeInputsSection}>
              <View style={styles.routeDotsLine}>
                <View style={styles.startDot} />
                <View style={styles.dotLine} />
                <View style={styles.endDot} />
              </View>

              <View style={styles.inputsWrapper}>
                {/* Starting Point */}
                <View style={styles.routeInputContainer}>
                  <View style={styles.routeInputBox}>
                    <TextInput
                      style={styles.routeTextInput}
                      placeholder="Your location"
                      placeholderTextColor="#5F6368"
                      value={startingPoint}
                      onChangeText={searchStartingSuggestions}
                    />
                    <TouchableOpacity style={styles.searchBtn}>
                      <EvilIcons name="search" size={26} color="#5F6368" />
                    </TouchableOpacity>
                  </View>

                  {/* Starting Point Suggestions */}
                  {showStartingSuggestions && (
                    <View style={styles.suggestionsDropdown}>
                      <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                        {startingSuggestions.length > 0 ? (
                          startingSuggestions.map((suggestion, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.suggestionItem}
                              onPress={() => selectStartingSuggestion(suggestion)}
                            >
                              <MaterialCommunityIcons name="map-marker" size={20} color="#5F6368" style={styles.suggestionIcon} />
                              <View style={styles.suggestionTextContainer}>
                                <Text style={styles.suggestionMainText}>{suggestion.mainText}</Text>
                                <Text style={styles.suggestionSecondaryText}>{suggestion.secondaryText}</Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.suggestionItem}>
                            <Text style={styles.noSuggestionsText}>Type to search for a location...</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Destination */}
                <View style={styles.routeInputContainer}>
                  <View style={styles.routeInputBox}>
                    <TextInput
                      style={styles.routeTextInput}
                      placeholder="Choose destination..."
                      placeholderTextColor="#9AA0A6"
                      value={destination}
                      onChangeText={searchDestinationSuggestions}
                    />
                  </View>

                  {/* Destination Suggestions */}
                  {showDestinationSuggestions && (
                    <View style={styles.suggestionsDropdown}>
                      <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                        {destinationSuggestions.length > 0 ? (
                          destinationSuggestions.map((suggestion, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.suggestionItem}
                              onPress={() => selectDestinationSuggestion(suggestion)}
                            >
                              <MaterialCommunityIcons name="map-marker" size={20} color="#5F6368" style={styles.suggestionIcon} />
                              <View style={styles.suggestionTextContainer}>
                                <Text style={styles.suggestionMainText}>{suggestion.mainText}</Text>
                                <Text style={styles.suggestionSecondaryText}>{suggestion.secondaryText}</Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.suggestionItem}>
                            <Text style={styles.noSuggestionsText}>Searching...</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Swap button */}
                <TouchableOpacity
                  style={styles.swapBtn}
                  onPress={() => {
                    const temp = startingPoint;
                    setStartingPoint(destination);
                    setDestination(temp);
                  }}
                >
                  <Entypo name="swap" size={16} color="#5F6368" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Options */}
            <View style={styles.quickAccessSection}>
              <TouchableOpacity
                style={styles.quickAccessItem}
                onPress={() => setStartingPoint('Your location')}
              >
                <View style={styles.quickAccessIconCircle}>
                  <Entypo name="location-pin" size={22} color="#EA4335" />
                </View>
                <Text style={styles.quickAccessLabel}>Your location</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAccessItem}>
                <View style={styles.quickAccessIconCircle}>
                  <Entypo name="home" size={20} color="#5F6368" />
                </View>
                <View style={styles.quickAccessTextWrapper}>
                  <Text style={styles.quickAccessLabel}>Home</Text>
                  <Text style={styles.quickAccessAddress}>Jatwada road, jela che, Jatwada Road, Ra...</Text>
                </View>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Traffic Delays Info */}
            <View style={styles.delaysSection}>
              <Text style={styles.delaysTitle}>Delays</Text>
              <Text style={styles.delaysText}>Light traffic in this area</Text>
              <Text style={styles.delaysSubtext}>
                No known road disruptions. Traffic incidents will show up here.
              </Text>
            </View>

            {/* Start Button */}
            <View style={styles.startButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.startRouteButton, 
                  !destinationCoords && styles.startRouteButtonDisabled
                ]}
                onPress={() => {
                  if (!destinationCoords) {
                    Alert.alert(
                      'Select Destination',
                      'Please type your destination and select a location from the dropdown suggestions.'
                    );
                    return;
                  }
                  setShowRoutePlanModal(false);
                  startNavigation();
                }}
              >
                <Text style={styles.startRouteButtonText}>
                  {destinationCoords ? 'Start' : 'Select destination first'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Bottom Panel - Stations List (when navigating) */}
      {isNavigating && (
        <View style={styles.bottomPanel}>
          <View style={styles.bottomHandle} />
          
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>STATIONS ALONG ROUTE</Text>
            {loadingStations && <ActivityIndicator size="small" color="#000" />}
          </View>
          
          <ScrollView 
            style={styles.stationsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.stationsListContent}
          >
            {stationsAlongRoute.length > 0 ? (
              stationsAlongRoute.map((item, index) => (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
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
  map: {
    width: width,
    height: height,
  },
  
  // Google Maps Category Bar
  categoryBar: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryPillActive: {
    backgroundColor: '#E0F2FE',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  categoryIconActive: {
    color: '#FFF',
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  categoryTextActive: {
    color: '#0284C7',
  },
  
  // Top Bar (Google Maps Style Search)
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
  searchIcon: {
    fontSize: 22,
    color: '#5F6368',
  },
  navIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F9D58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: '700',
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  routePlanModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  closeModalButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeModalText: {
    fontSize: 28,
    color: '#333',
    fontWeight: '300',
  },
  travelModesBar: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    backgroundColor: '#FFF',
  },
  travelModesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  travelModeBtn: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelModeBtnActive: {
    backgroundColor: 'transparent',
  },
  travelIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelIconActive: {
    backgroundColor: '#1A73E8',
  },
  travelModeIconText: {
    fontSize: 24,
  },
  routeInputsSection: {
    flexDirection: 'row',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    backgroundColor: '#FFF',
  },
  routeDotsLine: {
    width: 28,
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 4,
  },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
    marginTop: 16,
  },
  dotLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#BDC1C6',
    marginVertical: 8,
  },
  endDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EA4335',
    marginBottom: 16,
  },
  inputsWrapper: {
    flex: 1,
  },
  routeInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#1A73E8',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  routeTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
  },
  searchBtn: {
    padding: 6,
  },
  swapBtn: {
    position: 'absolute',
    right: -46,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    backgroundColor: '#FFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DADCE0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  quickAccessSection: {
    padding: 24,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    backgroundColor: '#FFF',
  },
  quickAccessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  quickAccessIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  quickAccessTextWrapper: {
    flex: 1,
  },
  quickAccessLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
    marginBottom: 4,
  },
  quickAccessAddress: {
    fontSize: 14,
    color: '#5F6368',
  },
  editLink: {
    fontSize: 15,
    color: '#1A73E8',
    fontWeight: '500',
  },
  delaysSection: {
    padding: 24,
    paddingBottom: 100,
    backgroundColor: '#F8F9FA',
  },
  delaysTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 10,
  },
  delaysText: {
    fontSize: 15,
    color: '#5F6368',
    marginBottom: 10,
  },
  delaysSubtext: {
    fontSize: 14,
    color: '#80868B',
    lineHeight: 20,
  },
  startButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 24,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
  },
  startRouteButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startRouteButtonDisabled: {
    backgroundColor: '#BDC1C6',
    shadowOpacity: 0,
    elevation: 0,
  },
  startRouteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // Map Controls
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

  // Back Button
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Voice Guidance Bar
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
  voiceIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  voiceText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // Station Marker
  stationMarker: {
    width: 32,
    height: 32,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationMarkerText: {
    fontSize: 16,
  },

  // Bottom Panel
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
  // Autocomplete Suggestions
  routeInputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EAED',
    maxHeight: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    fontSize: 14,
    color: '#5F6368',
  },
  noSuggestionsText: {
    fontSize: 14,
    color: '#80868B',
    fontStyle: 'italic',
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
  // Custom Marker Styles - Google Maps Style Pin with Station Name
  stationPinContainer: {
    alignItems: 'center',
    width: 140,
  },
  pinBody: {
    alignItems: 'center',
    marginBottom: 2,
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  pinTip: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
    marginTop: -2,
  },
  stationNameBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
    maxWidth: 130,
  },
  stationNameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  pinMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
    marginTop: -3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  pinMarker: {
    alignItems: 'center',
  },
  pinTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
    marginTop: -4,
  },
  customMarker: {
    alignItems: 'center',
  },
  markerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerLabelContainer: {
    marginTop: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    maxWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    textAlign: 'center',
  },
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
