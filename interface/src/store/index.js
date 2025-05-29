import { configureStore } from "@reduxjs/toolkit"
import authReducer from './slices/authSlice'
import loadsReducer from './slices/loadsSlice'
import formReducer from './slices/formSlice'
import fuelStopsReducer from './slices/fuelStopsSlice'
import userSettingsReducer from './slices/userSettingsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    loads: loadsReducer,
    form: formReducer,
    fuelStops: fuelStopsReducer,
    userSettings: userSettingsReducer,
  },
})


