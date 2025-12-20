import { useState, useEffect } from 'react';
import { StationSuggestion } from '../types';

type Station = {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  lat: string | number;
  lng: string | number;
  fuelTypes: string | string[];
  phone?: string;
  openingHours?: string;
  cngAvailable?: number;
  approvalStatus?: string;
};

export const useStations = () => {
  const [allStations, setAllStations] = useState<StationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllStations();
  }, []);

  const normalizeFuelTypes = (fuelTypes: string | string[]): string[] => {
    if (!fuelTypes) return [];
    if (Array.isArray(fuelTypes)) {
      return fuelTypes.map(type => type.trim().toUpperCase());
    }
    return fuelTypes.split(',').map(type => type.trim().toUpperCase());
  };

  const isValidStation = (station: Station): boolean => {
    try {
      // Check required fields
      if (!station.id || !station.name || !station.lat || !station.lng) {
        console.warn(`Skipping station - missing required fields:`, {
          id: !!station.id,
          name: !!station.name,
          lat: !!station.lat,
          lng: !!station.lng,
          stationId: station.id
        });
        return false;
      }

      // Check coordinates are valid numbers
      const lat = parseFloat(station.lat.toString());
      const lng = parseFloat(station.lng.toString());
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn(`Skipping station - invalid coordinates:`, { 
          stationId: station.id, 
          name: station.name,
          lat: station.lat, 
          lng: station.lng 
        });
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error validating station:', { 
        stationId: station.id, 
        error: err 
      });
      return false;
    }
  };

  const fetchAllStations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const endpoint = `${apiUrl}/api/stations`;
      
      console.log('🔍 Fetching stations from:', endpoint);
      
      const response = await fetch(endpoint, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const stations: Station[] = data.stations || [];
      console.log('📊 Total stations received:', stations.length);
      
      // Process and filter stations
      const activeStations = stations
        .filter(station => {
          if (!isValidStation(station)) return false;
          
          const fuelTypes = normalizeFuelTypes(station.fuelTypes || []);
          const isApproved = (station.approvalStatus || '').toLowerCase() === 'approved';
          const hasCNG = fuelTypes.includes('CNG');
          
          console.log(`Station: ${station.name || 'Unnamed'}`, {
            stationId: station.id,
            approved: isApproved,
            hasCNG,
            fuelTypes,
            approvalStatus: station.approvalStatus
          });
          
          return isApproved && hasCNG;
        })
        .map(station => {
          const lat = parseFloat(station.lat.toString());
          const lng = parseFloat(station.lng.toString());
          
          return {
            station: {
              id: station.id,
              name: station.name,
              address: station.address || '',
              city: station.city || '',
              state: station.state || '',
              postalCode: null,
              lat,
              lng,
              fuelTypes: Array.isArray(station.fuelTypes) 
                ? station.fuelTypes 
                : [station.fuelTypes || 'CNG'],
              phone: station.phone || '',
              openingHours: station.openingHours || '24/7',
              cngAvailable: typeof station.cngAvailable === 'number' ? station.cngAvailable : 0,
              isPartner: false,
              rating: 0,
            },
            distance: 0,
            score: 0,
            reason: 'Active CNG Station',
          };
        });
      
      console.log(`✅ Loaded ${activeStations.length} active CNG stations`);
      console.log('Active Stations:', activeStations.map(s => ({
        name: s.station.name,
        id: s.station.id,
        location: `${s.station.lat}, ${s.station.lng}`
      })));
      
      setAllStations(activeStations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Error fetching stations:', errorMessage, err);
      setError(`Failed to load stations: ${errorMessage}`);
      // Optionally, you could implement a retry mechanism here
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    allStations, 
    refreshStations: fetchAllStations,
    isLoading,
    error
  };
};
