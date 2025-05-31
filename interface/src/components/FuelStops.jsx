import { React, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom"; // Import useLocation and useNavigate
import {
	fetchFuelStops,
	addFuelStop,
	updateFuelStop,
	deleteFuelStop,
} from "../store/slices/fuelStopsSlice";
import { fetchLoads } from "../store/slices/loadsSlice"; // To populate PRO number dropdown
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
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	Grid,
	Checkbox,
	FormControlLabel,
	CircularProgress,
	Alert,
	Tooltip, // Added for icon button titles
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Helper to format date for display and for date inputs
const formatDateForDisplay = (dateString) => {
	console.log(
		"Raw dateString for display:",
		dateString,
		"Type:",
		typeof dateString
	);
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

	const initialFormData = {
		fuelCardUsed: false,
		proNumber: "", // Ensure proNumber is part of initial state for the form
		discountEligible: false, // Corrected typo here
	};
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({});
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		dispatch(fetchFuelStops());
		dispatch(fetchLoads()); // Fetch loads for the PRO number dropdown
	}, [dispatch]);

	useEffect(() => {
		// Check if we need to open the modal for a specific PRO number from dashboard
		if (location.state?.openModalForPro) {
			const proToPrefill = location.state.openModalForPro;
			setIsEditing(false);
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
		setFormData(initialFormData); // Reset form with defaults
		setIsModalOpen(true);
	};

	const handleEditFuelStop = (fuelStop) => {
		setIsEditing(true);
		// Ensure date is formatted correctly for the date input field
		// And map model field names (from fuelStop) to formData field names (used in form)
		setFormData({
			id: fuelStop.id, // Keep the id
			proNumber: fuelStop.proNumber,
			dateOfStop: formatDateForInput(fuelStop.dateOfStop),
			vendorName: fuelStop.vendor, // Map from 'vendor' (model) to 'vendorName' (form)
			location: fuelStop.location,
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
		});
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setFormData(initialFormData); // Reset form data
		setIsEditing(false);
	};

	const handleSubmitModal = async (e) => {
		e.preventDefault();
		const payload = {
			proNumber: formData.proNumber,
			dateOfStop: formData.dateOfStop
				? formatDateForInput(new Date(formData.dateOfStop))
				: null,
			vendorName: formData.vendorName,
			location: formData.location,
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

			{!loading && !error && fuelStops.length > 0 && (
				<TableContainer component={Paper} sx={{ boxShadow: 3 }}>
					<Table sx={{ minWidth: 650 }} aria-label="fuel stops table">
						<TableHead sx={{ backgroundColor: "grey.200" }}>
							<TableRow>
								<TableCell>Load PRO</TableCell>
								<TableCell>Date</TableCell>
								<TableCell>Vendor</TableCell>
								<TableCell>Location</TableCell>
								<TableCell align="right">Diesel Gal.</TableCell>
								<TableCell align="right">Diesel Price/Gal</TableCell>
								<TableCell align="right">Total Diesel Cost</TableCell>
								<TableCell align="right">DEF Gal.</TableCell>
								<TableCell align="right">DEF Price/Gal</TableCell>
								<TableCell align="right">Total DEF Cost</TableCell>
								<TableCell align="center">Card Used?</TableCell>
								<TableCell align="center">Discounted?</TableCell>
								<TableCell align="right">Total Stop Cost</TableCell>
								<TableCell align="center">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{fuelStops.map((fs) => (
								<TableRow
									key={fs.id}
									sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
								>
									<TableCell component="th" scope="row">
										{fs.proNumber}
									</TableCell>
									<TableCell>{formatDateForDisplay(fs.dateOfStop)}</TableCell>
									<TableCell>{fs.vendor}</TableCell>
									<TableCell>{fs.location || "N/A"}</TableCell>
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
										${(parseFloat(fs.totalDieselCost) || 0).toFixed(2)}
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
											? `$${parseFloat(fs.defPricePerGallon).toFixed(0)}`
											: "N/A"}
									</TableCell>
									<TableCell align="right">
										{/* Calculated: fs.totalDefCost. Defaults to $0.00 if null/undefined. */}
										{/* If totalDefCost can be 0 and should show $0.00, this is better: */}
										${(parseFloat(fs.totalDefCost) || 0).toFixed(2)}
									</TableCell>
									<TableCell align="center">
										{fs.fuelCardUsed ? "Yes" : "No"}
									</TableCell>
									<TableCell align="center">
										{fs.discountEligible ? "Yes" : "No"}
									</TableCell>
									<TableCell align="right">
										{/* Calculated: fs.totalFuelStop. Defaults to $0.00 if null/undefined. */}
										{(parseFloat(fs.totalFuelStop) || 0).toFixed(2)}
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
							<FormControl fullWidth margin="dense" required>
								<InputLabel id="proNumber-label">Load PRO Number</InputLabel>
								<Select
									labelId="proNumber-label"
									label="Load PRO Number"
									name="proNumber"
									value={formData.proNumber || ""}
									onChange={handleInputChange}
									disabled={isEditing}
								>
									<MenuItem value="">
										<em>Select Load</em>
									</MenuItem>
									{loads.map((load) => (
										<MenuItem key={load.proNumber} value={load.proNumber}>
											{load.proNumber} - {load.originCity} to{" "}
											{load.destinationCity}
										</MenuItem>
									))}
								</Select>
							</FormControl>
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
						<Grid item xs={12} sm={6}>
							<TextField
								margin="dense"
								label="Location (e.g., City, ST)"
								type="text"
								name="location"
								value={formData.location || ""}
								onChange={handleInputChange}
								fullWidth
								required
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
		</Box>
	);
}

export default FuelStops;
