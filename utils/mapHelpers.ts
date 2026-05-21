export const decodePolyline = (encoded: string) => {
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

export const getDirections = async (
  start: {lat: number; lng: number}, 
  end: {lat: number; lng: number},
  mode: string = 'driving'
) => {
  const points = [
    { latitude: start.lat, longitude: start.lng },
    { latitude: end.lat, longitude: end.lng },
  ];

  return {
    points,
    route: {
      mode,
      fallback: true,
    },
  };
};
