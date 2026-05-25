// Configuration for API endpoints
//
// Dockploy (split services): set build arg on the frontend service:
//   VITE_API_URL=https://api.usxicbooks.cloud/api
//
// Local dev: Vite on :5173, API on :3001 (no VITE_API_URL needed).

const normalizeApiBase = (raw) => {
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith('/api')) return trimmed;
  return `${trimmed}/api`;
};

const isSupabaseFunctionApiUrl = (raw) => {
  if (!raw) return false;
  const value = String(raw).toLowerCase();
  return value.includes(".supabase.co/functions/v1");
};

/** Production UI host → API base (when VITE_API_URL was not passed at Docker build). */
const PRODUCTION_API_BY_HOST = {
  'usxicbooks.cloud': 'https://api.usxicbooks.cloud/api',
  'www.usxicbooks.cloud': 'https://api.usxicbooks.cloud/api',
};

/** True when the UI is opened via a typical LAN IP (tablet/phone on same Wi‑Fi as the dev PC). */
const isPrivateLanIPv4 = (hostname) => {
  if (!hostname || typeof hostname !== "string") return false;
  const parts = hostname.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const getApiConfig = () => {
  const primaryEnvUrl = import.meta.env?.VITE_API_URL;
  const renderEnvUrl = import.meta.env?.VITE_RENDER_API_URL;
  const envUrl = primaryEnvUrl && String(primaryEnvUrl).trim()
    ? String(primaryEnvUrl).trim()
    : renderEnvUrl && String(renderEnvUrl).trim()
      ? String(renderEnvUrl).trim()
      : "";

  if (envUrl && !isSupabaseFunctionApiUrl(envUrl)) {
    const apiUrl = normalizeApiBase(envUrl);
    return {
      apiUrl,
      frontendUrl: typeof window !== 'undefined' ? window.location.origin : '',
      environment: 'production',
    };
  }

  const hostname = window.location.hostname;
  const isLocalDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    isPrivateLanIPv4(hostname);

  if (!isLocalDev) {
    const origin = window.location.origin.replace(/\/$/, '');
    const mappedApi = PRODUCTION_API_BY_HOST[hostname];
    if (mappedApi) {
      return {
        apiUrl: normalizeApiBase(mappedApi),
        frontendUrl: origin,
        environment: 'production',
      };
    }
    console.warn(
      '[config] VITE_API_URL was not set at build time and no API mapping exists for this host.',
    );
    return {
      apiUrl: `${origin}/api`,
      frontendUrl: origin,
      environment: 'production',
    };
  }

  return {
    apiUrl: `http://${hostname}:3001/api`,
    frontendUrl: `http://${hostname}:5173`,
    environment: 'development',
  };
};

export const config = getApiConfig();
