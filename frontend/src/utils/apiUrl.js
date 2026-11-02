/**
 * Dynamic API Base URL Resolver
 * Automatically detects whether the app is running on localhost or via local Wi-Fi / hotspot IP (e.g. 192.168.x.x or 172.x.x.x)
 * so mobile devices can access backend APIs and Socket.IO without manual configuration.
 *
 * When loaded over HTTPS, routes via same-origin (Vite proxy) to avoid browser Mixed Content errors.
 */
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // If the frontend is loaded over HTTPS, route through Vite's local reverse proxy to avoid Mixed Content errors
    if (window.location.protocol === 'https:') {
      return window.location.origin;
    }
    if (
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return `http://${window.location.hostname}:5000`;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export default getApiBaseUrl;

