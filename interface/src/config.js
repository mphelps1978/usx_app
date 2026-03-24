// Configuration for API endpoints
// This file allows easy switching between localhost and Supabase

const getApiConfig = () => {
  const hostname = window.location.hostname;

  // Production (Vercel)
  if (hostname !== 'localhost') {
    return {
      apiUrl: 'https://usxapp-production.up.railway.app/api',
      frontendUrl: 'https://usx-app-ten.vercel.app',
      environment: 'production'
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
