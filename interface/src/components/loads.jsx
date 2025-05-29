import { React, useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	fetchLoads,
	addLoad,
	updateLoad,
	deleteLoad,
} from "../store/slices/loadsSlice";
import { fetchFuelStops } from "../store/slices/fuelStopsSlice";
import {
	updateFormData,
	resetForm,
	setFormData,
} from "../store/slices/formSlice";
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
	DialogContentText,
	DialogTitle,
	TextField,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	Grid,
	CircularProgress,
	Alert,
	Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

// Helper function to format date strings to YYYY-MM-DD for input fields
const formatDateForInput = (dateString) => {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			// If direct parsing fails, and it might be a date without time, try adding UTC time
			// This is for cases where dateString might be "YYYY-MM-DD" and new Date() treats it as local.
			// By processing as UTC, we ensure consistency.
			const parts = String(dateString).split("T")[0].split("-");
			if (parts.length === 3) {
				const year = parseInt(parts[0], 10);
				const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
				const day = parseInt(parts[2], 10);
				const utcDate = new Date(Date.UTC(year, month, day));
				if (!isNaN(utcDate.getTime())) {
					return utcDate.toISOString().split("T")[0];
				}
			}
			return ""; // Still invalid
		}
		// For dates that parsed correctly (e.g., full ISO strings)
		return date.toISOString().split("T")[0];
	} catch (e) {
		return "";
	}
};

// Helper function to format date strings for display
const formatDateForDisplay = (dateString, defaultText = "N/A") => {
	if (!dateString || String(dateString).trim() === "") return defaultText;
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			// Attempt to parse as YYYY-MM-DD if direct parse fails
			const dateWithFixedTime = new Date(dateString + "T00:00:00Z"); // Assume UTC if only date part
			if (isNaN(dateWithFixedTime.getTime())) {
				return "Invalid Date";
			}
			return dateWithFixedTime.toLocaleDateString(undefined, {
				timeZone: "UTC",
			});
		}
		// Use UTC for display to show the date as intended
		return date.toLocaleDateString(undefined, { timeZone: "UTC" });
	} catch (e) {
		return "Invalid Date";
	}
};

