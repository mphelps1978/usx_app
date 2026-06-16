import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom"; // Import useLocation and useNavigate
import {
	fetchFuelStops,
	addFuelStop,
	updateFuelStop,
	deleteFuelStop,
} from "../store/slices/fuelStopsSlice";
import { fetchLoads } from "../store/slices/loadsSlice";
import { isActiveLoad } from "../constants/loadCancelReasons";
import {
	GENERAL_FUEL_OPTION,
	formatFuelStopProDisplay,
} from "../constants/fuelStops";
import {
	Box,
	Button,
	Typography,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	IconButton,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField,
	Autocomplete,
	Grid,
	Checkbox,
	FormControlLabel,
	CircularProgress,
	Alert,
	Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { config } from "../config";
import ScanReceiptDialog from "./ScanReceiptDialog";
import { downloadReceiptFile } from "../store/slices/receiptsSlice";

// Helper to format date for display and for date inputs
const formatDateForDisplay = (dateString) => {
	if (!dateString) return "N/A";
	const date = new Date(dateString);
	// Check if the date is valid
	if (isNaN(date.getTime())) {
		console.warn(
			"Invalid date encountered in formatDateForDisplay:",
			dateString
		);
		return "Invalid Date";
	}
	// If it's a valid date, then format it.
	// Adding T00:00:00 helps if dateString is just YYYY-MM-DD to interpret it as local midnight.
	// If dateString is a full ISO string, this might not be necessary but usually doesn't hurt.
	const adjustedDate = new Date(
		dateString.includes("T") ? dateString : dateString + "T00:00:00"
	);
	return adjustedDate.toLocaleDateString(undefined, { timeZone: "UTC" }); // Specify UTC to be safe with toLocaleDateString
};

const formatDateForInput = (date) => {
	if (!date) return "";
	const d = new Date(date);
	const year = d.getFullYear();
	const month = (d.getMonth() + 1).toString().padStart(2, "0");
	const day = d.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const formatCurrency = (value) => {
	const parsed = parseFloat(value);
	const safeValue = Number.isNaN(parsed) ? 0 : parsed;
	return `$${(Math.round(safeValue * 100) / 100).toFixed(2)}`;
};

const formatLoadProLabel = (load) => {
	if (!load) return "";
	const lane = [load.originCity, load.destinationCity].filter(Boolean).join(" to ");
	return lane ? `${load.proNumber} — ${lane}` : String(load.proNumber);
};

const parseLoadDateMs = (dateStr) => {
	if (!dateStr || String(dateStr).trim() === "") return 0;
	const s = String(dateStr).trim();
	const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00Z`);
	const t = d.getTime();
	return Number.isNaN(t) ? 0 : t;
};

const sortLoadsForProPicker = (loadsList) =>
	[...loadsList].sort((a, b) => {
		const aInTransit = !a.dateDelivered;
		const bInTransit = !b.dateDelivered;
		if (aInTransit !== bInTransit) return aInTransit ? -1 : 1;
		if (aInTransit) {
			return String(b.proNumber).localeCompare(String(a.proNumber));
		}
		const dateDiff =
			parseLoadDateMs(b.dateDelivered) - parseLoadDateMs(a.dateDelivered);
		if (dateDiff !== 0) return dateDiff;
		return String(b.proNumber).localeCompare(String(a.proNumber));
	});

const filterProPickerLoads = (loadsList, showPaidLoads) =>
	loadsList.filter((load) => {
		if (load.isCancelled) return false;
		return showPaidLoads ? true : !load.isPaid;
	});

function FuelStops() {
	const dispatch = useDispatch();
	const location = useLocation(); // Get location object
	const navigate = useNavigate(); // Get navigate function
	const {
		list: fuelStops,
		loading,
		error,
	} = useSelector((state) => state.fuelStops);
	const { list: loads } = useSelector((state) => state.loads);
	const authToken = useSelector((state) => state.auth?.token);

	const initialFormData = {
		fuelCardUsed: false,
		proNumber: "", // Ensure proNumber is part of initial state for the form
		discountEligible: false, // Corrected typo here
	};
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({});
	const [isEditing, setIsEditing] = useState(false);
	const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
	const [settleFormData, setSettleFormData] = useState({});
	const [fuelStopToSettle, setFuelStopToSettle] = useState(null);
	const [receiptFuelStop, setReceiptFuelStop] = useState(null);
	const [showPaidLoads, setShowPaidLoads] = useState(false);

	const proPickerLoads = useMemo(
		() => sortLoadsForProPicker(filterProPickerLoads(loads, showPaidLoads)),
		[loads, showPaidLoads]
	);

	const proPickerOptions = useMemo(() => {
		let options = [GENERAL_FUEL_OPTION, ...proPickerLoads];
		if (formData.proNumber) {
			const inList = options.some(
				(o) => !o.isGeneralFuel && o.proNumber === formData.proNumber
			);
			if (!inList) {
				const current = loads.find((l) => l.proNumber === formData.proNumber);
				if (current) {
					options = [GENERAL_FUEL_OPTION, current, ...proPickerLoads];
				}
			}
		}
		return options;
	}, [proPickerLoads, formData.proNumber, loads]);

	const selectedProPickerValue = useMemo(() => {
		if (!formData.proNumber) return GENERAL_FUEL_OPTION;
		return loads.find((load) => load.proNumber === formData.proNumber) || null;
	}, [formData.proNumber, loads]);

	const sortedFuelStops = useMemo(() => {
		const parseStopMs = (dateStr) => {
			if (!dateStr) return 0;
			const s = String(dateStr).trim();
			const d = new Date(s.includes("T") ? s : `${s}T00:00:00`);
			const t = d.getTime();
			return Number.isNaN(t) ? 0 : t;
		};
		return [...fuelStops].sort((a, b) => {
			const diff = parseStopMs(b.dateOfStop) - parseStopMs(a.dateOfStop);
			if (diff !== 0) return diff;
			return (b.id ?? 0) - (a.id ?? 0);
		});
	}, [fuelStops]);

	useEffect(() => {
		dispatch(fetchFuelStops());
		dispatch(fetchLoads());
	}, [dispatch]);

	useEffect(() => {
		// Check if we need to open the modal for a specific PRO number from dashboard
		if (location.state?.openModalForPro) {
			const proToPrefill = location.state.openModalForPro;
			setIsEditing(false);
			setShowPaidLoads(false);
			setFormData({
				...initialFormData, // Start with initial defaults
				proNumber: proToPrefill,
				dateOfStop: formatDateForInput(new Date()), // Pre-fill the PRO number
			});
			setIsModalOpen(true);
			// Clear the state from location to prevent re-opening on refresh/navigation
			navigate(location.pathname, { replace: true, state: {} });
		}
	}, [location.state, navigate]); // Rerun if location.state changes

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		const type = e.target.type; // Get type before potential setFormData

		if (type === "checkbox") {
			setFormData((prev) => ({ ...prev, [name]: e.target.checked }));
		} else {
			setFormData((prev) => ({ ...prev, [name]: value }));
		}
	};

	const handleAddFuelStop = () => {
		setIsEditing(false);
		setShowPaidLoads(false);
		const inTransitLoad = loads.find((load) => isActiveLoad(load));
		setFormData({
			...initialFormData,
			proNumber: inTransitLoad?.proNumber || "",
			dateOfStop: formatDateForInput(new Date()),
		});
		setIsModalOpen(true);
	};

	const handleEditFuelStop = (fuelStop) => {
		setIsEditing(true);
		// Ensure date is formatted correctly for the date input field
		// And map model field names (from fuelStop) to formData field names (used in form)
		setFormData({
			id: fuelStop.id,
			proNumber: fuelStop.proNumber || "",
			dateOfStop: formatDateForInput(fuelStop.dateOfStop),
			vendorName: fuelStop.vendor, // Map from 'vendor' (model) to 'vendorName' (form)
			fuelCardUsed: fuelStop.fuelCardUsed || false, // Defaults to False if not present
			discountEligible: fuelStop.discountEligible || false, // Ensure this matches corrected name
			gallonsDieselPurchased: fuelStop.gallonsDieselPurchased, // Use corrected model field name
			pumpPriceDiesel: fuelStop.dieselPricePerGallon, // Use corrected model field name
			gallonsDefPurchased: fuelStop.gallonsDefPurchased, // Matches
			pumpPriceDef: fuelStop.defPricePerGallon, // Use corrected model field name
			// Calculated fields are usually not set directly in formData for editing,
			// but if they are displayed in the edit form (disabled), ensure keys match those displays
			costDieselPurchased: fuelStop.totalDieselCost,
			totalDefCost: fuelStop.totalDefCost,
			totalFuelStopCost: fuelStop.totalFuelStop,
			odometerReading:
				fuelStop.odometerReading != null ? fuelStop.odometerReading : "",
		});
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setFormData(initialFormData);
		setIsEditing(false);
		setShowPaidLoads(false);
	};

	const handleSubmitModal = async (e) => {
		e.preventDefault();
		let odometerReading = null;
		if (
			formData.odometerReading !== undefined &&
			formData.odometerReading !== null &&
			String(formData.odometerReading).trim() !== ""
		) {
			const parsed = parseFloat(formData.odometerReading);
			odometerReading = Number.isNaN(parsed) ? null : parsed;
		}

		const payload = {
			proNumber: formData.proNumber ? formData.proNumber : null,
			dateOfStop: formData.dateOfStop
				? formatDateForInput(new Date(formData.dateOfStop))
				: null,
			vendorName: formData.vendorName,
			gallonsDieselPurchased: parseFloat(formData.gallonsDieselPurchased) || 0,
			pumpPriceDiesel: parseFloat(formData.pumpPriceDiesel) || 0,
			gallonsDefPurchased: formData.gallonsDefPurchased
				? parseFloat(formData.gallonsDefPurchased)
				: null,
			pumpPriceDef: formData.pumpPriceDef
				? parseFloat(formData.pumpPriceDef)
				: null,
			fuelCardUsed: formData.fuelCardUsed || false,
			discountEligible: formData.discountEligible || false,
			odometerReading,
		};

		if (isEditing) {
			await dispatch(
				updateFuelStop({ id: formData.id, fuelStopData: payload })
			);
		} else {
			await dispatch(addFuelStop(payload));
		}
		handleCloseModal();
	};

	const handleDelete = async (id) => {
		if (window.confirm("Are you sure you want to delete this fuel stop?")) {
			await dispatch(deleteFuelStop(id));
		}
	};

	const handleSettleFuelStop = (fuelStop) => {
		setFuelStopToSettle(fuelStop);
		setSettleFormData({
			settledDieselPricePerGallon: fuelStop.settledDieselPricePerGallon || "",
		});
		setIsSettleModalOpen(true);
	};

	const handleCloseSettleModal = () => {
		setIsSettleModalOpen(false);
		setSettleFormData({});
		setFuelStopToSettle(null);
	};

	const handleSubmitSettleModal = async (e) => {
		e.preventDefault();
		if (!fuelStopToSettle) return;

		const settledPrice = parseFloat(settleFormData.settledDieselPricePerGallon);
		if (isNaN(settledPrice) || settledPrice < 0) {
			alert("Please enter a valid settled diesel price per gallon.");
			return;
		}

		try {
			const response = await fetch(
				`${config.apiUrl}/fuelstops/${fuelStopToSettle.id}/settle`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify({
						settledDieselPricePerGallon: settledPrice,
					}),
				}
			);

			if (response.ok) {
				// Refresh the fuel stops list
				dispatch(fetchFuelStops());
				handleCloseSettleModal();
				alert("Fuel stop settled successfully!");
			} else {
				const error = await response.json();
				alert(`Error settling fuel stop: ${error.message || "Unknown error"}`);
			}
		} catch (error) {
			console.error("Error settling fuel stop:", error);
			alert("Error settling fuel stop. Please try again.");
		}
	};

	return (
		<Box sx={{ flexGrow: 1 }}>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					mb: 2,
				}}
			>
				<Typography variant="h4" component="h2" gutterBottom>
					Fuel Stops Management
				</Typography>
				<Button variant="contained" onClick={handleAddFuelStop}>
					Add New Fuel Stop
				</Button>
			</Box>

			{loading && (
				<CircularProgress sx={{ display: "block", margin: "20px auto" }} />
			)}
			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{error.message || "An error occurred"}
				</Alert>
			)}

			{!loading && !error && fuelStops.length === 0 && (
				<Paper sx={{ textAlign: "center", p: 3, mt: 2 }}>
					<Typography variant="subtitle1">
						No fuel stops found. Click "Add New Fuel Stop" to get started.
					</Typography>
				</Paper>
			)}

			<ScanReceiptDialog
				open={Boolean(receiptFuelStop)}
				onClose={() => setReceiptFuelStop(null)}
				targetType="fuel_stop"
				targetId={receiptFuelStop?.id}
				suggestedDate={
					receiptFuelStop
						? formatDateForInput(receiptFuelStop.dateOfStop)
						: ""
				}
				suggestedVendor={receiptFuelStop?.vendor}
				onSuccess={() => {
					dispatch(fetchFuelStops());
				}}
			/>

			{!loading && !error && sortedFuelStops.length > 0 && (
				<TableContainer component={Paper} sx={{ boxShadow: 3 }}>
					<Table sx={{ minWidth: 650 }} aria-label="fuel stops table">
						<TableHead sx={{ backgroundColor: "grey.200" }}>
							<TableRow>
								<TableCell>Load PRO</TableCell>
								<TableCell>Date</TableCell>
								<TableCell>Vendor</TableCell>
								<TableCell align="right">Diesel Gal.</TableCell>
								<TableCell align="right">Diesel Price/Gal</TableCell>
								<TableCell align="right">Total Diesel Cost</TableCell>
								<TableCell align="right">DEF Gal.</TableCell>
								<TableCell align="right">DEF Price/Gal</TableCell>
								<TableCell align="right">Total DEF Cost</TableCell>
								<TableCell align="center">Card Used?</TableCell>
								<TableCell align="center">Discounted?</TableCell>
								<TableCell align="right">Total Stop Cost</TableCell>
								<TableCell align="center">Receipt</TableCell>
								<TableCell align="center">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{sortedFuelStops.map((fs) => (
								<TableRow
									key={fs.id}
									sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
								>
									<TableCell component="th" scope="row">
										{formatFuelStopProDisplay(fs.proNumber)}
									</TableCell>
									<TableCell>{formatDateForDisplay(fs.dateOfStop)}</TableCell>
									<TableCell>{fs.vendor}</TableCell>
									<TableCell align="right">
										{/* Use corrected model field name: gallonsDieselPurchased. Show 0.00 if 0. */}
										{fs.gallonsDieselPurchased !== undefined &&
										fs.gallonsDieselPurchased !== null
											? parseFloat(fs.gallonsDieselPurchased).toFixed(2)
											: 0}
									</TableCell>
									<TableCell align="right">
										{/* Use corrected model field name: dieselPricePerGallon. Show $0.000 if 0. */}
										{fs.dieselPricePerGallon !== undefined &&
										fs.dieselPricePerGallon !== null
											? `$${parseFloat(fs.dieselPricePerGallon).toFixed(2)}`
											: "N/A"}
									</TableCell>
									<TableCell align="right">
										{/* Calculated: fs.totalDieselCost. Defaults to $0.00 if null/undefined. */}
										{formatCurrency(fs.totalDieselCost)}
									</TableCell>
									<TableCell align="right">
										{/* fs.gallonsDefPurchased. Show 0.00 if 0. */}
										{fs.gallonsDefPurchased !== undefined &&
										fs.gallonsDefPurchased !== null
											? parseFloat(fs.gallonsDefPurchased).toFixed(2)
											: 0}
									</TableCell>
									<TableCell align="right">
										{/* Use corrected model field name: defPricePerGallon. Show $0.000 if 0. */}
										{fs.defPricePerGallon !== undefined &&
										fs.defPricePerGallon !== null
											? `$${parseFloat(fs.defPricePerGallon).toFixed(2)}`
											: "N/A"}
									</TableCell>
									<TableCell align="right">
										{/* Calculated: fs.totalDefCost. Defaults to $0.00 if null/undefined. */}
										{formatCurrency(fs.totalDefCost)}
									</TableCell>
									<TableCell align="center">
										{fs.fuelCardUsed ? "Yes" : "No"}
									</TableCell>
									<TableCell align="center">
										{fs.discountEligible ? "Yes" : "No"}
									</TableCell>
									<TableCell align="right">
										{/* Calculated: fs.totalFuelStop. Defaults to $0.00 if null/undefined. */}
										{formatCurrency(fs.totalFuelStop)}
									</TableCell>
									<TableCell align="center">
										{fs.receiptFileKey ? (
											<Tooltip title="Download receipt">
												<IconButton
													size="small"
													onClick={async (e) => {
														e.stopPropagation();
														try {
															await downloadReceiptFile(
																"fuel_stop",
																fs.id,
																authToken
															);
														} catch (err) {
															console.error(err);
															alert(
																err?.response?.data?.message ||
																	"Could not download receipt"
															);
														}
													}}
												>
													<AttachFileIcon fontSize="small" />
												</IconButton>
											</Tooltip>
										) : (
											<Typography variant="caption" color="text.secondary">
												—
											</Typography>
										)}
										<Tooltip title="Attach or replace receipt">
											<IconButton
												size="small"
												color="primary"
												onClick={(e) => {
													e.stopPropagation();
													setReceiptFuelStop(fs);
												}}
											>
												<ReceiptLongIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									</TableCell>
									<TableCell align="center">
										<Tooltip title="Edit Fuel Stop">
											<IconButton
												onClick={() => handleEditFuelStop(fs)}
												color="primary"
												size="small"
											>
												<EditIcon />
											</IconButton>
										</Tooltip>
										<Tooltip title="Settle Fuel Stop">
											<IconButton
												onClick={() => handleSettleFuelStop(fs)}
												color="success"
												size="small"
											>
												<LocalGasStationIcon />
											</IconButton>
										</Tooltip>
										<Tooltip title="Delete Fuel Stop">
											<IconButton
												onClick={() => handleDelete(fs.id)}
												color="error"
												size="small"
											>
												<DeleteIcon />
											</IconButton>
										</Tooltip>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			<Dialog
				open={isModalOpen}
				onClose={handleCloseModal}
				PaperProps={{ component: "form", onSubmit: handleSubmitModal }}
				maxWidth="md"
				fullWidth
			>
				<DialogTitle>
					{isEditing ? "Edit Fuel Stop" : "Add New Fuel Stop"}
				</DialogTitle>
				<DialogContent>
					<Grid container spacing={2} sx={{ mt: 1 }}>
						<Grid item xs={12} sm={6}>
							<Autocomplete
								options={proPickerOptions}
								getOptionLabel={(option) =>
									option.isGeneralFuel
										? option.label
										: formatLoadProLabel(option)
								}
								value={selectedProPickerValue}
								onChange={(_, option) =>
									setFormData((prev) => ({
										...prev,
										proNumber:
											option?.isGeneralFuel || !option?.proNumber
												? ""
												: option.proNumber,
									}))
								}
								isOptionEqualToValue={(a, b) => {
									if (!a || !b) return false;
									if (a.isGeneralFuel && b.isGeneralFuel) return true;
									if (a.isGeneralFuel || b.isGeneralFuel) return false;
									return a.proNumber === b.proNumber;
								}}
								filterOptions={(options, { inputValue }) => {
									const q = inputValue.trim().toLowerCase();
									if (!q) return options;
									return options.filter((option) => {
										if (option.isGeneralFuel) {
											return option.label.toLowerCase().includes(q);
										}
										const label = formatLoadProLabel(option).toLowerCase();
										return (
											label.includes(q) ||
											String(option.proNumber).toLowerCase().includes(q)
										);
									});
								}}
								renderInput={(params) => (
									<TextField
										{...params}
										label="Load (optional)"
										margin="dense"
										placeholder="General fuel or search PRO"
										helperText={
											showPaidLoads
												? "General fuel or any unpaid load"
												: "General fuel or unpaid loads"
										}
									/>
								)}
							/>
							{!isEditing && (
								<FormControlLabel
									control={
										<Checkbox
											size="small"
											checked={showPaidLoads}
											onChange={(e) => setShowPaidLoads(e.target.checked)}
										/>
									}
									label="Show paid loads"
									sx={{ mt: 0.5 }}
								/>
							)}
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Date"
								type="date"
								name="dateOfStop"
								value={formData.dateOfStop || ""}
								onChange={handleInputChange}
								fullWidth
								required
								InputLabelProps={{ shrink: true }}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Vendor Name"
								name="vendorName"
								value={formData.vendorName || ""}
								onChange={handleInputChange}
								fullWidth
								required
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Diesel Gallons"
								type="number"
								name="gallonsDieselPurchased"
								value={formData.gallonsDieselPurchased || ""}
								onChange={handleInputChange}
								fullWidth
								required
								margin="dense"
								inputProps={{ step: "0.01" }}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Diesel Price/Gal"
								type="number"
								name="pumpPriceDiesel"
								value={formData.pumpPriceDiesel || ""}
								onChange={handleInputChange}
								fullWidth
								required
								margin="dense"
								inputProps={{ step: "0.001" }}
								InputProps={{
									startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="DEF Gallons"
								type="number"
								name="gallonsDefPurchased"
								value={formData.gallonsDefPurchased || ""}
								onChange={handleInputChange}
								fullWidth
								margin="dense"
								inputProps={{ step: "0.01" }}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="DEF Price/Gal"
								type="number"
								name="pumpPriceDef"
								value={formData.pumpPriceDef || ""}
								onChange={handleInputChange}
								fullWidth
								margin="dense"
								inputProps={{ step: "0.001" }}
								InputProps={{
									startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Odometer Reading"
								type="number"
								name="odometerReading"
								value={formData.odometerReading || ""}
								onChange={handleInputChange}
								fullWidth
								margin="dense"
								inputProps={{ step: "1" }}
								helperText="Optional; leave blank if you did not track mileage"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControlLabel
								control={
									<Checkbox
										checked={formData.fuelCardUsed || false}
										onChange={handleInputChange}
										name="fuelCardUsed"
									/>
								}
								label="Fuel Card Used ($1.00 Service Charge)"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControlLabel
								control={
									<Checkbox
										checked={formData.discountEligible || false} // Corrected typo here
										onChange={handleInputChange}
										name="discountEligible"
									/>
								}
								label="USX Discount Applied (.05/gal)"
							/>
						</Grid>

						{/* Calculated fields - Display only or omit from form as backend calculates them */}
						{isEditing && (
							<>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="Diesel Cost"
										value={`$${parseFloat(
											formData.costDieselPurchased || 0
										).toFixed(2)}`}
										fullWidth
										margin="dense"
										disabled
										InputProps={{
											startAdornment: (
												<Typography sx={{ mr: 0.5 }}>$</Typography>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="DEF Cost"
										value={`$${parseFloat(formData.totalDefCost || 0).toFixed(
											2
										)}`}
										fullWidth
										margin="dense"
										disabled
										InputProps={{
											startAdornment: (
												<Typography sx={{ mr: 0.5 }}>$</Typography>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="Total Fuel Cost"
										value={`$${parseFloat(
											formData.totalFuelStopCost || 0
										).toFixed(2)}`}
										fullWidth
										margin="dense"
										disabled
										InputProps={{
											startAdornment: (
												<Typography sx={{ mr: 0.5 }}>$</Typography>
											),
										}}
									/>
								</Grid>
							</>
						)}
					</Grid>
				</DialogContent>
				<DialogActions sx={{ p: "16px 24px" }}>
					<Button onClick={handleCloseModal} color="secondary">
						Cancel
					</Button>
					<Button type="submit" variant="contained" color="primary">
						{isEditing ? "Update Fuel Stop" : "Save Fuel Stop"}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Settlement Modal */}
			<Dialog
				open={isSettleModalOpen}
				onClose={handleCloseSettleModal}
				PaperProps={{ component: "form", onSubmit: handleSubmitSettleModal }}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Settle Fuel Stop</DialogTitle>
				<DialogContent>
					{fuelStopToSettle && (
						<Box sx={{ mb: 2 }}>
							{fuelStopToSettle.proNumber && (
								<Typography variant="body2" color="text.secondary">
									Load: {fuelStopToSettle.proNumber}
								</Typography>
							)}
							<Typography variant="body2" color="text.secondary">
								Vendor: {fuelStopToSettle.vendor}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Diesel Gallons: {fuelStopToSettle.gallonsDieselPurchased}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Pump Price: ${fuelStopToSettle.dieselPricePerGallon}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Total Diesel Cost: ${fuelStopToSettle.totalDieselCost}
							</Typography>
						</Box>
					)}
					<Grid container spacing={2}>
						<Grid item xs={12}>
							<TextField
								label="Settled Diesel Price Per Gallon"
								type="number"
								name="settledDieselPricePerGallon"
								value={settleFormData.settledDieselPricePerGallon || ""}
								onChange={(e) =>
									setSettleFormData({
										...settleFormData,
										settledDieselPricePerGallon: e.target.value,
									})
								}
								fullWidth
								required
								margin="dense"
								inputProps={{ step: "0.001" }}
								InputProps={{
									startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
								}}
								helperText="Enter the actual settled price per gallon you were paid"
							/>
						</Grid>
						{fuelStopToSettle && settleFormData.settledDieselPricePerGallon && (
							<Grid item xs={12}>
								<Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
									{(() => {
										const pumpPrice = parseFloat(
											fuelStopToSettle.dieselPricePerGallon
										);
										const settledPrice = parseFloat(
											settleFormData.settledDieselPricePerGallon
										);
										const gallons = parseFloat(
											fuelStopToSettle.gallonsDieselPurchased
										);
										const perGallonDelta = pumpPrice - settledPrice;
										const totalSavings = perGallonDelta * gallons;
										return (
											<>
									<Typography variant="subtitle2">
										Settlement Summary:
									</Typography>
									<Typography variant="body2">
										Pump Price: ${fuelStopToSettle.dieselPricePerGallon} per
										gallon
									</Typography>
									<Typography variant="body2">
										Settled Price: ${settleFormData.settledDieselPricePerGallon}{" "}
										per gallon
									</Typography>
									<Typography variant="body2">
										Difference: ${perGallonDelta.toFixed(3)}{" "}
										per gallon
									</Typography>
									<Typography variant="body2">
										Total Savings: ${totalSavings.toFixed(2)}
									</Typography>
											</>
										);
									})()}
								</Box>
							</Grid>
						)}
					</Grid>
				</DialogContent>
				<DialogActions sx={{ p: "16px 24px" }}>
					<Button onClick={handleCloseSettleModal} color="secondary">
						Cancel
					</Button>
					<Button type="submit" variant="contained" color="primary">
						Settle Fuel Stop
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}

export default FuelStops;
