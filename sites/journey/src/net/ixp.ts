// Major internet exchange points / carrier hotel cities, used to route the
// estimated path through plausible backbone waypoints. Coordinates are the
// host city, not the actual facility — this is an approximation by design.

export interface Ixp {
  name: string;
  city: string;
  country: string;
  cc: string;
  lat: number;
  lon: number;
}

export const IXPS: readonly Ixp[] = [
  { name: 'DE-CIX Frankfurt', city: 'Frankfurt', country: 'Germany', cc: 'DE', lat: 50.11, lon: 8.68 },
  { name: 'AMS-IX', city: 'Amsterdam', country: 'Netherlands', cc: 'NL', lat: 52.37, lon: 4.9 },
  { name: 'LINX', city: 'London', country: 'United Kingdom', cc: 'GB', lat: 51.51, lon: -0.13 },
  { name: 'France-IX', city: 'Paris', country: 'France', cc: 'FR', lat: 48.86, lon: 2.35 },
  { name: 'Netnod', city: 'Stockholm', country: 'Sweden', cc: 'SE', lat: 59.33, lon: 18.06 },
  { name: 'NIX.CZ', city: 'Prague', country: 'Czechia', cc: 'CZ', lat: 50.08, lon: 14.44 },
  { name: 'VIX', city: 'Vienna', country: 'Austria', cc: 'AT', lat: 48.21, lon: 16.37 },
  { name: 'SwissIX', city: 'Zurich', country: 'Switzerland', cc: 'CH', lat: 47.38, lon: 8.54 },
  { name: 'ESpanix', city: 'Madrid', country: 'Spain', cc: 'ES', lat: 40.42, lon: -3.7 },
  { name: 'MIX', city: 'Milan', country: 'Italy', cc: 'IT', lat: 45.46, lon: 9.19 },
  { name: 'DE-CIX Marseille', city: 'Marseille', country: 'France', cc: 'FR', lat: 43.3, lon: 5.37 },
  { name: 'MSK-IX', city: 'Moscow', country: 'Russia', cc: 'RU', lat: 55.75, lon: 37.62 },
  { name: 'PLIX', city: 'Warsaw', country: 'Poland', cc: 'PL', lat: 52.23, lon: 21.01 },
  { name: 'Equinix Ashburn', city: 'Ashburn', country: 'United States', cc: 'US', lat: 39.04, lon: -77.49 },
  { name: 'DE-CIX New York', city: 'New York', country: 'United States', cc: 'US', lat: 40.71, lon: -74.01 },
  { name: 'NOTA Miami', city: 'Miami', country: 'United States', cc: 'US', lat: 25.77, lon: -80.19 },
  { name: 'Equinix Chicago', city: 'Chicago', country: 'United States', cc: 'US', lat: 41.88, lon: -87.63 },
  { name: 'Equinix Dallas', city: 'Dallas', country: 'United States', cc: 'US', lat: 32.78, lon: -96.8 },
  { name: 'SIX Seattle', city: 'Seattle', country: 'United States', cc: 'US', lat: 47.61, lon: -122.33 },
  { name: 'Any2 Los Angeles', city: 'Los Angeles', country: 'United States', cc: 'US', lat: 34.05, lon: -118.24 },
  { name: 'Equinix Silicon Valley', city: 'San Jose', country: 'United States', cc: 'US', lat: 37.34, lon: -121.89 },
  { name: 'Equinix Denver', city: 'Denver', country: 'United States', cc: 'US', lat: 39.74, lon: -104.99 },
  { name: 'TorIX', city: 'Toronto', country: 'Canada', cc: 'CA', lat: 43.65, lon: -79.38 },
  { name: 'IX.br São Paulo', city: 'São Paulo', country: 'Brazil', cc: 'BR', lat: -23.55, lon: -46.63 },
  { name: 'IX.br Fortaleza', city: 'Fortaleza', country: 'Brazil', cc: 'BR', lat: -3.72, lon: -38.54 },
  { name: 'CABASE', city: 'Buenos Aires', country: 'Argentina', cc: 'AR', lat: -34.6, lon: -58.38 },
  { name: 'PIT Chile', city: 'Santiago', country: 'Chile', cc: 'CL', lat: -33.45, lon: -70.67 },
  { name: 'NAP Colombia', city: 'Bogotá', country: 'Colombia', cc: 'CO', lat: 4.71, lon: -74.07 },
  { name: 'IXSY Mexico', city: 'Mexico City', country: 'Mexico', cc: 'MX', lat: 19.43, lon: -99.13 },
  { name: 'NAPAfrica', city: 'Johannesburg', country: 'South Africa', cc: 'ZA', lat: -26.2, lon: 28.05 },
  { name: 'KIXP', city: 'Nairobi', country: 'Kenya', cc: 'KE', lat: -1.29, lon: 36.82 },
  { name: 'IXPN', city: 'Lagos', country: 'Nigeria', cc: 'NG', lat: 6.52, lon: 3.38 },
  { name: 'CAIX', city: 'Cairo', country: 'Egypt', cc: 'EG', lat: 30.04, lon: 31.24 },
  { name: 'UAE-IX', city: 'Dubai', country: 'United Arab Emirates', cc: 'AE', lat: 25.2, lon: 55.27 },
  { name: 'DE-CIX Istanbul', city: 'Istanbul', country: 'Türkiye', cc: 'TR', lat: 41.01, lon: 28.98 },
  { name: 'DE-CIX Mumbai', city: 'Mumbai', country: 'India', cc: 'IN', lat: 19.08, lon: 72.88 },
  { name: 'DE-CIX Chennai', city: 'Chennai', country: 'India', cc: 'IN', lat: 13.08, lon: 80.27 },
  { name: 'Equinix Singapore', city: 'Singapore', country: 'Singapore', cc: 'SG', lat: 1.35, lon: 103.82 },
  { name: 'HKIX', city: 'Hong Kong', country: 'Hong Kong', cc: 'HK', lat: 22.32, lon: 114.17 },
  { name: 'JPNAP Tokyo', city: 'Tokyo', country: 'Japan', cc: 'JP', lat: 35.68, lon: 139.69 },
  { name: 'JPIX Osaka', city: 'Osaka', country: 'Japan', cc: 'JP', lat: 34.69, lon: 135.5 },
  { name: 'KINX', city: 'Seoul', country: 'South Korea', cc: 'KR', lat: 37.57, lon: 126.98 },
  { name: 'IX Australia Sydney', city: 'Sydney', country: 'Australia', cc: 'AU', lat: -33.87, lon: 151.21 },
  { name: 'IX Australia Perth', city: 'Perth', country: 'Australia', cc: 'AU', lat: -31.95, lon: 115.86 },
  { name: 'APE Auckland', city: 'Auckland', country: 'New Zealand', cc: 'NZ', lat: -36.85, lon: 174.76 },
] as const;
