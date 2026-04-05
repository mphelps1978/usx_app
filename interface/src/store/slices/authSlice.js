import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { config } from '../../config';
const apiurl = config.apiUrl;

// The register thunk should return the data needed by its fulfilled reducer.
// The backend for register returns { message: 'User registered', userId: user.id }.
export const register = createAsyncThunk('auth/register', async ({ username, email, password }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${apiurl}/register`, { username, email, password });
    return response.data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Registration failed';
    return rejectWithValue(msg);
  }
});

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${apiurl}/login`, { email, password });
    return response.data;
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
        // action.payload is now { message: '...', userId: '...', token: '...' }
        state.userId = action.payload.userId;
        state.token = action.payload.token; // Set the token
        localStorage.setItem('authToken', action.payload.token); // Store token
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.token}`; // Set auth header
        state.error = null;
        // User is now logged in and token is set.
      })
      .addCase(register.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message;
      })
      .addCase(login.fulfilled, (state, action) => {
        // action.payload is now the full response data { token: '...', userId: '...' }
        state.token = action.payload.token;
        state.userId = action.payload.userId;
        localStorage.setItem('authToken', action.payload.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.token}`;
        state.error = null; // Clear any previous login errors
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message;
      });
  },
});

export const { logout, setTokenFromStorage } = authSlice.actions;
export default authSlice.reducer;