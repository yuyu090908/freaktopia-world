/** City centres for distance matching (public city coordinates, never a person's location). */
export interface City {
  name: string;
  country: string; // ISO alpha-2
  lat: number;
  lng: number;
  tz: string;
}

export const CITIES: City[] = [
  { name: "Tokyo", country: "JP", lat: 35.68, lng: 139.69, tz: "Asia/Tokyo" },
  { name: "Osaka", country: "JP", lat: 34.69, lng: 135.5, tz: "Asia/Tokyo" },
  { name: "Seoul", country: "KR", lat: 37.57, lng: 126.98, tz: "Asia/Seoul" },
  { name: "Shanghai", country: "CN", lat: 31.23, lng: 121.47, tz: "Asia/Shanghai" },
  { name: "Bangkok", country: "TH", lat: 13.76, lng: 100.5, tz: "Asia/Bangkok" },
  { name: "Pattaya", country: "TH", lat: 12.93, lng: 100.88, tz: "Asia/Bangkok" },
  { name: "Ho Chi Minh City", country: "VN", lat: 10.82, lng: 106.63, tz: "Asia/Ho_Chi_Minh" },
  { name: "Jakarta", country: "ID", lat: -6.2, lng: 106.85, tz: "Asia/Jakarta" },
  { name: "Bali", country: "ID", lat: -8.65, lng: 115.22, tz: "Asia/Makassar" },
  { name: "Singapore", country: "SG", lat: 1.35, lng: 103.82, tz: "Asia/Singapore" },
  { name: "Sydney", country: "AU", lat: -33.87, lng: 151.21, tz: "Australia/Sydney" },
  { name: "Melbourne", country: "AU", lat: -37.81, lng: 144.96, tz: "Australia/Melbourne" },
  { name: "Berlin", country: "DE", lat: 52.52, lng: 13.4, tz: "Europe/Berlin" },
  { name: "London", country: "GB", lat: 51.51, lng: -0.13, tz: "Europe/London" },
  { name: "Paris", country: "FR", lat: 48.86, lng: 2.35, tz: "Europe/Paris" },
  { name: "Amsterdam", country: "NL", lat: 52.37, lng: 4.9, tz: "Europe/Amsterdam" },
  { name: "Ibiza", country: "ES", lat: 38.98, lng: 1.43, tz: "Europe/Madrid" },
  { name: "Barcelona", country: "ES", lat: 41.39, lng: 2.17, tz: "Europe/Madrid" },
  { name: "Lisbon", country: "PT", lat: 38.72, lng: -9.14, tz: "Europe/Lisbon" },
  { name: "Moscow", country: "RU", lat: 55.76, lng: 37.62, tz: "Europe/Moscow" },
  { name: "New York", country: "US", lat: 40.71, lng: -74.01, tz: "America/New_York" },
  { name: "Detroit", country: "US", lat: 42.33, lng: -83.05, tz: "America/Detroit" },
  { name: "Los Angeles", country: "US", lat: 34.05, lng: -118.24, tz: "America/Los_Angeles" },
  { name: "Mexico City", country: "MX", lat: 19.43, lng: -99.13, tz: "America/Mexico_City" },
  { name: "São Paulo", country: "BR", lat: -23.55, lng: -46.63, tz: "America/Sao_Paulo" },
  { name: "Rio de Janeiro", country: "BR", lat: -22.91, lng: -43.17, tz: "America/Sao_Paulo" },
  { name: "Lagos", country: "NG", lat: 6.52, lng: 3.38, tz: "Africa/Lagos" },
  { name: "Johannesburg", country: "ZA", lat: -26.2, lng: 28.05, tz: "Africa/Johannesburg" },
];

export const findCity = (name: string) => CITIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase()) ?? null;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
