import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	fetchUserSettings,
	saveUserSettings,
} from "../store/slices/userSettingsSlice";
import {
	Box,
	Button,
	Container,
	FormControl,
	FormControlLabel,
	FormLabel,
	Grid,
	Paper,
	Radio,
	RadioGroup,
	TextField,
	Typography,
	CircularProgress,
	Alert,
	Snackbar,
} from "@mui/material";

function Settings() {
	const dispatch = useDispatch();
	const {
		settings,
		loading,
		error: settingsError, // Renamed to avoid conflict with local error state
	} = useSelector((state) => state.userSettings);

	const [localSettings, setLocalSettings] = useState({
		driverPayType: "",
		percentageRate: "",
		fuelRoadUseTax: "",
		// Consider adding other model fields here if they will be managed
		// maintenanceReserve: "",
		// bondDeposit: "",
	});
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState(null); // For errors from save operation

	useEffect(() => {
		dispatch(fetchUserSettings());
	}, [dispatch]);

	useEffect(() => {
		if (settings) {
			setLocalSettings({
				driverPayType: settings.driverPayType || "percentage",
				// Backend stores percentageRate as 0.0-1.0, display as 0-100
				percentageRate:
					settings.percentageRate !== null &&
					settings.percentageRate !== undefined
						? (settings.percentageRate * 100).toString() // Display as 0-100
						: "0", // Default to "0" if null/undefined
				fuelRoadUseTax:
					settings.fuelRoadUseTax !== null &&
					settings.fuelRoadUseTax !== undefined
						? (settings.fuelRoadUseTax * 100).toString() // Display as 0-100
						: "0", // Default to "0" or based on model's default (e.g., (0.01 * 100).toString())
				// Populate other settings from the model similarly:
				// maintenanceReserve: settings.maintenanceReserve !== null && settings.maintenanceReserve !== undefined ? (settings.maintenanceReserve * 100).toString() : "0",
				// bondDeposit: settings.bondDeposit !== null && settings.bondDeposit !== undefined ? (settings.bondDeposit * 100).toString() : "0",
				maintenanceReserve:
					settings.maintenanceReservex !== null &&
					settings.maintenanceReserve !== undefined
						? (settings.maintenanceReserve * 100).toString() // Display as 0-100
						: "0",
				bondDeposit:
					settings.bondDeposit !== null && settings.bondDeposit !== undefined
						? (settings.bondDeposit * 100).toString() // Display as 0-100
						: "0",
				mrpFee:
					settings.mrpFee !== null && settings.mrpFee !== undefined
						? (settings.mrpFee * 100).toString() // Display as 0-100
						: "0",
			});
		}
	}, [settings]);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setLocalSettings((prev) => ({ ...prev, [name]: value }));
		setSaveError(null); // Clear save error on input change
	};

	const handleRadioChange = (e) => {
		setLocalSettings((prev) => ({
			...prev,
			driverPayType: e.target.value,
			// If switching to mileage, we might want to clear or disable percentageRate input
			// For now, just updating driverPayType. Backend will nullify percentageRate if mileage.
		}));
		setSaveError(null);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaveError(null);
		setSaveSuccess(false);

		const settingsToSave = {
			driverPayType: localSettings.driverPayType,
			fuelRoadUseTax: localSettings.fuelRoadUseTax,
		};

		if (localSettings.driverPayType === "percentage") {
			const percRate = parseFloat(localSettings.percentageRate);
			if (isNaN(percRate) || percRate < 0 || percRate > 100) {
				setSaveError("Percentage Rate must be a number between 0 and 100.");
				return;
			}
			settingsToSave.percentageRate = percRate / 100; // Convert to 0.0-1.0 for backend
		} else {
			settingsToSave.percentageRate = null; // Explicitly nullify if not percentage type
		}

		// Handle fuelRoadUseTax (assuming UI input is 0-100)
		const fuelTaxRate = parseFloat(localSettings.fuelRoadUseTax);
		if (isNaN(fuelTaxRate) || fuelTaxRate < 0 || fuelTaxRate > 100) {
			setSaveError("Fuel Road Use Tax must be a number between 0 and 100.");
			return;
		}
		settingsToSave.fuelRoadUseTax = fuelTaxRate / 100; // Convert to 0.0-1.0 for backend

		const maintenanceReserve = parseFloat(localSettings.maintenanceReserve);
		if (
			isNaN(maintenanceReserve) ||
			maintenanceReserve < 0 ||
			maintenanceReserve > 100
		) {
			setSaveError("Maintenance Reserve must be a number between 0 and 100.");
			return;
		}
		settingsToSave.maintenanceReserve = maintenanceReserve / 100; // C
		//
		const bondDeposit = parseFloat(localSettings.bondDeposit);
		if (isNaN(bondDeposit) || bondDeposit < 0 || bondDeposit > 100) {
			setSaveError("Bond Deposit must be a number between 0 and 100.");
			return;
		}
		settingsToSave.bondDeposit = bondDeposit / 100; // Convert to 0.0-1.0 for backend

		const mrpFee = parseFloat(localSettings.mrpFee);
		if (isNaN(mrpFee) || mrpFee < 0 || mrpFee > 100) {
			setSaveError("MRP Fee must be a number between 0 and 100.");
			return;
		}
		settingsToSave.mrpFee = mrpFee / 100; // Convert to 0.0-1.0 for backend

		// TODO: Add other settings from your model to settingsToSave, converting them as needed
		// e.g., settingsToSave.maintenanceReserve = parseFloat(localSettings.maintenanceReserve) / 100;
		//      settingsToSave.bondDeposit = parseFloat(localSettings.bondDeposit) / 100;
		//      settingsToSave.mrpFee = parseFloat(localSettings.mrpFee) / 100;
		// Remember to add corresponding input fields and state management for these.

		const resultAction = await dispatch(saveUserSettings(settingsToSave));
		if (saveUserSettings.fulfilled.match(resultAction)) {
			setSaveSuccess(true);
			dispatch(fetchUserSettings()); // Optionally re-fetch to confirm
		} else if (saveUserSettings.rejected.match(resultAction)) {
			setSaveError(
				resultAction.payload?.message ||
					resultAction.payload ||
					"Failed to save settings."
			);
		}
	};

	const handleCloseSnackbar = () => {
		setSaveSuccess(false);
	};

	if (loading && !settings.driverPayType) {
		// Show full page loader only on initial load
		return (
			<Container sx={{ py: 4, display: "flex", justifyContent: "center" }}>
				<CircularProgress />
			</Container>
		);
	}

	return (
		<Container maxWidth="md" sx={{ py: 4 }}>
			<Paper elevation={3} sx={{ p: 4 }}>
				<Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
					User Settings
				</Typography>

				{settingsError && (
					<Alert severity="error" sx={{ mb: 2 }}>
						Error loading settings:{" "}
						{typeof settingsError === "string"
							? settingsError
							: JSON.stringify(settingsError)}
					</Alert>
				)}

				<form onSubmit={handleSubmit}>
					<Grid container spacing={3}>
						<Grid item xs={12}>
							<FormControl component="fieldset">
								<FormLabel component="legend">Driver Pay Type</FormLabel>
								<RadioGroup
									row
									aria-label="driver-pay-type"
									name="driverPayType"
									value={localSettings.driverPayType || "percentage"}
									onChange={handleRadioChange}
								>
									<FormControlLabel
										value="percentage"
										control={<Radio />}
										label="Percentage Based"
									/>
									<FormControlLabel
										value="mileage"
										control={<Radio />}
										label="Mileage Based"
									/>
								</RadioGroup>
							</FormControl>
						</Grid>

						{localSettings.driverPayType === "percentage" && (
							<Grid item xs={12} sm={6}>
								<TextField
									label="Percentage Rate (%)"
									type="number"
									name="percentageRate"
									value={localSettings.percentageRate}
									onChange={handleInputChange}
									fullWidth
									helperText="Enter value like 68 for 68%"
									inputProps={{ min: "0", max: "100", step: "0.01" }}
								/>
							</Grid>
						)}

						{/* Placeholder for Mileage Rate Tiers form section */}
						{localSettings.driverPayType === "mileage" && (
							<Grid item xs={12}>
								<Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
									Mileage Rate Configuration (Coming Soon)
								</Typography>
								<Typography variant="body2" color="textSecondary">
									Settings for mileage-based pay (e.g., rate per mile, FSC per
									mile tiers) will be configured here.
								</Typography>
							</Grid>
						)}
						<Grid item xs={12} sm={6}>
							<TextField
								label="Fuel Road Use Tax (cents)"
								type="number"
								name="fuelRoadUseTax" // Corrected name to match state key
								value={localSettings.fuelRoadUseTax}
								onChange={handleInputChange}
								fullWidth
								helperText="Enter value in cents (e.g., 7.5 for 7.5 cents)"
								inputProps={{ min: "0", max: "100", step: "0.01" }}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Maintenance Reserve (cents)"
								type="number"
								name="maintenanceReserve" // Corrected name to match state key
								value={localSettings.maintenanceReserve}
								onChange={handleInputChange}
								fullWidth
								helperText="Enter value in cents (e.g., 7.5 for 7.5 cents)"
								inputProps={{ min: "0", max: "100", step: "0.01" }}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Bond Deposit (cents)"
								type="number"
								name="bondDeposit" // Corrected name to match state key
								value={localSettings.bondDeposit}
								onChange={handleInputChange}
								fullWidth
								helperText="Enter value in cents (e.g., 7.5 for 7.5 cents)"
								inputProps={{ min: "0", max: "100", step: "0.01" }}
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="MRP Fee (cents)"
								type="number"
								name="mrpFee" // Corrected name to match state key
								value={localSettings.mrpFee}
								onChange={handleInputChange}
								fullWidth
								helperText="Enter value in cents (e.g., 7.5 for 7.5 cents)"
								inputProps={{ min: "0", max: "100", step: "0.01" }}
							/>
						</Grid>

						<Grid item xs={12} sx={{ mt: 2 }}>
							{saveError && (
								<Alert severity="error" sx={{ mb: 2 }}>
									{saveError}
								</Alert>
							)}
							<Button
								type="submit"
								variant="contained"
								color="primary"
								disabled={loading}
							>
								{loading ? <CircularProgress size={24} /> : "Save Settings"}
							</Button>
						</Grid>
					</Grid>
				</form>
			</Paper>
			<Snackbar
				open={saveSuccess}
				autoHideDuration={6000}
				onClose={handleCloseSnackbar}
				message="Settings saved successfully!"
			/>
		</Container>
	);
}

export default Settings;
