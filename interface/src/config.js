// Configuration for API endpoints
// This file allows easy switching between localhost and Supabase

const getApiConfig = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Supabase deployment
  if (hostname.includes('supabase.co')) {
    return {
      apiUrl: `${protocol}//${hostname}/rest/v1`,
      frontendUrl: `${protocol}//${hostname}`,
      environment: 'supabase'
    };
  }

  // Local development
  return {
    apiUrl: 'http://localhost:3001/api',
    frontendUrl: 'http://localhost:5173',
    environment: 'development'
  };
};

export const config = getApiConfig();
