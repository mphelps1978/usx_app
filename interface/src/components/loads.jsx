import { React, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLoads, updateLoad, deleteLoad } from "../store/slices/loadsSlice";
import { fetchFuelStops } from "../store/slices/fuelStopsSlice";
import { resetForm, setFormData } from "../store/slices/formSlice";
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
	CircularProgress,
	Alert,
	Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LoadFormDialog from "./LoadFormDialog";
import { formatDateForInput } from "./loadFormUtils";

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
	const [isModalOpen, setIsModalOpen] = useState(false);

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

	// Helper function to calculate fuel discount for a load
	const calculateFuelDiscount = (proNumber, fuelStopsList) => {
		if (!fuelStopsList || fuelStopsList.length === 0) return 0;
		return fuelStopsList
			.filter((stop) => stop.proNumber === proNumber)
			.reduce((sum, stop) => {
				const gallons = parseFloat(stop.gallonsDieselPurchased) || 0;
				const pumpPrice = parseFloat(stop.dieselPricePerGallon) || 0;
				const settledPrice = parseFloat(stop.settledDieselPricePerGallon) || 0;

				// If settled price exists, calculate discount
				if (settledPrice > 0 && settledPrice < pumpPrice) {
					const discountPerGallon = pumpPrice - settledPrice;
					return sum + gallons * discountPerGallon;
				}
				return sum;
			}, 0);
	};

	// Helper function to calculate net to truck for a load
	const calculateNetToTruck = (load, fuelStopsList) => {
		const actualFuelCost = calculateTotalFuelCost(
			load.proNumber,
			fuelStopsList
		);
		const fuelDiscount = calculateFuelDiscount(load.proNumber, fuelStopsList);
		const scaleCost = parseFloat(load.scaleCost) || 0;
		const calculatedGross = parseFloat(load.calculatedGross) || 0;

		// Get individual deduction rates from userSettings
		const totalMiles =
			(parseFloat(load.deadheadMiles) || 0) +
			(parseFloat(load.loadedMiles) || 0);
		const fuelRoadUseTaxRate = parseFloat(userSettings?.fuelRoadUseTax) || 0;
		const maintenanceReserveRate =
			parseFloat(userSettings?.maintenanceReserve) || 0;
		const bondDepositRate = parseFloat(userSettings?.bondDeposit) || 0;
		const mrpFeeRate = parseFloat(userSettings?.mrpFee) || 0;

		const fuelRoadUseDeduction = totalMiles * fuelRoadUseTaxRate;
		const maintenanceReserveDeduction = totalMiles * maintenanceReserveRate;
		const bondDepositDeduction = totalMiles * bondDepositRate;
		const mrpFeeDeduction = totalMiles * mrpFeeRate;

		const totalDeductions =
			fuelRoadUseDeduction +
			maintenanceReserveDeduction +
			bondDepositDeduction +
			mrpFeeDeduction;

		// Net to Truck = Calculated Gross - Total Deductions - Actual Fuel Cost - Scale Cost + Fuel Discount
		return (
			calculatedGross -
			totalDeductions -
			actualFuelCost -
			scaleCost +
			fuelDiscount
		);
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
		setIsModalOpen(true);
	};

	const handleEditLoad = (load) => {
		const formattedLoad = {
			...load,
			dateDispatched: formatDateForInput(load.dateDispatched),
			dateDelivered: formatDateForInput(load.dateDelivered),
		};
		dispatch(setFormData(formattedLoad));
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		dispatch(resetForm());
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
									<TableCell>PRO</TableCell>
									<TableCell>Dispatched</TableCell>
									<TableCell>Status</TableCell>
									<TableCell>Origin</TableCell>
									<TableCell>Destination</TableCell>
									<TableCell align="right">Miles</TableCell>
									<TableCell align="right">Weight</TableCell>
									{userSettings?.driverPayType === "percentage" && (
										<TableCell align="right">Pay</TableCell>
									)}
									<TableCell align="right">Rate</TableCell>
									<TableCell align="right">Gross</TableCell>
									<TableCell align="right">Net</TableCell>
									<TableCell align="center">Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{sortedLoadsForTable.map((load) =>
									(() => {
										// IIFE to allow calculations before returning JSX
										// Calculate totalMiles for this specific load
										const deadheadMiles = parseFloat(load.deadheadMiles) || 0;
										const loadedMiles = parseFloat(load.loadedMiles) || 0;
										const totalMilesForLoad = deadheadMiles + loadedMiles;

										// Get rates from userSettings
										const fuelRoadUseTaxRate =
											parseFloat(userSettings?.fuelRoadUseTax) || 0;
										const maintenanceReserveRate =
											parseFloat(userSettings?.maintenanceReserve) || 0;
										const bondDepositRate =
											parseFloat(userSettings?.bondDeposit) || 0;
										const mrpFeeRate = parseFloat(userSettings?.mrpFee) || 0;

										// Calculate individual deduction components for this load
										const fuelRoadUseDeduction =
											totalMilesForLoad * fuelRoadUseTaxRate;
										const maintenanceReserveDeduction =
											totalMilesForLoad * maintenanceReserveRate;
										const bondDepositDeduction =
											totalMilesForLoad * bondDepositRate;
										const mrpFeeDeduction = totalMilesForLoad * mrpFeeRate;

										// Calculate total deductions for this load
										const calculatedTotalDeductionsForLoad =
											fuelRoadUseDeduction +
											maintenanceReserveDeduction +
											bondDepositDeduction +
											mrpFeeDeduction;

										// Calculate fuel discount for this specific load
										const fuelDiscountForLoad = calculateFuelDiscount(
											load.proNumber,
											allFuelStops
										);

										// Calculate net to truck for this specific load
										const netToTruckForLoad = calculateNetToTruck(
											load,
											allFuelStops
										);

										return (
											<TableRow
												key={load.proNumber}
												sx={{
													"&:last-child td, &:last-child th": { border: 0 },
												}}
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
												<TableCell>{`${load.originCity || ""}, ${
													load.originState || ""
												}`}</TableCell>
												<TableCell>{`${load.destinationCity || ""}, ${
													load.destinationState || ""
												}`}</TableCell>
												<TableCell align="right">{totalMilesForLoad}</TableCell>
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
													{load.driverPayType === "percentage" &&
													load.fsc !== null
														? `$${(load.fsc || 0).toFixed(2)}`
														: load.driverPayType === "mileage" &&
														  load.fscPerLoadedMile !== null
														? `$${(load.fscPerLoadedMile || 0).toFixed(2)}`
														: "N/A"}
												</TableCell>
												<TableCell align="right">
													{`$${(
														Math.round((parseFloat(load.calculatedGross) || 0) * 100) /
														100
													).toFixed(2)}`}
												</TableCell>
												<TableCell align="right">
													{`$${(
														Math.round(netToTruckForLoad * 100) / 100
													).toFixed(2)}`}
												</TableCell>
												<TableCell align="center">
													{!load.dateDelivered && (
														<Tooltip title="Mark as Delivered">
															<IconButton
																onClick={() => handleCompleteLoad(load)}
																color="success"
																size="small"
																sx={{ mr: 1 }}
															>
																<CheckCircleOutlineIcon />
															</IconButton>
														</Tooltip>
													)}
													<Tooltip title="Edit Load">
														<IconButton
															onClick={() => handleEditLoad(load)}
															color="primary"
															size="small"
															sx={{ mr: 1 }}
														>
															<EditIcon />
														</IconButton>
													</Tooltip>
													<Tooltip title="Delete Load">
														<IconButton
															onClick={() => handleDelete(load.proNumber)}
															color="error"
															size="small"
														>
															<DeleteIcon />
														</IconButton>
													</Tooltip>
												</TableCell>
											</TableRow>
										);
									})()
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}

			<LoadFormDialog open={isModalOpen} onClose={handleCloseModal} />
		</Box>
	);
}

export default Loads;
