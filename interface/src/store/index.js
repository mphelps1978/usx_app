import { configureStore } from "@reduxjs/toolkit"
import authReducer from './slices/authSlice'
import loadsReducer from './slices/loadsSlice'
import formReducer from './slices/formSlice'
import fuelStopsReducer from './slices/fuelStopsSlice'
import userSettingsReducer from './slices/userSettingsSlice'
import officeExpensesReducer from './slices/officeExpensesSlice'
import receiptsReducer from './slices/receiptsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    loads: loadsReducer,
    form: formReducer,
    fuelStops: fuelStopsReducer,
    userSettings: userSettingsReducer,
    officeExpenses: officeExpensesReducer,
    receipts: receiptsReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware(),
})


