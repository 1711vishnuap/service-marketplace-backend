// src/utils/distance.js
// Simple, beginner-friendly distance calculation between two
// lat/lng points using the Haversine formula. No complicated
// routing/traffic APIs — just straight-line ("as the crow flies")
// distance, which is enough for MVP "nearest worker" matching.

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Returns the distance in kilometers between two coordinates.
 */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceKm = EARTH_RADIUS_KM * c;
  return Math.round(distanceKm * 100) / 100; // round to 2 decimal places
}

module.exports = { haversineDistanceKm };
