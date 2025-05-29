import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Async thunk for fetching user settings
export const fetchUserSettings = createAsyncThunk(
  'userSettings/fetchUserSettings',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await axios.get(`${API_URL}/users/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response ? error.response.data : error.message);
    }
  }
);

// Async thunk for saving user settings
export const saveUserSettings = createAsyncThunk(
  'userSettings/saveUserSettings',
  async (settingsData, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      // Frontend might send percentageRate as 0-100, backend expects 0-100 and converts to 0.0-1.0
      // So, no special conversion needed here before sending to backend PUT route.
      const response = await axios.put(`${API_URL}/users/settings`, settingsData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response ? error.response.data : error.message);
    }
  }
);

const initialState = {
  settings: {
    driverPayType: 'percentage', // Default structure
    percentageRate: 0.68,      // Default structure (stored as 0.0-1.0)
    fuelRoadUseTax: 0.01,
    maintenanceReserve: 0.05,
    bondDeposit: 0.04,
    mrpFee: 0.09
    // Add other settings fields with defaults as they are defined
  },
  loading: false,
  error: null,
};

const userSettingsSlice = createSlice({
  name: 'userSettings',
  initialState,
  reducers: {
    // Potentially add a reducer to update settings locally if needed for optimistic updates
    // or for direct local changes not tied to API calls.
  },
  extraReducers: (builder) => {
    builder
      // Fetch Settings
      .addCase(fetchUserSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
      })
      .addCase(fetchUserSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch settings';
      })
      // Save Settings
      .addCase(saveUserSettings.pending, (state) => {
        state.loading = true;
        state.error = null; // Clear previous errors on new save attempt
      })
      .addCase(saveUserSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
        // Optionally, display a success message here or navigate
      })
      .addCase(saveUserSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to save settings';
      });
  },
});

export default userSettingsSlice.reducer; 