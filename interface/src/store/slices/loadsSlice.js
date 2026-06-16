import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios'
import { config } from '../../config';
const apiurl = config.apiUrl;

export const fetchLoads = createAsyncThunk('/loads/fetchLoads', async (_, { getState }) => {
  const { token } = getState().auth
  const response = await axios.get(`${apiurl}/loads`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
})

export const fetchLastEndingOdometer = createAsyncThunk(
  'loads/fetchLastEndingOdometer',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth
      const response = await axios.get(`${apiurl}/loads/last-ending-odometer`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data?.endingOdometer ?? null
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to fetch odometer'
      return rejectWithValue(message)
    }
  },
)

export const addLoad = createAsyncThunk('/loads/addLoad', async (load, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth
    const response = await axios.post(`${apiurl}/loads`, load, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Failed to add load'
    return rejectWithValue(message)
  }
})

export const updateLoad = createAsyncThunk('/loads/updateLoad', async ({ proNumber, load }, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth
    const response = await axios.put(`${apiurl}/loads/${proNumber}`, load, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Failed to update load'
    return rejectWithValue(message)
  }
})

export const markLoadPaid = createAsyncThunk(
  'loads/markLoadPaid',
  async ({ proNumber, isPaid }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth
      const response = await axios.patch(
        `${apiurl}/loads/${proNumber}/paid`,
        { isPaid },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return response.data
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to update paid status'
      return rejectWithValue(message)
    }
  },
)

export const cancelLoad = createAsyncThunk(
  'loads/cancelLoad',
  async ({ proNumber, cancelReason, cancelReasonOther, unlinkFuelStops }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth
      const response = await axios.patch(
        `${apiurl}/loads/${proNumber}/cancel`,
        { cancelReason, cancelReasonOther, unlinkFuelStops },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return response.data
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to cancel load'
      return rejectWithValue(message)
    }
  },
)

export const deleteLoad = createAsyncThunk('loads/deleteLoad', async (proNumber, { getState }) => {
  const { token } = getState().auth
  const response = await axios.delete(`${apiurl}/loads/${proNumber}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return proNumber
})

const initialState = {
  list: [],
  loading: false,
  error: null,
  lastEndingOdometer: null,
};

const loadSlice = createSlice({
  name: 'loads',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchLoads
      .addCase(fetchLoads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLoads.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchLoads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchLastEndingOdometer.fulfilled, (state, action) => {
        state.lastEndingOdometer = action.payload;
      })
      // addLoad
      .addCase(addLoad.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addLoad.fulfilled, (state, action) => {
        state.loading = false;
        state.list.push(action.payload);
      })
      .addCase(addLoad.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error.message;
      })
      // updateLoad
      .addCase(updateLoad.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateLoad.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.list.findIndex((load) => load.proNumber === action.payload.proNumber)
        if (index !== -1) state.list[index] = action.payload
      })
      .addCase(updateLoad.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error.message;
      })
      // markLoadPaid
      .addCase(markLoadPaid.fulfilled, (state, action) => {
        const index = state.list.findIndex((load) => load.proNumber === action.payload.proNumber)
        if (index !== -1) state.list[index] = action.payload
      })
      .addCase(markLoadPaid.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message;
      })
      // cancelLoad
      .addCase(cancelLoad.fulfilled, (state, action) => {
        const { unlinkedFuelStopCount, unlinkedFuelTotal, ...load } = action.payload
        void unlinkedFuelStopCount
        void unlinkedFuelTotal
        const index = state.list.findIndex((l) => l.proNumber === load.proNumber)
        if (index !== -1) state.list[index] = load
      })
      .addCase(cancelLoad.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message;
      })
      // deleteLoad
      .addCase(deleteLoad.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteLoad.fulfilled, (state, action) => {
        state.loading = false;
        state.list = state.list.filter((load) => load.proNumber !== action.payload)
      })
      .addCase(deleteLoad.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
  }
})

export default loadSlice.reducer
