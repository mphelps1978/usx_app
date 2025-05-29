import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from 'axios'
const apiurl = 'http://localhost:3001/api'

export const fetchLoads = createAsyncThunk('/loads/fetchLoads', async (_, { getState }) => {
  const { token } = getState().auth
  const response = await axios.get(`${apiurl}/loads`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
})

export const addLoad = createAsyncThunk('/loads/addLoad', async (load, { getState }) => {
  const { token } = getState().auth
  const response = await axios.post(`${apiurl}/loads`, load, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
})

export const updateLoad = createAsyncThunk('/loads/updateLoad', async ({ proNumber, load }, { getState }) => {
  const { token } = getState().auth
  const response = await axios.put(`${apiurl}/loads/${proNumber}`, load, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
})

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
        state.error = action.error.message;
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
        state.error = action.error.message;
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