function Loads() {
	const dispatch = useDispatch();
	const {
		list: loadsForTable,
		loading: loadsLoading,
		error: loadsError,
	} = useSelector(
		(state) => state.loads || { list: [], loading: false, error: null }
	);
	const { list: allFuelStops } = useSelector(
		(state) => state.fuelStops || { list: [] }
	);
	const { settings: userSettings, loading: settingsLoading } = useSelector(
		(state) => state.userSettings || { settings: {}, loading: false }
	);
	const formData = useSelector((state) => state.form || {});
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalError, setModalError] = useState(null);

	useEffect(() => {
		dispatch(fetchLoads());
		dispatch(fetchFuelStops());
	}, [dispatch]);

	// Helper function to calculate total fuel cost for a load
	const calculateTotalFuelCost = (proNumber, fuelStopsList) => {
		if (!fuelStopsList || fuelStopsList.length === 0) return 0;
		return fuelStopsList
			.filter((stop) => stop.proNumber === proNumber)
			.reduce((sum, stop) => sum + (parseFloat(stop.totalFuelStop) || 0), 0);
	};

	// Sort loads: active load first, then by dateDelivered descending
	const sortedLoadsForTable = [...loadsForTable].sort((a, b) => {
		const aIsActive = !a.dateDelivered;
		const bIsActive = !b.dateDelivered;

		if (aIsActive && !bIsActive) return -1; // a (active) comes before b (completed)
		if (!aIsActive && bIsActive) return 1; // b (active) comes before a (completed)

		// If both are active or both are completed, sort by dateDelivered (descending for completed)
		if (a.dateDelivered && b.dateDelivered) {
			return new Date(b.dateDelivered) - new Date(a.dateDelivered);
		}
		return 0; // Should not happen if one is active, or for two active loads (no dateDelivered to sort by)
	});

	const handleAddLoad = () => {
		dispatch(resetForm());
		setModalError(null);
		setIsModalOpen(true);
	};

	const handleEditLoad = (load) => {
		const formattedLoad = {
			...load,
			dateDispatched: formatDateForInput(load.dateDispatched),
			dateDelivered: formatDateForInput(load.dateDelivered),
		};
		dispatch(setFormData(formattedLoad));
		setModalError(null);
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		dispatch(resetForm());
		setModalError(null);
	};

	// Memoized values for modal calculations based on formData and userSettings
	const { calculatedGrossModal, projectedNetModal, totalMilesModal } =
		useMemo(() => {
			const linehaul = parseFloat(formData.linehaul) || 0;
			const fsc = parseFloat(formData.fsc) || 0; // For percentage: total FSC
			const fscPerLoadedMile = parseFloat(formData.fscPerLoadedMile) || 0; // For mileage
			const deadheadMiles = parseFloat(formData.deadheadMiles) || 0;
			const loadedMiles = parseFloat(formData.loadedMiles) || 0;
			const scaleCost = parseFloat(formData.scaleCost) || 0;

			const actualFuelCost = calculateTotalFuelCost(
				formData.proNumber,
				allFuelStops
			);
			const currentTotalMiles = deadheadMiles + loadedMiles;

			let gross = 0;

			if (userSettings?.driverPayType === "mileage") {
				let mileageRate = 0;
				if (currentTotalMiles > 0 && currentTotalMiles <= 200)
					mileageRate = 2.0;
				else if (currentTotalMiles >= 201 && currentTotalMiles <= 400)
					mileageRate = 1.37;
				else if (currentTotalMiles >= 401 && currentTotalMiles <= 600)
					mileageRate = 1.13;
				else if (currentTotalMiles >= 601) mileageRate = 1.02;

				const mileageRevenue = currentTotalMiles * mileageRate;
				const fscRevenue = loadedMiles * fscPerLoadedMile;
				gross = mileageRevenue + fscRevenue;
			} else {
				// Default to percentage
				const percentageRate = userSettings?.percentageRate || 0; // Default to 0 if not set
				gross = linehaul * percentageRate + fsc;
			}

			const net = gross - actualFuelCost - scaleCost;
			return {
				calculatedGrossModal: gross,
				projectedNetModal: net,
				totalMilesModal: currentTotalMiles,
			};
		}, [formData, userSettings, allFuelStops, formData.proNumber]);

	const handleSubmitModal = async (e) => {
		e.preventDefault();
		setModalError(null);

		const isAttemptingActive =
			!formData.dateDelivered || formData.dateDelivered.trim() === "";
		let anotherActiveLoadExists = false;

		if (isAttemptingActive) {
			anotherActiveLoadExists = loadsForTable.some((load) => {
				if (formData.proNumber && load.proNumber === formData.proNumber) {
					return false;
				}
				return !load.dateDelivered;
			});
		}

		if (isAttemptingActive && anotherActiveLoadExists) {
			setModalError(
				"Another load is already active. You can only have one active load at a time. Please provide a delivery date or complete the other active load."
			);
			return;
		}

		const payload = {
			...formData,
			dateDispatched: formData.dateDispatched || null,
			dateDelivered: formData.dateDelivered || null,
			deadheadMiles: parseFloat(formData.deadheadMiles) || 0,
			loadedMiles: parseFloat(formData.loadedMiles) || 0,
			weight: parseFloat(formData.weight) || 0,
			driverPayType: userSettings?.driverPayType,
			linehaul:
				userSettings?.driverPayType === "percentage"
					? parseFloat(formData.linehaul) || 0
					: null,
			fsc:
				userSettings?.driverPayType === "percentage"
					? parseFloat(formData.fsc) || 0
					: null,
			fscPerLoadedMile:
				userSettings?.driverPayType === "mileage"
					? parseFloat(formData.fscPerLoadedMile) || 0
					: null,
			calculatedGross: calculatedGrossModal,
			projectedNet: projectedNetModal,
			scaleCost: parseFloat(formData.scaleCost) || 0,
		};

		if (
			payload.id ||
			(payload.proNumber &&
				loadsForTable.some((load) => load.proNumber === payload.proNumber))
		) {
			await dispatch(
				updateLoad({ proNumber: payload.proNumber, load: payload })
			);
		} else {
			await dispatch(addLoad(payload));
		}
		handleCloseModal();
	};

	const handleDelete = async (proNumber) => {
		await dispatch(deleteLoad(proNumber));
	};

	const handleCompleteLoad = async (loadToComplete) => {
		const currentDate = new Date();
		const year = currentDate.getFullYear();
		const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
		const day = currentDate.getDate().toString().padStart(2, "0");
		const formattedDate = `${year}-${month}-${day}`;

		const updatedLoadData = {
			...loadToComplete,
			dateDelivered: formattedDate,
		};
		await dispatch(
			updateLoad({ proNumber: loadToComplete.proNumber, load: updatedLoadData })
		);
	};

	const states = [
		"AL",
		"AK",
		"AZ",
		"AR",
		"CA",
		"CO",
		"CT",
		"DE",
		"FL",
		"GA",
		"HI",
		"ID",
		"IL",
		"IN",
		"IA",
		"KS",
		"KY",
		"LA",
		"ME",
		"MD",
		"MA",
		"MI",
		"MN",
		"MS",
		"MO",
		"MT",
		"NE",
		"NV",
		"NH",
		"NJ",
		"NM",
		"NY",
		"NC",
		"ND",
		"OH",
		"OK",
		"OR",
		"PA",
		"RI",
		"SC",
		"SD",
		"TN",
		"TX",
		"UT",
		"VT",
		"VA",
		"WA",
		"WV",
		"WI",
		"WY",
	];

	const isEditing =
		formData.proNumber &&
		loadsForTable.some((l) => l.proNumber === formData.proNumber);

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
					Loads Management
				</Typography>
				<Button variant="contained" onClick={handleAddLoad}>
					Add New Load
				</Button>
			</Box>

			{(loadsLoading || settingsLoading) && (
				<CircularProgress sx={{ display: "block", margin: "20px auto" }} />
			)}
			{loadsError && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{loadsError}
				</Alert>
			)}

			{!loadsLoading &&
				!settingsLoading &&
				!loadsError &&
				sortedLoadsForTable.length === 0 && (
					<Paper sx={{ textAlign: "center", p: 3, mt: 2 }}>
						<Typography variant="subtitle1">
							No loads found. Click "Add New Load" to get started.
						</Typography>
					</Paper>
				)}

			{!loadsLoading &&
				!settingsLoading &&
				!loadsError &&
				sortedLoadsForTable.length > 0 && (
					<TableContainer component={Paper} sx={{ boxShadow: 3 }}>
						<Table sx={{ minWidth: 650 }} aria-label="loads table">
							<TableHead sx={{ backgroundColor: "grey.200" }}>
								<TableRow>
									<TableCell>PRO Number</TableCell>
									<TableCell>Date Dispatched</TableCell>
									<TableCell>Date Delivered</TableCell>
									<TableCell>Trailer Number</TableCell>
									<TableCell>Origin</TableCell>
									<TableCell>Destination</TableCell>
									<TableCell align="right">Deadhead Miles</TableCell>
									<TableCell align="right">Loaded Miles</TableCell>
									<TableCell align="right">Weight</TableCell>
									{userSettings?.driverPayType === "percentage" && (
										<TableCell align="right">Linehaul</TableCell>
									)}
									<TableCell align="right">FSC / Rate</TableCell>
									<TableCell align="right">Calculated Gross</TableCell>
									<TableCell align="right">Fuel Cost</TableCell>
									<TableCell align="right">Scale Cost</TableCell>
									<TableCell align="right">Projected Net</TableCell>
									<TableCell align="center">Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{sortedLoadsForTable.map((load) => (
									<TableRow
										key={load.proNumber}
										sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
									>
										<TableCell component="th" scope="row">
											{load.proNumber}
										</TableCell>
										<TableCell>
											{formatDateForDisplay(load.dateDispatched)}
										</TableCell>
										<TableCell>
											{load.dateDelivered ? (
												formatDateForDisplay(load.dateDelivered)
											) : (
												<Typography
													color="text.secondary"
													variant="caption"
													sx={{ fontStyle: "italic" }}
												>
													In Transit
												</Typography>
											)}
										</TableCell>
										<TableCell>{load.trailerNumber || "N/A"}</TableCell>
										<TableCell>{`${load.originCity || ""}, ${
											load.originState || ""
										}`}</TableCell>
										<TableCell>{`${load.destinationCity || ""}, ${
											load.destinationState || ""
										}`}</TableCell>
										<TableCell align="right">{load.deadheadMiles}</TableCell>
										<TableCell align="right">{load.loadedMiles}</TableCell>
										<TableCell align="right">{load.weight}</TableCell>
										{userSettings?.driverPayType === "percentage" && (
											<TableCell align="right">
												{load.driverPayType === "percentage" &&
												load.linehaul !== null
													? `$${(load.linehaul || 0).toFixed(2)}`
													: "N/A"}
											</TableCell>
										)}
										<TableCell align="right">
											{load.driverPayType === "percentage" && load.fsc !== null
												? `$${(load.fsc || 0).toFixed(2)} (Total)`
												: load.driverPayType === "mileage" &&
												  load.fscPerLoadedMile !== null
												? `$${(load.fscPerLoadedMile || 0).toFixed(2)}`
												: "N/A"}
										</TableCell>
										<TableCell align="right">
											{`$${(load.calculatedGross || 0).toFixed(2)}`}
										</TableCell>
										<TableCell align="right">
											$
											{calculateTotalFuelCost(
												load.proNumber,
												allFuelStops
											).toFixed(2)}
										</TableCell>
										<TableCell align="right">
											{`$${(load.scaleCost || 0).toFixed(2)}`}
										</TableCell>
										<TableCell align="right">
											{`$${(load.projectedNet || 0).toFixed(2)}`}
										</TableCell>
										<TableCell align="center">
											{!load.dateDelivered && (
												<IconButton
													onClick={() => handleCompleteLoad(load)}
													color="success"
													size="small"
													title="Complete Load"
												>
													<CheckCircleOutlineIcon />
												</IconButton>
											)}
											<IconButton
												onClick={() => handleEditLoad(load)}
												color="primary"
												size="small"
											>
												<EditIcon />
											</IconButton>
											<IconButton
												onClick={() => handleDelete(load.proNumber)}
												color="error"
												size="small"
											>
												<DeleteIcon />
											</IconButton>
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
				<DialogTitle>{isEditing ? "Edit Load" : "Add New Load"}</DialogTitle>
				<DialogContent>
					{modalError && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{modalError}
						</Alert>
					)}
					<Grid container spacing={2} sx={{ mt: 1 }}>
						<Grid item xs={12} sm={6}>
							<TextField
								label="PRO Number"
								name="proNumber"
								value={formData.proNumber || ""}
								onChange={(e) =>
									dispatch(updateFormData({ proNumber: e.target.value }))
								}
								fullWidth
								required
								disabled={isEditing}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Date Dispatched"
								type="date"
								name="dateDispatched"
								value={formData.dateDispatched || ""}
								onChange={(e) =>
									dispatch(updateFormData({ dateDispatched: e.target.value }))
								}
								fullWidth
								required
								InputLabelProps={{ shrink: true }}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Date Delivered"
								type="date"
								name="dateDelivered"
								value={formData.dateDelivered || ""}
								onChange={(e) =>
									dispatch(updateFormData({ dateDelivered: e.target.value }))
								}
								fullWidth
								InputLabelProps={{ shrink: true }}
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Trailer Number"
								name="trailerNumber"
								value={formData.trailerNumber || ""}
								onChange={(e) =>
									dispatch(updateFormData({ trailerNumber: e.target.value }))
								}
								fullWidth
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Origin City"
								name="originCity"
								value={formData.originCity || ""}
								onChange={(e) =>
									dispatch(updateFormData({ originCity: e.target.value }))
								}
								fullWidth
								required
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControl fullWidth margin="dense" required>
								<InputLabel id="origin-state-label">Origin State</InputLabel>
								<Select
									labelId="origin-state-label"
									label="Origin State"
									name="originState"
									value={formData.originState || ""}
									onChange={(e) =>
										dispatch(updateFormData({ originState: e.target.value }))
									}
								>
									<MenuItem value="">
										<em>Select State</em>
									</MenuItem>
									{states.map((state) => (
										<MenuItem key={`origin-${state}`} value={state}>
											{state}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Destination City"
								name="destinationCity"
								value={formData.destinationCity || ""}
								onChange={(e) =>
									dispatch(updateFormData({ destinationCity: e.target.value }))
								}
								fullWidth
								required
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControl fullWidth margin="dense" required>
								<InputLabel id="destination-state-label">
									Destination State
								</InputLabel>
								<Select
									labelId="destination-state-label"
									label="Destination State"
									name="destinationState"
									value={formData.destinationState || ""}
									onChange={(e) =>
										dispatch(
											updateFormData({ destinationState: e.target.value })
										)
									}
								>
									<MenuItem value="">
										<em>Select State</em>
									</MenuItem>
									{states.map((state) => (
										<MenuItem key={`dest-${state}`} value={state}>
											{state}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Deadhead Miles"
								type="number"
								name="deadheadMiles"
								value={formData.deadheadMiles || ""}
								onChange={(e) =>
									dispatch(updateFormData({ deadheadMiles: e.target.value }))
								}
								fullWidth
								required
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Loaded Miles"
								type="number"
								name="loadedMiles"
								value={formData.loadedMiles || ""}
								onChange={(e) =>
									dispatch(updateFormData({ loadedMiles: e.target.value }))
								}
								fullWidth
								required
								margin="dense"
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Weight (lbs)"
								type="number"
								name="weight"
								value={formData.weight || ""}
								onChange={(e) =>
									dispatch(updateFormData({ weight: e.target.value }))
								}
								fullWidth
								required
								margin="dense"
							/>
						</Grid>
						{userSettings?.driverPayType === "percentage" && (
							<>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="Linehaul ($"
										type="number"
										name="linehaul"
										value={formData.linehaul || ""}
										onChange={(e) =>
											dispatch(updateFormData({ linehaul: e.target.value }))
										}
										fullWidth
										required
										margin="dense"
										InputProps={{
											startAdornment: (
												<Typography sx={{ mr: 0.5 }}>$</Typography>
											),
										}}
									/>
								</Grid>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="Total FSC ($"
										type="number"
										name="fsc"
										value={formData.fsc || ""}
										onChange={(e) =>
											dispatch(updateFormData({ fsc: e.target.value }))
										}
										fullWidth
										required
										margin="dense"
										InputProps={{
											startAdornment: (
												<Typography sx={{ mr: 0.5 }}>$</Typography>
											),
										}}
									/>
								</Grid>
							</>
						)}
						{userSettings?.driverPayType === "mileage" && (
							<>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="FSC per Loaded Mile ($"
										type="number"
										name="fscPerLoadedMile"
										value={formData.fscPerLoadedMile || ""}
										onChange={(e) =>
											dispatch(
												updateFormData({ fscPerLoadedMile: e.target.value })
											)
										}
										fullWidth
										required
										margin="dense"
										InputProps={{
											startAdornment: (
												<Typography sx={{ mr: 0.5 }}>$</Typography>
											),
										}}
										inputProps={{ step: "0.001" }}
									/>
								</Grid>
								<Grid item xs={12} sm={6} md={3}>
									<TextField
										label="Total Miles"
										value={totalMilesModal.toFixed(0)}
										fullWidth
										margin="dense"
										disabled
									/>
								</Grid>
							</>
						)}
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Calculated Gross"
								value={calculatedGrossModal.toFixed(2)}
								fullWidth
								margin="dense"
								disabled
								InputProps={{
									startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Scale Cost"
								type="number"
								name="scaleCost"
								value={formData.scaleCost || ""}
								onChange={(e) =>
									dispatch(updateFormData({ scaleCost: e.target.value }))
								}
								fullWidth
								margin="dense"
								InputProps={{
									startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
								}}
							/>
						</Grid>
						<Grid item xs={12} sm={6} md={3}>
							<TextField
								label="Projected Net"
								value={projectedNetModal.toFixed(2)}
								fullWidth
								margin="dense"
								disabled
								InputProps={{
									startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
								}}
							/>
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions sx={{ p: "16px 24px" }}>
					<Button onClick={handleCloseModal} color="secondary">
						Cancel
					</Button>
					<Button type="submit" variant="contained" color="primary">
						{isEditing ? "Update Load" : "Save Load"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}

export default Loads;
