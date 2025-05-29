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
						? (settings.percentageRate * 100).toString()
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

		const payload = {
			driverPayType: localSettings.driverPayType,
		};

		if (localSettings.driverPayType === "percentage") {
			const rate = parseFloat(localSettings.percentageRate);
			if (isNaN(rate) || rate < 0 || rate > 100) {
				setSaveError("Percentage Rate must be a number between 0 and 100.");
				return;
			}
			payload.percentageRate = rate; // Send as 0-100, backend converts to 0.0-1.0
		}
		// No need to send percentageRate if type is mileage, backend will nullify it.

		const resultAction = await dispatch(saveUserSettings(payload));
		if (saveUserSettings.fulfilled.match(resultAction)) {
			setSaveSuccess(true);
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
