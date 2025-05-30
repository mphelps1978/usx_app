import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
const apiurl = 'http://localhost:3001/api'

// The register thunk should return the data needed by its fulfilled reducer.
// The backend for register returns { message: 'User registered', userId: user.id }.
export const register = createAsyncThunk('auth/register', async ({ username, email, password }) => {
  const response = await axios.post(`${apiurl}/register`, { username, email, password });
  return response.data; // Return the whole data object which includes userId
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
        // action.payload is now { message: '...', userId: '...' }
        state.userId = action.payload.userId;
        state.error = null;
        // Note: Registration does not log the user in or set a token in this flow.
        // The user will need to log in separately after successful registration.
      })
      .addCase(register.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(login.fulfilled, (state, action) => {
        // action.payload here is the token string, because the login thunk returns response.data.token
        state.token = action.payload;
        localStorage.setItem('authToken', action.payload);
        axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload}`;
        state.error = null; // Clear any previous login errors
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

export const { logout, setTokenFromStorage } = authSlice.actions;
export default authSlice.reducer;