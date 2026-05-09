import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { config } from "../../config";

const apiUrl = config.apiUrl;

export const uploadReceipt = createAsyncThunk(
	"receipts/upload",
	async ({ targetType, targetId, file }, { getState, rejectWithValue }) => {
		try {
			const { token } = getState().auth;
			const form = new FormData();
			form.append("file", file);
			form.append("targetType", targetType);
			form.append("targetId", String(targetId));
			const res = await axios.post(`${apiUrl}/receipts`, form, {
				headers: { Authorization: `Bearer ${token}` },
			});
			return { ...res.data, targetType, targetId };
		} catch (err) {
			const msg =
				err.response?.data?.message ||
				err.message ||
				"Failed to attach receipt";
			return rejectWithValue(msg);
		}
	}
);

/** Opens save-as download with auth */
export async function downloadReceiptFile(targetType, targetId, token) {
	try {
		const res = await axios.get(`${apiUrl}/receipts/download`, {
			params: { targetType, targetId },
			headers: { Authorization: `Bearer ${token}` },
			responseType: "blob",
		});
		const cd = res.headers["content-disposition"];
		let filename = "receipt.pdf";
		if (cd && cd.includes("filename=")) {
			const m = cd.match(/filename="([^"]+)"/);
			if (m) filename = m[1];
		}
		const url = URL.createObjectURL(res.data);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	} catch (err) {
		const data = err.response?.data;
		if (data instanceof Blob) {
			const text = await data.text();
			let msg = "Download failed";
			try {
				const j = JSON.parse(text);
				if (j.message) msg = j.message;
			} catch {
				if (text) msg = text.slice(0, 200);
			}
			throw new Error(msg);
		}
		throw err;
	}
}

const receiptsSlice = createSlice({
	name: "receipts",
	initialState: {
		uploading: false,
		uploadError: null,
	},
	reducers: {
		clearReceiptError: (state) => {
			state.uploadError = null;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(uploadReceipt.pending, (state) => {
				state.uploading = true;
				state.uploadError = null;
			})
			.addCase(uploadReceipt.fulfilled, (state) => {
				state.uploading = false;
			})
			.addCase(uploadReceipt.rejected, (state, action) => {
				state.uploading = false;
				state.uploadError = action.payload;
			});
	},
});

export const { clearReceiptError } = receiptsSlice.actions;
export default receiptsSlice.reducer;
