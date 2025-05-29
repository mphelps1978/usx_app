import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  proNumber: '',
  dateDispatched: '',
  dateDelivered: '',
  trailerNumber: '',
  originCity: '',
  originState: '',
  destinationCity: '',
  destinationState: '',
  deadheadMiles: 0,
  loadedMiles: 0,
  weight: 0,
  linehaul: 0,
  fsc: 0,
  calculatedGross: 0,
  fuelCost: 100, // Dummy
  scaleCost: 50, // Dummy
  projectedNet: 0,
};

const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    updateFormData(state, action) {
      Object.assign(state, action.payload);
      state.calculatedGross = (state.linehaul * 0.68) + state.fsc;
      state.projectedNet = state.calculatedGross - (state.fuelCost + state.scaleCost);
    },
    resetForm() {
      return initialState;
    },
    setFormData(state, action) {
      return { ...initialState, ...action.payload };
    },
  },
});

export const { updateFormData, resetForm, setFormData } = formSlice.actions;
export default formSlice.reducer;