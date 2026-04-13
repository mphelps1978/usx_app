// Configuration for API endpoints
// Optional: set VITE_API_URL in Vercel (e.g. https://xxx.up.railway.app/api) if the hostname check is wrong.

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
    hostname === '[::1]';

  if (!isLocalDev) {
    // Guardrail: if VITE_API_URL was mistakenly set to a Supabase Functions endpoint,
    // ignore it and use the known hosted REST API base instead.
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
