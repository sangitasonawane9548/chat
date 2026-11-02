/**
 * Dynamic API & Socket Base URL Resolver
 * 
 * Production Priority:
 * In production (e.g., deployed on Vercel), requests MUST point directly to the
 * deployed Render backend specified by `import.meta.env.VITE_API_URL`.
 * 
 * Local Development:
 * If no environment variable is provided, falls back to LAN IP detection
 * (so mobile devices on the same Wi-Fi can connect) or localhost.
 */

export const getApiBaseUrl = () => {
  // 1. Explicit production or environment API URL takes top priority
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && envApiUrl.trim()) {
    return envApiUrl.trim().replace(/\/$/, '');
  }

  // 2. Client-side local dev environment auto-detection
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;

    // Vite HTTPS local dev proxy (when run via `npm run dev:https` or tunnel)
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (protocol === 'https:' && isLocalhost && port !== '5000') {
      return origin;
    }

    // Access via local Wi-Fi / hotspot LAN IP (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
    if (!isLocalhost && hostname) {
      return `${protocol}//${hostname}:5000`;
    }
  }

  // 3. Default fallback for standard local development
  return 'http://localhost:5000';
};

/**
 * Socket.IO URL Resolver
 * Allows pointing Socket.IO to an independent URL if needed,
 * defaulting to the main API base URL.
 */
export const getSocketBaseUrl = () => {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (envSocketUrl && envSocketUrl.trim()) {
    return envSocketUrl.trim().replace(/\/$/, '');
  }
  return getApiBaseUrl();
};

export default getApiBaseUrl;
