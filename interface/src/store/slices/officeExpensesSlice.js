import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { config } from "../../config";

const apiUrl = config.apiUrl;

export const fetchOfficeExpenses = createAsyncThunk(
	"officeExpenses/fetchAll",
	async (_, { getState, rejectWithValue }) => {
		try {
			const { token } = getState().auth;
			const res = await axios.get(`${apiUrl}/office-expenses`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			return res.data;
		} catch (err) {
			const msg =
				err.response?.data?.message || err.message || "Failed to load expenses";
			return rejectWithValue(msg);
		}
	}
);

export const addOfficeExpense = createAsyncThunk(
	"officeExpenses/add",
	async (payload, { getState, rejectWithValue }) => {
		try {
			const { token } = getState().auth;
			const isFormData =
				typeof FormData !== "undefined" && payload instanceof FormData;
			const res = await axios.post(`${apiUrl}/office-expenses`, payload, {
				headers: isFormData
					? { Authorization: `Bearer ${token}` }
					: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
			});
			return res.data?.items ?? [];
		} catch (err) {
			const msg =
				err.response?.data?.message || err.message || "Failed to save expense";
			return rejectWithValue(msg);
		}
	}
);

const initialState = {
	list: [],
	loading: false,
	error: null,
};

const officeExpensesSlice = createSlice({
	name: "officeExpenses",
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder
			.addCase(fetchOfficeExpenses.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchOfficeExpenses.fulfilled, (state, action) => {
				state.loading = false;
				state.list = action.payload;
			})
			.addCase(fetchOfficeExpenses.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload;
			})
			.addCase(addOfficeExpense.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(addOfficeExpense.fulfilled, (state, action) => {
				state.loading = false;
				const added = Array.isArray(action.payload) ? action.payload : [];
				state.list = [...added, ...state.list];
			})
			.addCase(addOfficeExpense.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload;
			});
	},
});

export default officeExpensesSlice.reducer;
