// Configuration for API endpoints
// This file allows easy switching between localhost, iPad, and production deployment

const getApiConfig = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Production environment (Vercel deployment)
  if (hostname.includes('vercel.app')) {
    return {
      apiUrl: `${protocol}//${hostname}/api`,
      frontendUrl: `${protocol}//${hostname}`,
      environment: 'production'
    };
  }

  // iPad deployment
  if (hostname === '172.20.10.4') {
    return {
      apiUrl: 'http://172.20.10.4:3001/api',
      frontendUrl: 'http://172.20.10.4:5176',
      environment: 'ipad'
    };
  }

  // Local development
  return {
    apiUrl: 'http://localhost:3001/api',
    frontendUrl: 'http://localhost:5176',
    environment: 'development'
  };
};

export const config = getApiConfig();
