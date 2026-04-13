import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	addLoad,
	updateLoad,
} from "../store/slices/loadsSlice";
import {
	updateFormData,
	resetForm,
} from "../store/slices/formSlice";
import {
	Box,
	Button,
	Typography,
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
	Alert,
} from "@mui/material";
import {
	parseOdometerField,
	computeClientOdometerDerived,
	US_STATES,
} from "./loadFormUtils";

/**
 * Add / edit load modal. Uses shared Redux `form` slice. Parent must pass `onClose`
 * that clears form state (e.g. dispatch resetForm) and sets `open` false.
 */
function LoadFormDialog({ open, onClose }) {
	const dispatch = useDispatch();
	const {
		list: loadsForTable,
	} = useSelector((state) => state.loads || { list: [] });
	const { list: allFuelStops } = useSelector(
		(state) => state.fuelStops || { list: [] }
	);
	const { settings: userSettings } = useSelector(
		(state) => state.userSettings || { settings: {} }
	);
	const formData = useSelector((state) => state.form || {});
	const [modalError, setModalError] = useState(null);

	const handleClose = () => {
		setModalError(null);
		onClose();
	};

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		dispatch(updateFormData({ [name]: value }));
	};

	const calculateTotalFuelCost = (proNumber, fuelStopsList) => {
		if (!fuelStopsList || fuelStopsList.length === 0) return 0;
		return fuelStopsList
			.filter((stop) => stop.proNumber === proNumber)
			.reduce((sum, stop) => sum + (parseFloat(stop.totalFuelStop) || 0), 0);
	};

	const {
		calculatedGrossModal,
		projectedNetModal,
		totalMilesModal,
		totalDeductionsModal,
	} = useMemo(() => {
		const linehaul = parseFloat(formData.linehaul) || 0;
		const fsc = parseFloat(formData.fsc) || 0;
		const fscPerLoadedMile = parseFloat(formData.fscPerLoadedMile) || 0;
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
			if (currentTotalMiles > 0 && currentTotalMiles <= 200) mileageRate = 2.0;
			else if (currentTotalMiles >= 201 && currentTotalMiles <= 400)
				mileageRate = 1.37;
			else if (currentTotalMiles >= 401 && currentTotalMiles <= 600)
				mileageRate = 1.13;
			else if (currentTotalMiles >= 601) mileageRate = 1.02;

			const mileageRevenue = currentTotalMiles * mileageRate;
			const fscRevenue = loadedMiles * fscPerLoadedMile;
			gross = mileageRevenue + fscRevenue;
		} else {
			const percentageRate = userSettings?.percentageRate || 0;
			gross = linehaul * percentageRate + fsc;
		}
		const fuelRoadUseTaxRate = parseFloat(userSettings?.fuelRoadUseTax) || 0;
		const maintenanceReserveRate =
			parseFloat(userSettings?.maintenanceReserve) || 0;
		const bondDepositRate = parseFloat(userSettings?.bondDeposit) || 0;
		const mrpFeeRate = parseFloat(userSettings?.mrpFee) || 0;

		const fuelRoadUseDeduction = currentTotalMiles * fuelRoadUseTaxRate;
		const maintenanceReserveDeduction =
			currentTotalMiles * maintenanceReserveRate;
		const bondDepositDeduction = currentTotalMiles * bondDepositRate;
		const mrpFeeDeduction = currentTotalMiles * mrpFeeRate;

		const totalDeductions =
			fuelRoadUseDeduction +
			maintenanceReserveDeduction +
			bondDepositDeduction +
			mrpFeeDeduction;

		const net = gross - totalDeductions - scaleCost - actualFuelCost;

		return {
			calculatedGrossModal: Math.round(gross * 100) / 100,
			projectedNetModal: Math.round(net * 100) / 100,
			totalMilesModal: currentTotalMiles,
			totalDeductionsModal: Math.round(totalDeductions * 100) / 100,
		};
	}, [formData, userSettings, allFuelStops]);

	const odometerDerived = useMemo(
		() =>
			computeClientOdometerDerived(
				formData.startingOdometer,
				formData.loadedStartOdometer,
				formData.endingOdometer
			),
		[
			formData.startingOdometer,
			formData.loadedStartOdometer,
			formData.endingOdometer,
		]
	);

	const isFormActiveLoad =
		!formData.dateDelivered || String(formData.dateDelivered).trim() === "";
	const isFormDelivered =
		Boolean(formData.dateDelivered) &&
		String(formData.dateDelivered).trim() !== "";

	const isEditing = !!(
		formData.proNumber &&
		loadsForTable.some((l) => l.proNumber === formData.proNumber)
	);

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

		const startOd = parseOdometerField(formData.startingOdometer);
		if (isAttemptingActive && startOd === null) {
			setModalError("Starting odometer is required for an active load.");
			return;
		}

		const hasDeliveryDate =
			Boolean(formData.dateDelivered) &&
			String(formData.dateDelivered).trim() !== "";
		if (hasDeliveryDate) {
			const pickOd = parseOdometerField(formData.loadedStartOdometer);
			const endOd = parseOdometerField(formData.endingOdometer);
			if (startOd === null || pickOd === null || endOd === null) {
				setModalError(
					"Delivered loads require starting odometer, odometer at pickup (loaded start), and ending odometer."
				);
				return;
			}
			if (!(startOd < pickOd && pickOd < endOd)) {
				setModalError(
					"Odometer readings must satisfy starting < pickup (loaded start) < ending."
				);
				return;
			}
		}

		const currentTotalMiles =
			(parseFloat(formData.deadheadMiles) || 0) +
			(parseFloat(formData.loadedMiles) || 0);
		const fuelRoadUseDeduction =
			currentTotalMiles * (parseFloat(userSettings?.fuelRoadUseTax) || 0);
		const maintenanceReserveDeduction =
			currentTotalMiles * (parseFloat(userSettings?.maintenanceReserve) || 0);
		const bondDepositDeduction =
			currentTotalMiles * (parseFloat(userSettings?.bondDeposit) || 0);
		const mrpFeeDeduction =
			currentTotalMiles * (parseFloat(userSettings?.mrpFee) || 0);

		const payload = {
			...formData,
			dateDispatched: formData.dateDispatched || null,
			dateDelivered: formData.dateDelivered || null,
			deadheadMiles: parseFloat(formData.deadheadMiles) || 0,
			loadedMiles: parseFloat(formData.loadedMiles) || 0,
			weight: parseFloat(formData.weight) || 0,
			startingOdometer: startOd,
			loadedStartOdometer: parseOdometerField(formData.loadedStartOdometer),
			endingOdometer: parseOdometerField(formData.endingOdometer),
			actualDeadheadMiles: odometerDerived.actualDeadheadMiles,
			actualLoadedMiles: odometerDerived.actualLoadedMiles,
			actualMiles: odometerDerived.actualMiles,
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
			calculatedDeductions: totalDeductionsModal,

			fuelRoadUseTax: fuelRoadUseDeduction,
			maintenanceReserve: maintenanceReserveDeduction,
			bondDeposit: bondDepositDeduction,
			mrpFee: mrpFeeDeduction,
		};

		try {
			if (
				payload.id ||
				(payload.proNumber &&
					loadsForTable.some((load) => load.proNumber === payload.proNumber))
			) {
				await dispatch(
					updateLoad({ proNumber: payload.proNumber, load: payload })
				).unwrap();
			} else {
				const { id, createdAt, updatedAt, ...createPayload } = payload;
				await dispatch(addLoad(createPayload)).unwrap();
			}
			handleClose();
		} catch (err) {
			const msg =
				typeof err === "string"
					? err
					: err?.message || "Could not save load. Please try again.";
			setModalError(msg);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
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
								{US_STATES.map((state) => (
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
								{US_STATES.map((state) => (
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
									name="totalMiles"
									value={totalMilesModal.toFixed(0)}
									fullWidth
									margin="dense"
									disabled={true}
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
							disabled={true}
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
							label="Starting Odometer"
							type="number"
							name="startingOdometer"
							value={formData.startingOdometer ?? ""}
							onChange={handleInputChange}
							fullWidth
							margin="dense"
							required={isFormActiveLoad}
							inputProps={{ step: "1" }}
							helperText={
								isFormActiveLoad
									? "Required before dispatch (tax / odometer tracking)"
									: ""
							}
						/>
					</Grid>
					<Grid item xs={12} sm={6} md={3}>
						<TextField
							label="Odometer at pickup (loaded start)"
							type="number"
							name="loadedStartOdometer"
							value={formData.loadedStartOdometer ?? ""}
							onChange={handleInputChange}
							fullWidth
							margin="dense"
							required={isFormDelivered}
							inputProps={{ step: "1" }}
							helperText={
								isFormDelivered
									? "Required when delivery date is set"
									: "After deadhead, before loaded miles"
							}
						/>
					</Grid>
					<Grid item xs={12} sm={6} md={3}>
						<TextField
							label="Ending Odometer"
							type="number"
							name="endingOdometer"
							value={formData.endingOdometer ?? ""}
							onChange={handleInputChange}
							fullWidth
							margin="dense"
							required={isFormDelivered}
							inputProps={{ step: "1" }}
							helperText={
								isFormDelivered ? "Required when delivery date is set" : ""
							}
						/>
					</Grid>
					<Grid item xs={12} sm={6} md={3}>
						<TextField
							label="Actual deadhead miles"
							value={
								odometerDerived.actualDeadheadMiles != null
									? String(odometerDerived.actualDeadheadMiles)
									: ""
							}
							fullWidth
							margin="dense"
							disabled
							helperText="Pickup − start (tax)"
						/>
					</Grid>
					<Grid item xs={12} sm={6} md={3}>
						<TextField
							label="Actual loaded miles"
							value={
								odometerDerived.actualLoadedMiles != null
									? String(odometerDerived.actualLoadedMiles)
									: ""
							}
							fullWidth
							margin="dense"
							disabled
							helperText="End − pickup"
						/>
					</Grid>
					<Grid item xs={12} sm={6} md={3}>
						<TextField
							label="Actual total miles"
							value={
								odometerDerived.actualMiles != null
									? String(odometerDerived.actualMiles)
									: odometerDerived.invalidOrder
										? "Check order"
										: ""
							}
							fullWidth
							margin="dense"
							disabled
							helperText="End − start"
						/>
					</Grid>
				</Grid>
			</DialogContent>
			<DialogActions sx={{ p: "16px 24px" }}>
				<Button onClick={handleClose} color="secondary">
					Cancel
				</Button>
				<Button type="submit" variant="contained" color="primary">
					{isEditing ? "Update Load" : "Save Load"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default LoadFormDialog;
