import { React, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	fetchLoads,
	fetchLastEndingOdometer,
	markLoadPaid,
	cancelLoad,
} from "../store/slices/loadsSlice";
import { fetchFuelStops } from "../store/slices/fuelStopsSlice";
import { resetForm, setFormData } from "../store/slices/formSlice";
import { getLoadRevenueBeforeFuel } from "../utils/loadRevenue";
import {
	getCancelReasonLabel,
	isActiveLoad,
} from "../constants/loadCancelReasons";
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
	Checkbox,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LoadFormDialog from "./LoadFormDialog";
import CancelLoadDialog from "./CancelLoadDialog";
import { formatDateForInput, formatTodayForInput } from "./loadFormUtils";

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
	const [deliverMode, setDeliverMode] = useState(false);
	const [cancelDialogLoad, setCancelDialogLoad] = useState(null);

	useEffect(() => {
		dispatch(fetchLoads());
		dispatch(fetchFuelStops());
	}, [dispatch]);

	const parseLoadDateMs = (dateStr) => {
		if (!dateStr || String(dateStr).trim() === "") return 0;
		const s = String(dateStr).trim();
		const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00Z`);
		const t = d.getTime();
		return Number.isNaN(t) ? 0 : t;
	};

	// Most recent first: delivered loads by delivery date; in-transit by dispatch date
	const sortedLoadsForTable = [...loadsForTable].sort((a, b) => {
		const keyA = a.dateDelivered ? a.dateDelivered : a.dateDispatched;
		const keyB = b.dateDelivered ? b.dateDelivered : b.dateDispatched;
		const msA = parseLoadDateMs(keyA);
		const msB = parseLoadDateMs(keyB);
		if (msB !== msA) return msB - msA;
		return String(b.proNumber).localeCompare(String(a.proNumber));
	});

	const handleAddLoad = async () => {
		dispatch(resetForm());
		setDeliverMode(false);
		try {
			const result = await dispatch(fetchLastEndingOdometer()).unwrap();
			if (result != null) {
				dispatch(
					setFormData({
						startingOdometer: String(result),
					})
				);
			}
		} catch {
			/* no prior delivery — starting odometer stays blank */
		}
		setIsModalOpen(true);
	};

	const handleEditLoad = (load) => {
		setDeliverMode(false);
		const formattedLoad = {
			...load,
			dateDispatched: formatDateForInput(load.dateDispatched),
			dateDelivered: formatDateForInput(load.dateDelivered),
		};
		dispatch(setFormData(formattedLoad));
		setIsModalOpen(true);
	};

	const handleDeliverLoad = (load) => {
		setDeliverMode(true);
		const formattedLoad = {
			...load,
			dateDispatched: formatDateForInput(load.dateDispatched),
			dateDelivered: formatTodayForInput(),
		};
		dispatch(setFormData(formattedLoad));
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setDeliverMode(false);
		dispatch(resetForm());
	};

	const handleCancelConfirm = async ({
		cancelReason,
		cancelReasonOther,
		unlinkFuelStops,
	}) => {
		if (!cancelDialogLoad) return;
		const result = await dispatch(
			cancelLoad({
				proNumber: cancelDialogLoad.proNumber,
				cancelReason,
				cancelReasonOther,
				unlinkFuelStops,
			})
		);
		if (cancelLoad.rejected.match(result)) {
			throw new Error(result.payload || "Could not cancel load.");
		}
		dispatch(fetchFuelStops());
	};

	const handleTogglePaid = async (load) => {
		await dispatch(
			markLoadPaid({ proNumber: load.proNumber, isPaid: !load.isPaid })
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
									<TableCell align="right">Load revenue</TableCell>
									<TableCell align="center">Paid</TableCell>
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

										const loadRevenue = getLoadRevenueBeforeFuel(load);

										return (
											<TableRow
												key={load.proNumber}
												sx={{
													"&:last-child td, &:last-child th": { border: 0 },
													...(load.isCancelled
														? { opacity: 0.72, bgcolor: "action.hover" }
														: {}),
												}}
											>
												<TableCell component="th" scope="row">
													{load.proNumber}
												</TableCell>
												<TableCell>
													{formatDateForDisplay(load.dateDispatched)}
												</TableCell>
												<TableCell>
													{load.isCancelled ? (
														<Tooltip title={getCancelReasonLabel(load)}>
															<Typography
																color="error"
																variant="caption"
																sx={{ fontStyle: "italic" }}
															>
																Cancelled
															</Typography>
														</Tooltip>
													) : load.dateDelivered ? (
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
													{load.isCancelled
														? "—"
														: `$${(
																Math.round(
																	(parseFloat(load.calculatedGross) || 0) * 100
																) / 100
															).toFixed(2)}`}
												</TableCell>
												<TableCell align="right">
													{load.isCancelled
														? "—"
														: `$${loadRevenue.toFixed(2)}`}
												</TableCell>
												<TableCell align="center">
													{load.isCancelled ? (
														<Typography variant="caption" color="text.disabled">
															—
														</Typography>
													) : load.dateDelivered ? (
														<Tooltip
															title={
																load.isPaid && load.paidAt
																	? `Paid ${formatDateForDisplay(load.paidAt)}`
																	: load.isPaid
																		? "Paid"
																		: "Mark as paid when this load appears on your settlement"
															}
														>
															<Checkbox
																size="small"
																checked={!!load.isPaid}
																onChange={() => handleTogglePaid(load)}
																inputProps={{
																	"aria-label": `PRO ${load.proNumber} paid`,
																}}
															/>
														</Tooltip>
													) : (
														<Typography variant="caption" color="text.disabled">
															—
														</Typography>
													)}
												</TableCell>
												<TableCell align="center">
													{isActiveLoad(load) && (
														<Tooltip title="Mark as Delivered">
															<IconButton
																onClick={() => handleDeliverLoad(load)}
																color="success"
																size="small"
																sx={{ mr: 1 }}
															>
																<CheckCircleOutlineIcon />
															</IconButton>
														</Tooltip>
													)}
													{!load.isCancelled && (
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
													)}
													{isActiveLoad(load) && (
														<Tooltip title="Cancel Load">
															<IconButton
																onClick={() => setCancelDialogLoad(load)}
																color="error"
																size="small"
															>
																<CancelIcon />
															</IconButton>
														</Tooltip>
													)}
												</TableCell>
											</TableRow>
										);
									})()
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}

			<LoadFormDialog
				open={isModalOpen}
				onClose={handleCloseModal}
				deliverMode={deliverMode}
			/>
			<CancelLoadDialog
				open={Boolean(cancelDialogLoad)}
				load={cancelDialogLoad}
				attachedFuelStops={allFuelStops.filter(
					(s) => s.proNumber === cancelDialogLoad?.proNumber
				)}
				onClose={() => setCancelDialogLoad(null)}
				onConfirm={handleCancelConfirm}
			/>
		</Box>
	);
}

export default Loads;
