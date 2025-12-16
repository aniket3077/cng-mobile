import { useState, useEffect } from 'react';
import { StationSuggestion } from '../types';

export const useStations = () => {
  const [allStations, setAllStations] = useState<StationSuggestion[]>([]);

  useEffect(() => {
    fetchAllStations();
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

  return { allStations, refreshStations: fetchAllStations };
};
