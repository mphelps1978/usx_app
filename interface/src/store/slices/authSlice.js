import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { config } from '../../config';
import { persistAuthToken, clearAuthToken } from './authStorage';

const apiurl = config.apiUrl;

export const register = createAsyncThunk('auth/register', async ({ username, email, password, rememberMe = true }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${apiurl}/register`, { username, email, password, rememberMe });
    return { ...response.data, rememberMe: !!rememberMe };
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Registration failed';
    return rejectWithValue(msg);
  }
});

export const login = createAsyncThunk('auth/login', async ({ email, password, rememberMe = true }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${apiurl}/login`, { email, password, rememberMe });
    if (!response.data?.token) {
      return rejectWithValue('Invalid response from server (missing token).');
    }
    return {
      ...response.data,
      rememberMe: response.data.rememberMe ?? !!rememberMe,
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Login failed';
    return rejectWithValue(msg);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null, userId: null, error: null },
  reducers: {
    logout(state) {
      state.token = null;
      state.userId = null;
      clearAuthToken();
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
      .addCase(login.pending, (state) => {
        state.error = null;
      })
      .addCase(register.pending, (state) => {
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.userId = action.payload.userId;
        state.token = action.payload.token;
        persistAuthToken(action.payload.token, action.payload.rememberMe !== false);
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.token}`;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.userId = action.payload.userId ?? null;
        persistAuthToken(action.payload.token, action.payload.rememberMe !== false);
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.token}`;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message;
      });
  },
});

export const { logout, setTokenFromStorage } = authSlice.actions;
export default authSlice.reducer;
