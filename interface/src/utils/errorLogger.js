// /Users/mphelps/Documents/repos/usx_app/interface/src/utils/errorLogger.js
import axios from 'axios';
import { version } from '../../package.json'; // Assuming package.json is two levels up

const API_URL = process.env.NODE_ENV === 'production'
  ? 'http://localhost:3001/api'
  : 'http://172.20.10.4:3001/api';

export const logErrorToServer = async (error, contextInfo = {}) => {
  try {
    // Attempt to get the auth token directly from localStorage
    // This is a fallback if Redux state isn't easily accessible here
    // or if the error occurs before Redux is fully initialized.
    const token = localStorage.getItem('authToken');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const errorData = {
      message: error.message || 'Unknown error',
      stack: error.stack || null,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      appVersion: version,
      userAgent: navigator.userAgent,
      context: contextInfo.context || 'general', // e.g., 'global', 'api', 'manual'
      additionalInfo: contextInfo.additionalInfo || null,
      // Consider adding userId if easily and safely accessible
      // If using Redux, a middleware might be better for including userId from state
    };

    // console.log('Logging error to server:', errorData); // For client-side debugging
    await axios.post(`${API_URL}/client-log`, errorData, { headers });
  } catch (loggingError) {
    console.error('Failed to send error log to server:', loggingError);
    // Fallback: log the original error and the logging error to the console
    console.error('Original error:', error);
  }
};
