// Geographic math shared by the route builder and the 3D scene.

import * as THREE from 'three';

export const EARTH_RADIUS_KM = 6371;
/** Speed of light in vacuum, km/ms. */
export const LIGHT_KM_PER_MS = 299.792458;
/** Effective signal speed in optical fiber (~2/3 c), km/ms. */
export const FIBER_KM_PER_MS = 200;

/** lat/lon (degrees) → unit vector on the globe (three.js Y-up). */
export function latLonToVec3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Point a fraction `t` along the great circle from A to B (degrees in/out). */
export function greatCirclePoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  t: number,
): { lat: number; lon: number } {
  const a = latLonToVec3(lat1, lon1);
  const b = latLonToVec3(lat2, lon2);
  const omega = a.angleTo(b);
  if (omega < 1e-6) return { lat: lat1, lon: lon1 };
  const sinO = Math.sin(omega);
  const v = a
    .multiplyScalar(Math.sin((1 - t) * omega) / sinO)
    .add(b.multiplyScalar(Math.sin(t * omega) / sinO))
    .normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(v.z, -v.x)) - 180;
  return { lat, lon: ((lon + 540) % 360) - 180 };
}
