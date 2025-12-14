import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, radius } from '../theme';
import { suggestPumpsApi } from '../lib/api';
import { StationSuggestion } from '../types';

interface Props {
  navigation: any;
}

export default function SuggestPumpsScreen({ navigation }: Props) {
  const [suggestions, setSuggestions] = useState<StationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    requestLocationAndFetch();
  }, []);

  const requestLocationAndFetch = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to find nearby pumps. Please enable it in settings.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: currentLocation.coords.latitude,
        lng: currentLocation.coords.longitude,
      };
      setLocation(coords);
      await fetchSuggestions(coords);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
      setLoading(false);
    }
  };

  const fetchSuggestions = async (coords: { lat: number; lng: number }) => {
    try {
      const response = await suggestPumpsApi.suggest({
        lat: coords.lat,
        lng: coords.lng,
        fuelType: 'CNG',
        radiusKm: 10,
      });
      setSuggestions(response.suggestions || []);
    } catch (error: any) {
      console.error('Fetch suggestions error:', error);
      const message = error.response?.data?.error || 'Failed to fetch pump suggestions.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (!location) {
      requestLocationAndFetch();
      return;
    }
    setRefreshing(true);
    await fetchSuggestions(location);
  };

  const renderStationCard = ({ item }: { item: StationSuggestion }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.stationName}>{item.station.name}</Text>
        {item.station.isPartner && (
          <View style={styles.partnerBadge}>
            <Text style={styles.partnerBadgeText}>Partner</Text>
          </View>
        )}
      </View>

      <Text style={styles.address}>
        {item.station.address}, {item.station.city}
      </Text>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailValue}>{item.distance.toFixed(1)} km</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Rating</Text>
          <Text style={styles.detailValue}>⭐ {item.station.rating.toFixed(1)}</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Score</Text>
          <Text style={styles.detailValue}>{item.score.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.fuelTypes}>
        {item.station.fuelTypes.map((fuel) => (
          <View key={fuel} style={styles.fuelBadge}>
            <Text style={styles.fuelBadgeText}>{fuel}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.reason}>{item.reason}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding nearby pumps...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={suggestions}
        renderItem={renderStationCard}
        keyExtractor={(item) => item.station.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pumps found nearby</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 16,
  },
  listContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stationName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  partnerBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  partnerBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  details: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  detailItem: {
    marginRight: spacing.lg,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  fuelTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  fuelBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  fuelBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  reason: {
    fontSize: 13,
    color: colors.accent,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
