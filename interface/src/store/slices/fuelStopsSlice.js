import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Async Thunks
export const fetchFuelStops = createAsyncThunk(
  'fuelStops/fetchFuelStops',
  async (proNumber, { getState }) => { // proNumber is optional
    const { token } = getState().auth;
    let url = `${API_URL}/fuelstops`;
    if (proNumber) {
      url += `?proNumber=${proNumber}`;
    }
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
);

export const addFuelStop = createAsyncThunk(
  'fuelStops/addFuelStop',
  async (fuelStopData, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.post(`${API_URL}/fuelstops`, fuelStopData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
);

export const updateFuelStop = createAsyncThunk(
  'fuelStops/updateFuelStop',
  async ({ id, fuelStopData }, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.put(`${API_URL}/fuelstops/${id}`, fuelStopData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
);

export const deleteFuelStop = createAsyncThunk(
  'fuelStops/deleteFuelStop',
  async (id, { getState }) => {
    const { token } = getState().auth;
    await axios.delete(`${API_URL}/fuelstops/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return id; // Return the id of the deleted fuel stop
  }
);

const initialState = {
  list: [],
  loading: false,
  error: null,
};

const fuelStopsSlice = createSlice({
  name: 'fuelStops',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchFuelStops
      .addCase(fetchFuelStops.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFuelStops.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchFuelStops.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // addFuelStop
      .addCase(addFuelStop.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addFuelStop.fulfilled, (state, action) => {
        state.loading = false;
        state.list.push(action.payload);
      })
      .addCase(addFuelStop.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // updateFuelStop
      .addCase(updateFuelStop.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateFuelStop.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.list.findIndex((fs) => fs.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateFuelStop.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // deleteFuelStop
      .addCase(deleteFuelStop.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteFuelStop.fulfilled, (state, action) => {
        state.loading = false;
        state.list = state.list.filter((fs) => fs.id !== action.payload);
      })
      .addCase(deleteFuelStop.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default fuelStopsSlice.reducer; 