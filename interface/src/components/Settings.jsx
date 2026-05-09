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
	Grid,
	TextField,
	Typography,
	CircularProgress,
	Alert,
	Snackbar,
	Box,
	Tabs,
	Tab,
	InputAdornment,
} from "@mui/material";
import {
	FIXED_EXPENSE_FIELDS,
	DEFAULT_FIXED_EXPENSE_AMOUNTS,
} from "../constants/fixedExpenses";

function TabPanel({ children, value, index }) {
	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`settings-tabpanel-${index}`}
		>
			{value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
		</div>
	);
}

const emptyFixedLocal = () =>
	Object.fromEntries(
		FIXED_EXPENSE_FIELDS.map(({ key }) => [key, ""])
	);

function Settings({ open, onClose }) {
	const dispatch = useDispatch();
	const {
		settings,
		loading,
		error: settingsError,
	} = useSelector((state) => state.userSettings);

	const [tab, setTab] = useState(0);
	const [localSettings, setLocalSettings] = useState({
		percentageRate: "",
		fuelRoadUseTax: "",
		maintenanceReserve: "",
		bondDeposit: "",
		mrpFee: "",
	});
	const [fixedLocal, setFixedLocal] = useState(emptyFixedLocal);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState(null);

	useEffect(() => {
		if (open) {
			dispatch(fetchUserSettings());
			setTab(0);
		}
	}, [dispatch, open]);

	useEffect(() => {
		if (settings) {
			const toPerMileStr = (v) =>
				v != null && v !== "" ? String(Number(v)) : "";
			setLocalSettings({
				percentageRate:
					settings.percentageRate != null
						? (settings.percentageRate * 100).toString()
						: "0",
				fuelRoadUseTax: toPerMileStr(settings.fuelRoadUseTax),
				maintenanceReserve: toPerMileStr(settings.maintenanceReserve),
				bondDeposit: toPerMileStr(settings.bondDeposit),
				mrpFee: toPerMileStr(settings.mrpFee),
			});
			const nextFixed = emptyFixedLocal();
			const src = settings.fixedExpenses || DEFAULT_FIXED_EXPENSE_AMOUNTS;
			for (const { key } of FIXED_EXPENSE_FIELDS) {
				const v = src[key];
				nextFixed[key] =
					v != null && v !== "" ? String(v) : "";
			}
			setFixedLocal(nextFixed);
		}
	}, [settings]);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setLocalSettings((prev) => ({ ...prev, [name]: value }));
		setSaveError(null);
	};

	const handleFixedChange = (key) => (e) => {
		const { value } = e.target;
		setFixedLocal((prev) => ({ ...prev, [key]: value }));
		setSaveError(null);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaveError(null);
		setSaveSuccess(false);

		const settingsToSave = {
			driverPayType: "percentage",
		};

		const percRate = parseFloat(localSettings.percentageRate);
		if (isNaN(percRate) || percRate < 0 || percRate > 100) {
			setSaveError("Linehaul rate (%) must be a number from 0 to 100.");
			return;
		}
		settingsToSave.percentageRate = percRate / 100;

		const parsePerMile = (raw, label) => {
			if (raw === undefined || String(raw).trim() === "") return 0;
			const n = parseFloat(raw);
			if (isNaN(n) || n < 0 || n > 1000) {
				setSaveError(`${label} must be a number from 0 to 1000 dollars per mile.`);
				return null;
			}
			return n;
		};

		const fuel = parsePerMile(localSettings.fuelRoadUseTax, "Fuel road use tax");
		if (fuel === null) return;
		settingsToSave.fuelRoadUseTax = fuel;

		const maint = parsePerMile(localSettings.maintenanceReserve, "Maintenance reserve");
		if (maint === null) return;
		settingsToSave.maintenanceReserve = maint;

		const bond = parsePerMile(localSettings.bondDeposit, "Bond deposit");
		if (bond === null) return;
		settingsToSave.bondDeposit = bond;

		const mrp = parsePerMile(localSettings.mrpFee, "MRP fee");
		if (mrp === null) return;
		settingsToSave.mrpFee = mrp;

		const fixedExpenses = {};
		for (const { key, label } of FIXED_EXPENSE_FIELDS) {
			const raw = fixedLocal[key];
			if (raw === undefined || String(raw).trim() === "") {
				fixedExpenses[key] = 0;
				continue;
			}
			const n = parseFloat(raw);
			if (isNaN(n) || n < 0) {
				setSaveError(`Invalid amount for ${label}. Use 0 or a positive number.`);
				return;
			}
			fixedExpenses[key] = n;
		}
		settingsToSave.fixedExpenses = fixedExpenses;

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
			<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
					{loading ? (
						<CircularProgress />
					) : (
						<form id="settings-form" onSubmit={handleSubmit}>
							<Tabs
								value={tab}
								onChange={(_, v) => setTab(v)}
								variant="scrollable"
								scrollButtons="auto"
								aria-label="Settings sections"
							>
								<Tab label="Pay & variable deductions" id="settings-tab-0" />
								<Tab label="Fixed expenses" id="settings-tab-1" />
							</Tabs>

							<TabPanel value={tab} index={0}>
								<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
									Deductions below are dollars per mile on the load. Linehaul rate
									(%) is your percentage share of linehaul pay on each load (not
									per mile).
								</Typography>
								<Grid container spacing={3}>
									<Grid item xs={12} sm={6}>
										<TextField
											label="Linehaul rate (%)"
											type="number"
											name="percentageRate"
											value={localSettings.percentageRate}
											onChange={handleInputChange}
											fullWidth
											helperText="Percentage of linehaul: 0–100 (e.g. 68 for 68%)"
											inputProps={{ min: "0", max: "100", step: "0.01" }}
										/>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											label="Fuel road use tax"
											type="number"
											name="fuelRoadUseTax"
											value={localSettings.fuelRoadUseTax}
											onChange={handleInputChange}
											fullWidth
											helperText="Dollars per mile"
											inputProps={{ min: "0", max: "1000", step: "0.001" }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">$</InputAdornment>
												),
											}}
										/>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											label="Maintenance reserve"
											type="number"
											name="maintenanceReserve"
											value={localSettings.maintenanceReserve}
											onChange={handleInputChange}
											fullWidth
											helperText="Dollars per mile"
											inputProps={{ min: "0", max: "1000", step: "0.001" }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">$</InputAdornment>
												),
											}}
										/>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											label="Bond deposit"
											type="number"
											name="bondDeposit"
											value={localSettings.bondDeposit}
											onChange={handleInputChange}
											fullWidth
											helperText="Dollars per mile"
											inputProps={{ min: "0", max: "1000", step: "0.001" }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">$</InputAdornment>
												),
											}}
										/>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											label="MRP fee"
											type="number"
											name="mrpFee"
											value={localSettings.mrpFee}
											onChange={handleInputChange}
											fullWidth
											helperText="Dollars per mile"
											inputProps={{ min: "0", max: "1000", step: "0.001" }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">$</InputAdornment>
												),
											}}
										/>
									</Grid>
								</Grid>
							</TabPanel>

							<TabPanel value={tab} index={1}>
								<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
									Fixed dollar amounts (per settlement period you use—typically
									weekly). Stored only for your account. Leave blank to treat as
									$0.
								</Typography>
								<Grid container spacing={2}>
									{FIXED_EXPENSE_FIELDS.map(({ key, label }) => (
										<Grid item xs={12} sm={6} key={key}>
											<TextField
												label={label}
												type="number"
												value={fixedLocal[key] ?? ""}
												onChange={handleFixedChange(key)}
												fullWidth
												inputProps={{ min: "0", step: "0.01" }}
												InputProps={{
													startAdornment: (
														<InputAdornment position="start">$</InputAdornment>
													),
												}}
											/>
										</Grid>
									))}
								</Grid>
							</TabPanel>
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
