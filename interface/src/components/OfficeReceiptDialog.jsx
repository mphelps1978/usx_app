import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addOfficeExpense } from "../store/slices/officeExpensesSlice";
import {
	Box,
	Typography,
	Paper,
	Grid,
	TextField,
	Button,
	Alert,
	CircularProgress,
	InputAdornment,
	IconButton,
	Tooltip,
	MenuItem,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Stack,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
	OFFICE_EXPENSE_CATEGORIES,
	DEFAULT_OFFICE_EXPENSE_CATEGORY,
} from "../constants/officeExpenseCategories";
import {
	isDesktopApp,
	isWindowsDesktop,
	pickReceiptFileDesktop,
	scanReceiptFromScannerDesktop,
} from "../lib/desktopApi";

const ALLOWED_CATEGORY_VALUES = new Set(
	OFFICE_EXPENSE_CATEGORIES.map((c) => c.value)
);

const initialVendor = {
	vendorName: "",
	addressStreet: "",
	city: "",
	state: "",
	zip: "",
	phone: "",
	purchaseDate: "",
	tax: "0",
};

function newLineId() {
	return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLine() {
	return {
		id: newLineId(),
		description: "",
		category: DEFAULT_OFFICE_EXPENSE_CATEGORY,
		quantity: "",
		individualPrice: "",
		extendedPrice: "",
		extendedManual: false,
	};
}

function roundMoney(n) {
	if (typeof n !== "number" || Number.isNaN(n)) return 0;
	return Math.round(n * 100) / 100;
}

function hasLineNumbers(line) {
	const q = parseFloat(line.quantity);
	const p = parseFloat(line.individualPrice);
	return !Number.isNaN(q) && q > 0 && !Number.isNaN(p) && p >= 0;
}

function isLineComplete(line) {
	if (!hasLineNumbers(line)) return false;
	if (!(line.description || "").trim()) return false;
	if (!line.category || !ALLOWED_CATEGORY_VALUES.has(line.category)) return false;
	return true;
}

function isPartialLine(line) {
	if (isLineComplete(line)) return false;
	const startedDescription = (line.description || "").trim().length > 0;
	const startedNumbers =
		(line.quantity !== "" && line.quantity != null) ||
		(line.individualPrice !== "" && line.individualPrice != null) ||
		(line.extendedManual && line.extendedPrice !== "");
	return startedDescription || startedNumbers;
}

function computedExtended(line) {
	const q = parseFloat(line.quantity);
	const p = parseFloat(line.individualPrice);
	if (Number.isNaN(q) || Number.isNaN(p)) return null;
	return roundMoney(q * p);
}

function lineDisplayExtended(line) {
	if (line.extendedManual && line.extendedPrice !== "") {
		const v = parseFloat(line.extendedPrice);
		return Number.isNaN(v) ? null : v;
	}
	return computedExtended(line);
}

/**
 * Itemized office receipt entry (vendor + lines + receipt-level tax).
 */
function OfficeReceiptDialog({ open, onClose }) {
	const dispatch = useDispatch();
	const loading = useSelector(
		(state) => state.officeExpenses?.loading ?? false
	);
	const [vendor, setVendor] = useState(initialVendor);
	const [lines, setLines] = useState(() => [emptyLine()]);
	const [submitError, setSubmitError] = useState(null);
	const [receiptAttachment, setReceiptAttachment] = useState(null);

	useEffect(() => {
		if (open) {
			setVendor(initialVendor);
			setLines([emptyLine()]);
			setSubmitError(null);
			setReceiptAttachment(null);
		}
	}, [open]);

	const receiptTaxNum = useMemo(() => {
		const t = parseFloat(vendor.tax);
		return Number.isNaN(t) ? 0 : t;
	}, [vendor.tax]);

	const { subtotal, hasAmountLines, receiptTotal } = useMemo(() => {
		let sum = 0;
		let any = false;
		for (const line of lines) {
			if (hasLineNumbers(line)) {
				any = true;
				const ext = lineDisplayExtended(line);
				if (ext != null && !Number.isNaN(ext)) sum += ext;
			}
		}
		const sub = roundMoney(sum);
		return {
			subtotal: sub,
			hasAmountLines: any,
			receiptTotal: roundMoney(sub + receiptTaxNum),
		};
	}, [lines, receiptTaxNum]);

	const handleVendorChange = (e) => {
		const { name, value } = e.target;
		setSubmitError(null);
		setVendor((prev) => ({ ...prev, [name]: value }));
	};

	const handleLineChange = (lineId, name, value) => {
		setSubmitError(null);
		setLines((prev) => {
			const idx = prev.findIndex((l) => l.id === lineId);
			if (idx === -1) return prev;
			const row = prev[idx];
			let nextRow = { ...row };

			if (name === "extendedPrice") {
				nextRow.extendedManual = true;
				nextRow.extendedPrice = value;
			} else if (name === "quantity" || name === "individualPrice") {
				nextRow.extendedManual = false;
				nextRow[name] = value;
				const q = parseFloat(
					name === "quantity" ? value : nextRow.quantity
				);
				const p = parseFloat(
					name === "individualPrice" ? value : nextRow.individualPrice
				);
				if (!Number.isNaN(q) && !Number.isNaN(p)) {
					nextRow.extendedPrice = String(roundMoney(q * p));
				}
			} else {
				nextRow[name] = value;
			}

			const next = [...prev];
			next[idx] = nextRow;

			const isLast = idx === next.length - 1;
			if (isLast && hasLineNumbers(nextRow)) {
				return [...next, emptyLine()];
			}
			return next;
		});
	};

	const removeLine = (lineId) => {
		setSubmitError(null);
		setLines((prev) => {
			const filtered = prev.filter((l) => l.id !== lineId);
			if (filtered.length === 0) return [emptyLine()];
			const last = filtered[filtered.length - 1];
			if (hasLineNumbers(last)) return [...filtered, emptyLine()];
			return filtered;
		});
	};

	const handleClose = () => {
		onClose();
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSubmitError(null);
		if (!vendor.vendorName.trim()) {
			setSubmitError("Vendor name is required.");
			return;
		}

		if (receiptTaxNum < 0) {
			setSubmitError("Tax cannot be negative.");
			return;
		}

		const partialIdx = lines.findIndex(isPartialLine);
		if (partialIdx !== -1) {
			setSubmitError(
				`Complete or clear line ${partialIdx + 1} (description, quantity, and unit price are required).`
			);
			return;
		}

		const completeLines = lines.filter(isLineComplete);
		if (completeLines.length === 0) {
			setSubmitError(
				"Add at least one line with description, category, quantity, and unit price."
			);
			return;
		}

		const items = completeLines.map((line) => {
			const qty = parseFloat(line.quantity);
			const ind = parseFloat(line.individualPrice);
			const ext =
				line.extendedManual && line.extendedPrice !== ""
					? parseFloat(line.extendedPrice)
					: computedExtended(line);
			return {
				description: line.description.trim(),
				category: line.category,
				quantity: qty,
				individualPrice: ind,
				extendedPrice: ext,
			};
		});

		const payload = {
			vendorName: vendor.vendorName.trim(),
			addressStreet: vendor.addressStreet.trim() || undefined,
			city: vendor.city.trim() || undefined,
			state: vendor.state.trim() || undefined,
			zip: vendor.zip.trim() || undefined,
			phone: vendor.phone.trim() || undefined,
			purchaseDate: vendor.purchaseDate || undefined,
			tax: receiptTaxNum,
			items,
		};

		let action;
		if (receiptAttachment) {
			const fd = new FormData();
			fd.append("vendorName", payload.vendorName);
			if (payload.addressStreet) fd.append("addressStreet", payload.addressStreet);
			if (payload.city) fd.append("city", payload.city);
			if (payload.state) fd.append("state", payload.state);
			if (payload.zip) fd.append("zip", payload.zip);
			if (payload.phone) fd.append("phone", payload.phone);
			if (payload.purchaseDate) fd.append("purchaseDate", payload.purchaseDate);
			fd.append("tax", String(receiptTaxNum));
			fd.append("items", JSON.stringify(items));
			fd.append("receipt", receiptAttachment);
			action = await dispatch(addOfficeExpense(fd));
		} else {
			action = await dispatch(addOfficeExpense(payload));
		}
		if (addOfficeExpense.fulfilled.match(action)) {
			onClose();
		} else {
			setSubmitError(action.payload || "Could not save.");
		}
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="md"
			fullWidth
			scroll="paper"
			aria-labelledby="receipt-dialog-title"
		>
			<DialogTitle id="receipt-dialog-title">New receipt</DialogTitle>
			<form onSubmit={handleSubmit}>
				<DialogContent dividers>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						Itemized business purchases (not meals—those go under per diem).
						A new empty line appears when the last line has quantity and unit
						price. Each line needs a description and category. One tax amount
						for the whole receipt. Vendor details are saved for reuse.
					</Typography>

					{submitError && (
						<Alert
							severity="error"
							sx={{ mb: 2 }}
							onClose={() => setSubmitError(null)}
						>
							{submitError}
						</Alert>
					)}

					<Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
						Vendor
					</Typography>
					<Grid container spacing={2}>
						<Grid item xs={12} md={6}>
							<TextField
								required
								fullWidth
								label="Vendor name"
								name="vendorName"
								value={vendor.vendorName}
								onChange={handleVendorChange}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} md={6}>
							<TextField
								fullWidth
								label="Phone"
								name="phone"
								value={vendor.phone}
								onChange={handleVendorChange}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								fullWidth
								label="Street address"
								name="addressStreet"
								value={vendor.addressStreet}
								onChange={handleVendorChange}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={4}>
							<TextField
								fullWidth
								label="City"
								name="city"
								value={vendor.city}
								onChange={handleVendorChange}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={6} sm={4}>
							<TextField
								fullWidth
								label="State"
								name="state"
								value={vendor.state}
								onChange={handleVendorChange}
								margin="dense"
								inputProps={{ maxLength: 2 }}
							/>
						</Grid>
						<Grid item xs={6} sm={4}>
							<TextField
								fullWidth
								label="ZIP"
								name="zip"
								value={vendor.zip}
								onChange={handleVendorChange}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={4}>
							<TextField
								fullWidth
								label="Purchase date"
								name="purchaseDate"
								type="date"
								value={vendor.purchaseDate}
								onChange={handleVendorChange}
								margin="dense"
								InputLabelProps={{ shrink: true }}
							/>
						</Grid>
					</Grid>

					<Typography
						variant="subtitle1"
						gutterBottom
						sx={{ fontWeight: 600, mt: 2 }}
					>
						Line items
					</Typography>

					{lines.map((line, index) => {
						const canRemove = lines.length > 1;

						return (
							<Paper
								key={line.id}
								variant="outlined"
								sx={{ p: 2, mb: 2, position: "relative" }}
							>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										mb: 1,
									}}
								>
									<Typography variant="subtitle2" color="text.secondary">
										Item {index + 1}
									</Typography>
									{canRemove && (
										<Tooltip title="Remove line">
											<IconButton
												size="small"
												aria-label="Remove line"
												onClick={() => removeLine(line.id)}
											>
												<DeleteOutlineIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									)}
								</Box>
								<Grid container spacing={2}>
									<Grid item xs={12}>
										<TextField
											fullWidth
											required
											label="Description"
											value={line.description}
											onChange={(e) =>
												handleLineChange(
													line.id,
													"description",
													e.target.value
												)
											}
											margin="dense"
											placeholder="e.g. Printer paper, 10W-30 oil filter"
										/>
									</Grid>
									<Grid item xs={12} md={4}>
										<TextField
											fullWidth
											select
											required
											label="Category"
											value={line.category}
											onChange={(e) =>
												handleLineChange(
													line.id,
													"category",
													e.target.value
												)
											}
											margin="dense"
										>
											{OFFICE_EXPENSE_CATEGORIES.map((opt) => (
												<MenuItem key={opt.value} value={opt.value}>
													{opt.label}
												</MenuItem>
											))}
										</TextField>
									</Grid>
									<Grid item xs={6} md={2}>
										<TextField
											fullWidth
											label="Quantity"
											type="number"
											value={line.quantity}
											onChange={(e) =>
												handleLineChange(
													line.id,
													"quantity",
													e.target.value
												)
											}
											margin="dense"
											inputProps={{ min: "0", step: "any" }}
										/>
									</Grid>
									<Grid item xs={12} sm={6} md={3}>
										<TextField
											fullWidth
											label="Individual price"
											type="number"
											value={line.individualPrice}
											onChange={(e) =>
												handleLineChange(
													line.id,
													"individualPrice",
													e.target.value
												)
											}
											margin="dense"
											inputProps={{ min: "0", step: "0.01" }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">$</InputAdornment>
												),
											}}
										/>
									</Grid>
									<Grid item xs={12} sm={6} md={3}>
										<TextField
											fullWidth
											label="Extended price"
											type="number"
											value={line.extendedPrice}
											onChange={(e) =>
												handleLineChange(
													line.id,
													"extendedPrice",
													e.target.value
												)
											}
											margin="dense"
											inputProps={{ min: "0", step: "0.01" }}
											helperText={
												line.extendedManual
													? "Edited manually"
													: "From quantity × unit price"
											}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">$</InputAdornment>
												),
											}}
										/>
									</Grid>
								</Grid>
							</Paper>
						);
					})}

					<Typography
						variant="subtitle1"
						gutterBottom
						sx={{ fontWeight: 600, mt: 2 }}
					>
						Receipt PDF / scan (optional)
					</Typography>
					<Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
						<Button variant="outlined" component="label" size="small">
							{receiptAttachment ? receiptAttachment.name : "Choose file"}
							<input
								type="file"
								hidden
								accept=".pdf,image/*"
								onChange={(e) =>
									setReceiptAttachment(e.target.files?.[0] || null)
								}
							/>
						</Button>
						{isWindowsDesktop() && (
							<Button
								size="small"
								variant="contained"
								onClick={async () => {
									setSubmitError(null);
									try {
										const r = await scanReceiptFromScannerDesktop();
										if (r?.file) setReceiptAttachment(r.file);
									} catch (err) {
										setSubmitError(err?.message || "Scan failed.");
									}
								}}
							>
								Scan…
							</Button>
						)}
						{isDesktopApp() && (
							<Button
								size="small"
								variant="text"
								onClick={async () => {
									const r = await pickReceiptFileDesktop();
									if (r?.file) setReceiptAttachment(r.file);
								}}
							>
								Choose file (desktop)
							</Button>
						)}
						{receiptAttachment && (
							<Button size="small" onClick={() => setReceiptAttachment(null)}>
								Clear
							</Button>
						)}
					</Stack>

					<Typography
						variant="subtitle1"
						gutterBottom
						sx={{ fontWeight: 600, mt: 1 }}
					>
						Receipt totals
					</Typography>
					<Grid container spacing={2} alignItems="flex-end">
						<Grid item xs={12} sm={4} md={3}>
							<TextField
								fullWidth
								label="Tax (whole receipt)"
								name="tax"
								type="number"
								value={vendor.tax}
								onChange={handleVendorChange}
								margin="dense"
								inputProps={{ min: "0", step: "0.01" }}
								helperText="Sales tax once for this receipt"
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">$</InputAdornment>
									),
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={4} md={4}>
							<Typography variant="body2" color="text.secondary">
								Subtotal (lines)
							</Typography>
							<Typography variant="h6">
								{hasAmountLines ? `$${subtotal.toFixed(2)}` : "—"}
							</Typography>
						</Grid>
						<Grid item xs={12} sm={4} md={5}>
							<Typography variant="body2" color="text.secondary">
								Receipt total
							</Typography>
							<Typography variant="h6" component="p">
								{hasAmountLines ? `$${receiptTotal.toFixed(2)}` : "—"}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								Subtotal + tax
							</Typography>
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button type="button" onClick={handleClose} color="inherit">
						Cancel
					</Button>
					<Button
						type="submit"
						variant="contained"
						disabled={loading}
						startIcon={
							loading ? <CircularProgress size={18} color="inherit" /> : null
						}
					>
						Save expense
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
}

export default OfficeReceiptDialog;
