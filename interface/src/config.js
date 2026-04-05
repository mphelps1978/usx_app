// Configuration for API endpoints
// Optional: set VITE_API_URL in Vercel (e.g. https://xxx.up.railway.app/api) if the hostname check is wrong.

const normalizeApiBase = (raw) => {
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith('/api')) return trimmed;
  return `${trimmed}/api`;
};

const getApiConfig = () => {
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim()) {
    const apiUrl = normalizeApiBase(String(envUrl).trim());
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
    hostname === '[::1]';

  if (!isLocalDev) {
    return {
      apiUrl: 'https://usxapp-production.up.railway.app/api',
      frontendUrl: 'https://usx-app-ten.vercel.app',
      environment: 'production',
    };
  }

  return {
    apiUrl: 'http://localhost:3001/api',
    frontendUrl: `http://${hostname}:5173`,
    environment: 'development',
  };
};

export const config = getApiConfig();
