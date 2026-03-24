import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	fetchUserSettings,
	saveUserSettings,
} from "../store/slices/userSettingsSlice";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	FormControlLabel,
	FormLabel,
	Grid,
	Radio,
	RadioGroup,
	TextField,
	Typography,
	CircularProgress,
	Alert,
	Snackbar,
} from "@mui/material";

function Settings({ open, onClose }) {
	const dispatch = useDispatch();
	const {
		settings,
		loading,
		error: settingsError,
	} = useSelector((state) => state.userSettings);

	const [localSettings, setLocalSettings] = useState({
		driverPayType: "",
		percentageRate: "",
		fuelRoadUseTax: "",
		maintenanceReserve: "",
		bondDeposit: "",
		mrpFee: "",
	});
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState(null);

	useEffect(() => {
		if (open) {
			dispatch(fetchUserSettings());
		}
	}, [dispatch, open]);

	useEffect(() => {
		if (settings) {
			setLocalSettings({
				driverPayType: settings.driverPayType || "percentage",
				percentageRate:
					settings.percentageRate != null
						? (settings.percentageRate * 100).toString()
						: "0",
				fuelRoadUseTax:
					settings.fuelRoadUseTax != null
						? (settings.fuelRoadUseTax * 100).toString()
						: "0",
				maintenanceReserve:
					settings.maintenanceReserve != null
						? (settings.maintenanceReserve * 100).toString()
						: "0",
				bondDeposit:
					settings.bondDeposit != null
						? (settings.bondDeposit * 100).toString()
						: "0",
				mrpFee:
					settings.mrpFee != null
						? (settings.mrpFee * 100).toString()
						: "0",
			});
		}
	}, [settings]);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setLocalSettings((prev) => ({ ...prev, [name]: value }));
		setSaveError(null);
	};

	const handleRadioChange = (e) => {
		setLocalSettings((prev) => ({ ...prev, driverPayType: e.target.value }));
		setSaveError(null);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaveError(null);
		setSaveSuccess(false);

		const settingsToSave = {
			driverPayType: localSettings.driverPayType,
		};

		if (localSettings.driverPayType === "percentage") {
			const percRate = parseFloat(localSettings.percentageRate);
			if (isNaN(percRate) || percRate < 0 || percRate > 100) {
				setSaveError("Percentage Rate must be a number between 0 and 100.");
				return;
			}
			settingsToSave.percentageRate = percRate / 100;
		} else {
			settingsToSave.percentageRate = null;
		}

		const fuelTaxRate = parseFloat(localSettings.fuelRoadUseTax);
		if (isNaN(fuelTaxRate) || fuelTaxRate < 0 || fuelTaxRate > 100) {
			setSaveError("Fuel Road Use Tax must be a number between 0 and 100.");
			return;
		}
		settingsToSave.fuelRoadUseTax = fuelTaxRate / 100;

		const maintenanceReserve = parseFloat(localSettings.maintenanceReserve);
		if (isNaN(maintenanceReserve) || maintenanceReserve < 0 || maintenanceReserve > 100) {
			setSaveError("Maintenance Reserve must be a number between 0 and 100.");
			return;
		}
		settingsToSave.maintenanceReserve = maintenanceReserve / 100;

		const bondDeposit = parseFloat(localSettings.bondDeposit);
		if (isNaN(bondDeposit) || bondDeposit < 0 || bondDeposit > 100) {
			setSaveError("Bond Deposit must be a number between 0 and 100.");
			return;
		}
		settingsToSave.bondDeposit = bondDeposit / 100;

		const mrpFee = parseFloat(localSettings.mrpFee);
		if (isNaN(mrpFee) || mrpFee < 0 || mrpFee > 100) {
			setSaveError("MRP Fee must be a number between 0 and 100.");
			return;
		}
		settingsToSave.mrpFee = mrpFee / 100;

		const resultAction = await dispatch(saveUserSettings(settingsToSave));
		if (saveUserSettings.fulfilled.match(resultAction)) {
			setSaveSuccess(true);
			setTimeout(() => onClose(), 1500);
		} else if (saveUserSettings.rejected.match(resultAction)) {
			setSaveError(
				resultAction.payload?.message ||
					resultAction.payload ||
					"Failed to save settings."
			);
		}
	};

	return (
		<>
			<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
				<DialogTitle>Settings</DialogTitle>
				<DialogContent dividers>
					{settingsError && (
						<Alert severity="error" sx={{ mb: 2 }}>
							Error loading settings:{" "}
							{typeof settingsError === "string"
								? settingsError
								: JSON.stringify(settingsError)}
						</Alert>
					)}
					{saveError && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{saveError}
						</Alert>
					)}
					{loading && !settings?.driverPayType ? (
						<CircularProgress />
					) : (
						<form id="settings-form" onSubmit={handleSubmit}>
							<Grid container spacing={3} sx={{ mt: 0 }}>
								<Grid item xs={12}>
									<FormControl component="fieldset">
										<FormLabel component="legend">Driver Pay Type</FormLabel>
										<RadioGroup
											row
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
											helperText="e.g. 68 for 68%"
											inputProps={{ min: "0", max: "100", step: "0.01" }}
										/>
									</Grid>
								)}

								{localSettings.driverPayType === "mileage" && (
									<Grid item xs={12}>
										<Typography variant="body2" color="textSecondary">
											Mileage-based pay configuration coming soon.
										</Typography>
									</Grid>
								)}

								<Grid item xs={12} sm={6}>
									<TextField
										label="Fuel Road Use Tax (cents)"
										type="number"
										name="fuelRoadUseTax"
										value={localSettings.fuelRoadUseTax}
										onChange={handleInputChange}
										fullWidth
										helperText="e.g. 7.5 for 7.5 cents"
										inputProps={{ min: "0", max: "100", step: "0.01" }}
									/>
								</Grid>
								<Grid item xs={12} sm={6}>
									<TextField
										label="Maintenance Reserve (%)"
										type="number"
										name="maintenanceReserve"
										value={localSettings.maintenanceReserve}
										onChange={handleInputChange}
										fullWidth
										helperText="e.g. 7.5 for 7.5%"
										inputProps={{ min: "0", max: "100", step: "0.01" }}
									/>
								</Grid>
								<Grid item xs={12} sm={6}>
									<TextField
										label="Bond Deposit (%)"
										type="number"
										name="bondDeposit"
										value={localSettings.bondDeposit}
										onChange={handleInputChange}
										fullWidth
										helperText="e.g. 7.5 for 7.5%"
										inputProps={{ min: "0", max: "100", step: "0.01" }}
									/>
								</Grid>
								<Grid item xs={12} sm={6}>
									<TextField
										label="MRP Fee (%)"
										type="number"
										name="mrpFee"
										value={localSettings.mrpFee}
										onChange={handleInputChange}
										fullWidth
										helperText="e.g. 7.5 for 7.5%"
										inputProps={{ min: "0", max: "100", step: "0.01" }}
									/>
								</Grid>
							</Grid>
						</form>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose}>Cancel</Button>
					<Button
						type="submit"
						form="settings-form"
						variant="contained"
						disabled={loading}
					>
						{loading ? <CircularProgress size={20} /> : "Save"}
					</Button>
				</DialogActions>
			</Dialog>
			<Snackbar
				open={saveSuccess}
				autoHideDuration={3000}
				onClose={() => setSaveSuccess(false)}
				message="Settings saved!"
			/>
		</>
	);
}

export default Settings;
