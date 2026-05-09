import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
	Alert,
	Box,
	CircularProgress,
	TextField,
	Stack,
} from "@mui/material";
import {
	uploadReceipt,
	clearReceiptError,
} from "../store/slices/receiptsSlice";
import {
	isDesktopApp,
	isWindowsDesktop,
	pickReceiptFileDesktop,
	scanReceiptFromScannerDesktop,
	saveReceiptLocalCopy,
	selectReceiptsDirectory,
} from "../lib/desktopApi";

/**
 * Attach a receipt PDF/image to a fuel stop or office expense row.
 * Desktop: native file picker via Electron; browser: file input.
 */
function ScanReceiptDialog({
	open,
	onClose,
	targetType,
	targetId,
	suggestedDate,
	suggestedVendor,
	onSuccess,
}) {
	const dispatch = useDispatch();
	const uploading = useSelector((s) => s.receipts?.uploading);
	const uploadErr = useSelector((s) => s.receipts?.uploadError);
	const [error, setError] = useState(null);
	const [file, setFile] = useState(null);
	const [localDir, setLocalDir] = useState(
		() => window.localStorage?.getItem("usx_receipts_local_dir") || ""
	);

	const stampStr =
		suggestedDate && String(suggestedDate).slice(0, 10).replace(/\//g, "-");
	const slugVendor = (suggestedVendor || "vendor").replace(/[^a-zA-Z0-9]+/g, "-");
	const suggestedName = `${stampStr || "date"}_${slugVendor}.pdf`;

	const reset = () => {
		setFile(null);
		setError(null);
		dispatch(clearReceiptError());
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handlePickBrowser = (e) => {
		const f = e.target.files?.[0];
		setFile(f || null);
		setError(null);
	};

	const handlePickDesktop = async () => {
		setError(null);
		const r = await pickReceiptFileDesktop();
		if (r?.file) setFile(r.file);
	};

	const handleScanDesktop = async () => {
		setError(null);
		dispatch(clearReceiptError());
		try {
			const r = await scanReceiptFromScannerDesktop();
			if (r?.file) setFile(r.file);
		} catch (e) {
			setError(e?.message || "Scan failed.");
		}
	};

	const handleChooseFolder = async () => {
		const d = await selectReceiptsDirectory();
		if (d) {
			setLocalDir(d);
			try {
				window.localStorage.setItem("usx_receipts_local_dir", d);
			} catch {
				/* ignore */
			}
		}
	};

	const handleSubmit = async () => {
		setError(null);
		dispatch(clearReceiptError());
		if (!file) {
			setError("Choose a receipt file.");
			return;
		}
		if (targetId == null) {
			setError("Missing record to attach to.");
			return;
		}

		const action = await dispatch(
			uploadReceipt({ targetType, targetId, file })
		);
		if (uploadReceipt.fulfilled.match(action)) {
			if (isDesktopApp() && localDir && action.payload?.receiptFileKey) {
				const buf = await file.arrayBuffer();
				const ext =
					file.name && file.name.includes(".")
						? file.name.slice(file.name.lastIndexOf("."))
						: ".pdf";
				const safeName = `${stampStr || "receipt"}_${slugVendor}${ext}`;
				await saveReceiptLocalCopy(localDir, safeName, buf);
			}
			onSuccess?.(action.payload);
			handleClose();
		} else {
			setError(action.payload || "Upload failed.");
		}
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle>Scan / attach receipt</DialogTitle>
			<DialogContent>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Suggested filename: <strong>{suggestedName}</strong>
				</Typography>
				{(error || uploadErr) && (
					<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
						{error || uploadErr}
					</Alert>
				)}
				<Stack spacing={2}>
					{isDesktopApp() ? (
						<>
							{isWindowsDesktop() && (
								<Button variant="contained" onClick={handleScanDesktop}>
									Scan with scanner…
								</Button>
							)}
							<Button variant="outlined" onClick={handlePickDesktop}>
								Choose file
							</Button>
							<TextField
								label="Also save copy to folder (optional)"
								value={localDir}
								onChange={(e) => setLocalDir(e.target.value)}
								fullWidth
								size="small"
								helperText="Desktop app only — mirror copy with date_vendor name"
							/>
							<Button size="small" onClick={handleChooseFolder}>
								Browse folder…
							</Button>
						</>
					) : (
						<Button variant="outlined" component="label">
							Choose file
							<input
								type="file"
								hidden
								accept=".pdf,image/*"
								onChange={handlePickBrowser}
							/>
						</Button>
					)}
					{file && (
						<Typography variant="body2">
							Selected: <strong>{file.name}</strong> (
							{(file.size / 1024).toFixed(1)} KB)
						</Typography>
					)}
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose}>Cancel</Button>
				<Button
					variant="contained"
					onClick={handleSubmit}
					disabled={uploading || !file}
					startIcon={uploading ? <CircularProgress size={18} /> : null}
				>
					Attach & upload
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default ScanReceiptDialog;
