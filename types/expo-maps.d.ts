declare module 'expo-maps' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export interface MarkerProps {
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
  }

  export class Marker extends React.Component<MarkerProps> {}

  export interface MapViewProps extends ViewProps {
    initialRegion?: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    };
    showsUserLocation?: boolean;
  }

  export default class MapView extends React.Component<MapViewProps> {}
}

