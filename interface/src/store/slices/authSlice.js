import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
const apiurl = 'http://localhost:3001/api'

export const register = createAsyncThunk('auth/register', async ({ username, email, password }) => {
  const response = await axios.post(`${apiurl}/register`, { username, email, password });
  return response.data.token;
});

export const login = createAsyncThunk('auth/login', async ({ email, password }) => {
  const response = await axios.post(`${apiurl}/login`, { email, password });
  return response.data.token;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null, userId: null, error: null },
  reducers: {
    logout(state) {
      state.token = null;
      state.userId = null;
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
    },
    setTokenFromStorage(state, action) {
      if (action.payload) {
        state.token = action.payload;
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload}`;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.fulfilled, (state, action) => {
        state.userId = action.payload.userId;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload;
        localStorage.setItem('authToken', action.payload);
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload}`;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

export const { logout, setTokenFromStorage } = authSlice.actions;
export default authSlice.reducer;