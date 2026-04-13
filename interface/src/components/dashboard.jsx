import React, {
	useEffect,
	useLayoutEffect,
	useState,
	useMemo,
	useCallback,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { fetchLoads, updateLoad } from "../store/slices/loadsSlice";
import { fetchFuelStops } from "../store/slices/fuelStopsSlice";
import { resetForm, setFormData } from "../store/slices/formSlice";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	LineElement,
	PointElement,
	Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import {
	Grid,
	Paper,
	Typography,
	Box,
	Button,
	CircularProgress,
	Alert,
	IconButton,
	Divider,
	Checkbox,
	FormControlLabel,
	Stack,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
} from "@mui/material";
// import ChartCaptureButton from "./ChartCaptureButton"; // Disabled - kept for debugging
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LoadFormDialog from "./LoadFormDialog";
import { formatDateForInput } from "./loadFormUtils";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	ChartDataLabels,
	LineElement,
	PointElement,
	Filler
);

// Helper to get the closing Wednesday (settlement week key) for a date.
// Settlement periods close at noon on Wednesday; for date-only data, Wednesday
// belongs to the settlement closing that day, and Thu–Tue belong to the next.
// Returns "YYYY-MM-DD" of the closing Wednesday.
function getSettlementWeekKey(date) {
	const d = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
	);
	const dayOfWeek = d.getUTCDay(); // 0=Sun … 3=Wed … 6=Sat
	const daysUntilWednesday = (3 - dayOfWeek + 7) % 7; // 0 if already Wed
	d.setUTCDate(d.getUTCDate() + daysUntilWednesday);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const SETTLEMENT_EXCLUDED_STORAGE_PREFIX =
	"usx_dashboard_settlement_excluded_pros";

function readExcludedProsForWeek(closingWedStr) {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(
			`${SETTLEMENT_EXCLUDED_STORAGE_PREFIX}:${closingWedStr}`
		);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

function Dashboard() {
	const dispatch = useDispatch();
	const navigate = useNavigate(); // Initialize useNavigate
	const {
		list: loads,
		loading,
		error,
	} = useSelector(
		(state) => state.loads || { list: [], loading: false, error: null }
	);
	const { list: fuelStops } = useSelector(
		(state) => state.fuelStops || { list: [] }
	);

	const activeLoad = loads.find((load) => !load.dateDelivered);
	const [completeLoadError, setCompleteLoadError] = useState(null);
	const [activeLoadEditOpen, setActiveLoadEditOpen] = useState(false);

	useEffect(() => {
		dispatch(fetchLoads());
		dispatch(fetchFuelStops());
	}, [dispatch]);

	const handleAddFuelStopForActiveLoad = () => {
		if (activeLoad && activeLoad.proNumber) {
			navigate("/fuel-stops", {
				state: { openModalForPro: activeLoad.proNumber },
			});
		}
	};

	const handleCloseActiveLoadEdit = () => {
		setActiveLoadEditOpen(false);
		dispatch(resetForm());
	};

	const handleEditLoad = () => {
		if (!activeLoad?.proNumber) return;
		const formattedLoad = {
			...activeLoad,
			dateDispatched: formatDateForInput(activeLoad.dateDispatched),
			dateDelivered: formatDateForInput(activeLoad.dateDelivered),
		};
		dispatch(setFormData(formattedLoad));
		setActiveLoadEditOpen(true);
	};

	useEffect(() => {
		if (activeLoadEditOpen && !activeLoad) {
			setActiveLoadEditOpen(false);
			dispatch(resetForm());
		}
	}, [activeLoadEditOpen, activeLoad, dispatch]);

	const handleCompleteLoad = async () => {
		setCompleteLoadError(null);
		if (!activeLoad?.proNumber) return;
		const currentDate = new Date();
		const year = currentDate.getFullYear();
		const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
		const day = currentDate.getDate().toString().padStart(2, "0");
		const formattedDate = `${year}-${month}-${day}`;

		const updatedLoadData = {
			...activeLoad,
			dateDelivered: formattedDate,
		};
		try {
			await dispatch(
				updateLoad({ proNumber: activeLoad.proNumber, load: updatedLoadData })
			).unwrap();
		} catch (err) {
			const msg =
				typeof err === "string"
					? err
					: err?.message ||
						"Could not complete load. Enter odometers on Loads, then set delivery date there.";
			setCompleteLoadError(msg);
		}
	};

	// Odometer-based tax miles: only delivered loads with server-derived actual splits
	const taxMilesSummary = useMemo(() => {
		const deliveredLoads = loads.filter((l) => l.dateDelivered);
		const qualifying = deliveredLoads.filter((l) => {
			const dh = l.actualDeadheadMiles;
			const ld = l.actualLoadedMiles;
			if (dh == null || ld == null) return false;
			const dhn = parseFloat(dh);
			const ldn = parseFloat(ld);
			return !Number.isNaN(dhn) && !Number.isNaN(ldn);
		});
		const totalDeadheadMiles = qualifying.reduce(
			(s, l) => s + (parseFloat(l.actualDeadheadMiles) || 0),
			0
		);
		const totalLoadedMiles = qualifying.reduce(
			(s, l) => s + (parseFloat(l.actualLoadedMiles) || 0),
			0
		);
		return {
			totalDeadheadMiles,
			totalLoadedMiles,
			qualifyingCount: qualifying.length,
			omittedDeliveredCount: deliveredLoads.length - qualifying.length,
			deliveredCount: deliveredLoads.length,
		};
	}, [loads]);

	const milesData = useMemo(
		() => ({
			labels: ["Actual deadhead (odometer)", "Actual loaded (odometer)"],
			datasets: [
				{
					label: "Miles",
					data: [
						taxMilesSummary.totalDeadheadMiles,
						taxMilesSummary.totalLoadedMiles,
					],
					backgroundColor: [
						"rgba(255, 99, 132, 0.2)",
						"rgba(54, 162, 235, 0.2)",
					],
					borderColor: ["rgba(255, 99, 132, 1)", "rgba(54, 162, 235, 1)"],
					borderWidth: 1,
				},
			],
		}),
		[taxMilesSummary]
	);

	// Calculate Net Revenue by Month
	const monthlyRevenue = {};
	loads.forEach((load) => {
		if (load.dateDelivered && load.projectedNet) {
			try {
				const date = new Date(load.dateDelivered);
				if (isNaN(date.getTime())) {
					console.warn(
						`Invalid dateDelivered for load ${load.proNumber}: ${load.dateDelivered}`
					);
					return; // Skip if date is invalid
				}
				const monthYearKey = `${date.getFullYear()}-${(date.getMonth() + 1)
					.toString()
					.padStart(2, "0")}`;
				monthlyRevenue[monthYearKey] =
					(monthlyRevenue[monthYearKey] || 0) +
					(parseFloat(load.projectedNet) || 0);
			} catch (e) {
				console.error(`Error processing date for load ${load.proNumber}:`, e);
			}
		}
	});

	const sortedMonthKeys = Object.keys(monthlyRevenue).sort();

	const revenueChartLabels = sortedMonthKeys.map((key) => {
		const [year, month] = key.split("-");
		const date = new Date(year, parseInt(month, 10) - 1);
		return date.toLocaleString("default", { month: "short", year: "numeric" });
	});

	const revenueChartDataValues = sortedMonthKeys.map(
		(key) => monthlyRevenue[key]
	);

	const revenueData = {
		labels: revenueChartLabels,
		datasets: [
			{
				label: "Net Revenue ($",
				data: revenueChartDataValues,
				backgroundColor: ["rgba(75, 192, 192, 0.2)"],
				borderColor: ["rgba(75, 192, 192, 1)"],
				borderWidth: 1,
			},
		],
	};

	// Calculate Miles per Net Dollar by Settlement Week (closes Wednesday noon)
	// Limited to the last 2 months of data
	const now = new Date();
	const twoMonthsAgo = new Date(
		Date.UTC(now.getFullYear(), now.getMonth() - 2, now.getDate())
	);

	const weeklyMilesAndRevenue = {};
	loads.forEach((load) => {
		if (load.dateDelivered && load.projectedNet) {
			try {
				const date = new Date(load.dateDelivered);
				if (isNaN(date.getTime())) return;
				if (date < twoMonthsAgo) return;
				const weekKey = getSettlementWeekKey(date);

				if (!weeklyMilesAndRevenue[weekKey]) {
					weeklyMilesAndRevenue[weekKey] = {
						totalMiles: 0,
						totalNetRevenue: 0,
					};
				}
				weeklyMilesAndRevenue[weekKey].totalMiles +=
					(parseFloat(load.loadedMiles) || 0) +
					(parseFloat(load.deadheadMiles) || 0);
				weeklyMilesAndRevenue[weekKey].totalNetRevenue +=
					parseFloat(load.projectedNet) || 0;
			} catch (e) {
				console.error(
					`Error processing data for Weekly Miles/Net Dollar for load ${load.proNumber}:`,
					e
				);
			}
		}
	});

	const sortedWeekKeys = Object.keys(weeklyMilesAndRevenue).sort();

	// Key format is "YYYY-MM-DD" (the closing Wednesday) — extract MM-DD for label
	const weeklyChartLabels = sortedWeekKeys.map((key) => key.slice(5));

	const milesPerDollarWeeklyDataValues = sortedWeekKeys.map((key) => {
		const weekData = weeklyMilesAndRevenue[key];
		if (weekData && weekData.totalMiles !== 0) {
			return parseFloat(
				(weekData.totalNetRevenue / weekData.totalMiles).toFixed(2)
			);
		}
		return 0;
	});

	const netRevenuePerMileData = {
		labels: weeklyChartLabels,
		datasets: [
			{
				label: "Net Revenue per Mile ($)",
				data: milesPerDollarWeeklyDataValues,
				borderColor: "rgba(255, 159, 64, 1)",
				backgroundColor: "rgba(255, 159, 64, 0.2)",
				tension: 0.1,
				borderWidth: 2,
			},
		],
	};

	const baseChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "top",
				labels: {
					usePointStyle: true,
					padding: 20,
					font: {
						size: 12,
						weight: "bold",
					},
				},
			},
			tooltip: {
				backgroundColor: "rgba(0, 0, 0, 0.8)",
				titleColor: "#fff",
				bodyColor: "#fff",
				borderColor: "rgba(255, 255, 255, 0.1)",
				borderWidth: 1,
				padding: 12,
				cornerRadius: 8,
			},
			datalabels: {
				display: false,
			},
		},
		scales: {
			x: {
				grid: {
					display: false,
				},
				ticks: {
					font: {
						size: 11,
					},
				},
			},
			y: {
				grid: {
					color: "rgba(0, 0, 0, 0.1)",
				},
				ticks: {
					font: {
						size: 11,
					},
				},
			},
		},
	};

	const pieSum =
		taxMilesSummary.totalDeadheadMiles + taxMilesSummary.totalLoadedMiles;
	const pieChartOptions = {
		...baseChartOptions,
		plugins: {
			legend: {
				position: "top",
				labels: {
					generateLabels: function (chart) {
						const data = chart.data;
						if (data.labels.length && data.datasets.length) {
							return data.labels.map((label, i) => {
								const meta = chart.getDatasetMeta(0);
								const style = meta.controller.getStyle(i);
								const value = data.datasets[0].data[i];
								const percentage =
									pieSum > 0
										? ((value / pieSum) * 100).toFixed(1)
										: "0.0";

								return {
									text: `${label}: ${value} miles (${percentage}%)`,
									fillStyle: style.backgroundColor,
									strokeStyle: style.borderColor,
									lineWidth: style.borderWidth,
									hidden: isNaN(value) || meta.data[i].hidden,
									index: i,
								};
							});
						}
						return [];
					},
				},
			},
			datalabels: {
				display: false,
			},
		},
	};

	/** Same 2-month fuel window as the MPG line chart: weighted actual MPG from per-fill calculatedMpg. */
	const mpgStats = useMemo(() => {
		const sortedStops = [...fuelStops].sort(
			(a, b) => new Date(a.dateOfStop) - new Date(b.dateOfStop)
		);
		if (sortedStops.length === 0) {
			return {
				segmentMiles: 0,
				totalGallons: 0,
				overallMpg: 0,
				fillCount: 0,
			};
		}
		const latestDate = new Date(sortedStops[sortedStops.length - 1].dateOfStop);
		const cutoff = new Date(latestDate);
		cutoff.setMonth(cutoff.getMonth() - 2);
		const recentStops = sortedStops.filter(
			(stop) => new Date(stop.dateOfStop) >= cutoff
		);
		let weightedMiles = 0;
		let totalGallons = 0;
		let fillCount = 0;
		recentStops.forEach((stop) => {
			const mpg = parseFloat(stop.calculatedMpg);
			const gal = parseFloat(stop.gallonsDieselPurchased) || 0;
			if (
				stop.calculatedMpg != null &&
				!Number.isNaN(mpg) &&
				gal > 0
			) {
				weightedMiles += mpg * gal;
				totalGallons += gal;
				fillCount += 1;
			}
		});
		const overallMpg =
			totalGallons > 0 ? weightedMiles / totalGallons : 0;
		return {
			segmentMiles: Math.round(weightedMiles),
			totalGallons: Math.round(totalGallons * 100) / 100,
			overallMpg: Math.round(overallMpg * 100) / 100,
			fillCount,
		};
	}, [fuelStops]);

	const mpgChartData = useMemo(() => {
		const sortedStops = [...fuelStops].sort(
			(a, b) => new Date(a.dateOfStop) - new Date(b.dateOfStop)
		);
		if (sortedStops.length === 0) return { labels: [], datasets: [] };

		const latestDate = new Date(sortedStops[sortedStops.length - 1].dateOfStop);
		const cutoff = new Date(latestDate);
		cutoff.setMonth(cutoff.getMonth() - 2);
		const recentStops = sortedStops.filter(
			(stop) => new Date(stop.dateOfStop) >= cutoff
		);

		const weeklyData = {};
		recentStops.forEach((stop) => {
			const mpg = parseFloat(stop.calculatedMpg);
			const gal = parseFloat(stop.gallonsDieselPurchased) || 0;
			if (stop.calculatedMpg == null || Number.isNaN(mpg) || gal <= 0) {
				return;
			}
			const stopDate = new Date(stop.dateOfStop);
			const weekKey = getSettlementWeekKey(stopDate);
			if (!weeklyData[weekKey]) {
				weeklyData[weekKey] = { weightedMiles: 0, totalGallons: 0 };
			}
			weeklyData[weekKey].weightedMiles += mpg * gal;
			weeklyData[weekKey].totalGallons += gal;
		});

		const labels = [];
		const data = [];
		Object.keys(weeklyData)
			.sort()
			.forEach((weekKey) => {
				const w = weeklyData[weekKey];
				if (w.totalGallons > 0) {
					labels.push(weekKey.slice(5));
					data.push(
						Math.round((w.weightedMiles / w.totalGallons) * 100) / 100
					);
				}
			});

		return {
			labels,
			datasets: [
				{
					label: "Actual weekly MPG (fuel entries)",
					data,
					borderColor: "rgba(75, 192, 192, 1)",
					backgroundColor: "rgba(75, 192, 192, 0.2)",
					tension: 0.4,
					fill: true,
					pointRadius: 0,
					pointHoverRadius: 5,
					pointHoverBackgroundColor: "rgba(75, 192, 192, 1)",
					pointHoverBorderColor: "#fff",
					pointHoverBorderWidth: 2,
				},
			],
		};
	}, [fuelStops]);

	const mpgChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "top",
				labels: {
					usePointStyle: true,
					padding: 20,
					font: {
						size: 12,
						weight: "bold",
					},
				},
			},
			title: {
				display: true,
				text: "Actual fuel MPG (last ~2 months, from fill-ups)",
				font: {
					size: 16,
					weight: "bold",
				},
				padding: 20,
			},
			datalabels: {
				display: false,
			},
			tooltip: {
				backgroundColor: "rgba(0, 0, 0, 0.8)",
				titleColor: "#fff",
				bodyColor: "#fff",
				borderColor: "rgba(255, 255, 255, 0.1)",
				borderWidth: 1,
				padding: 12,
				cornerRadius: 8,
				callbacks: {
					label: function (context) {
						return `Actual MPG: ${context.parsed.y}`;
					},
				},
			},
		},
		scales: {
			x: {
				grid: {
					display: false,
				},
				ticks: {
					font: {
						size: 11,
					},
				},
			},
			y: {
				beginAtZero: true,
				title: {
					display: true,
					text: "MPG",
					font: {
						size: 12,
						weight: "bold",
					},
				},
				grid: {
					color: "rgba(0, 0, 0, 0.1)",
				},
				ticks: {
					font: {
						size: 11,
					},
				},
			},
		},
	};

	// Current settlement period: Thu → Wed (closes Wednesday; date-only delivery uses UTC midnight)
	const { settlementLoads, periodLabel, closingWedStr } = useMemo(() => {
		const today = new Date();
		const closingWedStr = getSettlementWeekKey(today);
		const closingDate = new Date(closingWedStr + "T00:00:00Z");
		const openingDate = new Date(closingDate);
		openingDate.setUTCDate(openingDate.getUTCDate() - 6);

		const fmt = (d) =>
			d.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				timeZone: "UTC",
			});
		const periodLabel = `${fmt(openingDate)} – ${fmt(closingDate)}`;

		const inPeriod = loads.filter((load) => {
			if (!load.dateDelivered) return false;
			const delivered = new Date(load.dateDelivered + "T00:00:00Z");
			return delivered >= openingDate && delivered <= closingDate;
		});

		const settlementLoads = [...inPeriod].sort((a, b) => {
			const da = String(a.dateDelivered).localeCompare(String(b.dateDelivered));
			if (da !== 0) return da;
			return String(a.proNumber).localeCompare(String(b.proNumber));
		});

		return { settlementLoads, periodLabel, closingWedStr };
	}, [loads]);

	const [excludedSettlementPros, setExcludedSettlementPros] = useState([]);

	useLayoutEffect(() => {
		setExcludedSettlementPros(readExcludedProsForWeek(closingWedStr));
	}, [closingWedStr]);

	const persistExcludedSettlementPros = useCallback(
		(nextList) => {
			if (typeof localStorage === "undefined") return;
			const key = `${SETTLEMENT_EXCLUDED_STORAGE_PREFIX}:${closingWedStr}`;
			try {
				if (nextList.length === 0) localStorage.removeItem(key);
				else localStorage.setItem(key, JSON.stringify(nextList));
			} catch {
				// ignore quota / private mode
			}
		},
		[closingWedStr]
	);

	const toggleSettlementProIncluded = useCallback(
		(proNumber) => {
			const key = String(proNumber);
			setExcludedSettlementPros((prev) => {
				const wasExcluded = prev.includes(key);
				const next = wasExcluded
					? prev.filter((p) => p !== key)
					: [...prev, key];
				persistExcludedSettlementPros(next);
				return next;
			});
		},
		[persistExcludedSettlementPros]
	);

	const settlementTotal = useMemo(() => {
		const excluded = new Set(excludedSettlementPros);
		return settlementLoads.reduce((sum, load) => {
			if (excluded.has(String(load.proNumber))) return sum;
			return sum + (parseFloat(load.projectedNet) || 0);
		}, 0);
	}, [settlementLoads, excludedSettlementPros]);

	const settlementIncludedCount = useMemo(() => {
		const excluded = new Set(excludedSettlementPros);
		return settlementLoads.filter((l) => !excluded.has(String(l.proNumber))).length;
	}, [settlementLoads, excludedSettlementPros]);

	const [settlementProsModalOpen, setSettlementProsModalOpen] = useState(false);

	useEffect(() => {
		if (settlementLoads.length === 0) setSettlementProsModalOpen(false);
	}, [settlementLoads.length]);

	return (
		<Box sx={{ flexGrow: 1 }}>
			<Typography variant="h4" gutterBottom component="h2" sx={{ mb: 2 }}>
				Dashboard
			</Typography>

			{/* <ChartCaptureButton /> */}{/* Disabled - kept for debugging */}

			<Box sx={{ textAlign: "center", mb: 2 }}>
				<Typography variant="subtitle1" sx={{ fontSize: "1.2rem" }}>
					Projected Settlement Revenue ({periodLabel}):{" "}
					<strong>${settlementTotal.toFixed(2)}</strong>
				</Typography>
				{settlementLoads.length > 0 ? (
					<Box
						sx={{
							mt: 0.75,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 0.75,
						}}
					>
						<Typography variant="caption" color="text.secondary">
							{settlementIncludedCount === settlementLoads.length
								? `${settlementLoads.length} load${
										settlementLoads.length !== 1 ? "s" : ""
									} in this period`
								: `${settlementIncludedCount} of ${settlementLoads.length} load${
										settlementLoads.length !== 1 ? "s" : ""
									} counted in total`}
						</Typography>
						<Button
							size="small"
							variant="outlined"
							onClick={() => setSettlementProsModalOpen(true)}
						>
							View / edit PROs in this period
						</Button>
					</Box>
				) : (
					<Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
						No delivered loads in this settlement window yet.
					</Typography>
				)}
			</Box>

			<Dialog
				open={settlementProsModalOpen}
				onClose={() => setSettlementProsModalOpen(false)}
				fullWidth
				maxWidth="sm"
				scroll="paper"
				aria-labelledby="settlement-pros-dialog-title"
			>
				<DialogTitle component="div" sx={{ pb: 1 }}>
					<Stack spacing={0.5}>
						<Typography
							variant="h6"
							component="h2"
							id="settlement-pros-dialog-title"
							sx={{ fontSize: "1.125rem", fontWeight: 600 }}
						>
							Loads in this settlement period
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{periodLabel}
						</Typography>
					</Stack>
				</DialogTitle>
				<DialogContent dividers>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						Delivery dates are whole days; your carrier may move late Wednesday (or
						similar) loads to the next check. Uncheck Include to drop a PRO from the
						dashboard total.
					</Typography>
					<Stack
						component="ul"
						sx={{
							listStyle: "none",
							m: 0,
							p: 0,
							border: "1px solid",
							borderColor: "divider",
							borderRadius: 1,
							overflow: "hidden",
						}}
					>
						{settlementLoads.map((load) => {
							const pro = String(load.proNumber);
							const net = parseFloat(load.projectedNet) || 0;
							const included = !excludedSettlementPros.includes(pro);
							return (
								<Stack
									component="li"
									key={pro}
									direction="row"
									alignItems="center"
									justifyContent="space-between"
									sx={{
										gap: 1,
										px: 1.5,
										py: 1,
										borderBottom: "1px solid",
										borderColor: "divider",
										"&:last-child": { borderBottom: "none" },
										backgroundColor: included ? "transparent" : "action.hover",
									}}
								>
									<Box sx={{ minWidth: 0 }}>
										<Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
											PRO {pro}
										</Typography>
										<Typography
											variant="caption"
											color="text.secondary"
											display="block"
										>
											Delivered {load.dateDelivered} · ${net.toFixed(2)} projected net
										</Typography>
									</Box>
									<FormControlLabel
										control={
											<Checkbox
												size="small"
												checked={included}
												onChange={() => toggleSettlementProIncluded(pro)}
												inputProps={{ "aria-label": `Include PRO ${pro} in settlement total` }}
											/>
										}
										label="Include"
										sx={{ flexShrink: 0, mr: 0 }}
									/>
								</Stack>
							);
						})}
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSettlementProsModalOpen(false)}>Close</Button>
				</DialogActions>
			</Dialog>

			{completeLoadError && (
				<Alert severity="warning" sx={{ mb: 2, maxWidth: 720, mx: "auto" }}>
					{completeLoadError}
				</Alert>
			)}

			{activeLoad && (
				<Box
					sx={{
						mb: 3,
						p: 1.5,
						display: "flex",
						flexWrap: "wrap",
						gap: "12px", // Spacing between items
						alignItems: "center",
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 1,
						backgroundColor: "action.hover", // Subtle background
						width: "fit-content", // Make box width fit its content
						marginLeft: "auto", // Center the box
						marginRight: "auto", // Center the box
					}}
				>
					<Typography variant="subtitle1" sx={{ fontWeight: "bold", mr: 1 }}>
						Current Active Load:
					</Typography>
					<Typography variant="body2">
						<strong>PRO:</strong> {activeLoad.proNumber}
					</Typography>
					<Typography variant="body2">
						<strong>Origin:</strong> {activeLoad.originCity},{" "}
						{activeLoad.originState}
					</Typography>
					<Typography variant="body2">
						<strong>Destination:</strong> {activeLoad.destinationCity},{" "}
						{activeLoad.destinationState}
					</Typography>
					<Typography variant="body2">
						<strong>Trailer:</strong> {activeLoad.trailerNumber || "N/A"}
					</Typography>
					<Typography
						variant="body2"
						sx={{ fontStyle: "italic", color: "primary.main" }}
					>
						Status: In Transit
					</Typography>
					<IconButton
						onClick={handleCompleteLoad}
						color="success"
						size="small"
						sx={{ ml: 1 }}
						title="Mark as Delivered (requires odometers on Loads)"
					>
						<CheckCircleOutlineIcon />
					</IconButton>
					<IconButton
						onClick={handleEditLoad}
						color="primary"
						size="small"
						sx={{ ml: 1 }}
						title="Edit Load"
					>
						<EditIcon />
					</IconButton>
					<Button
						variant="outlined"
						size="small"
						onClick={handleAddFuelStopForActiveLoad}
						sx={{ ml: 2 }} // Add some margin
					>
						Add Fuel Stop
					</Button>
				</Box>
			)}

			{loading && (
				<CircularProgress sx={{ display: "block", margin: "20px auto" }} />
			)}
			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{error}
				</Alert>
			)}

			<Grid container spacing={3}>
				<Grid item xs={12} md={6} lg={4}>
					<Paper
						sx={{
							p: 2,
							display: "flex",
							flexDirection: "column",
							height: 300,
							backgroundColor: "transparent", // Make Paper transparent
							boxShadow: "none", // Remove shadow for transparent Paper
						}}
					>
						<Typography variant="h6" gutterBottom component="h3">
							Actual miles (odometer, tax)
						</Typography>
						{taxMilesSummary.qualifyingCount === 0 ? (
							<Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
								Enter starting, pickup, and ending odometer on delivered loads
								(Loads page) to see deadhead vs loaded splits.
							</Typography>
						) : (
							<>
								{taxMilesSummary.omittedDeliveredCount > 0 && (
									<Typography
										variant="caption"
										color="text.secondary"
										display="block"
										sx={{ mb: 1 }}
									>
										Based on {taxMilesSummary.qualifyingCount} load
										{taxMilesSummary.qualifyingCount !== 1 ? "s" : ""} with full
										odometer data; {taxMilesSummary.omittedDeliveredCount} delivered
										load{taxMilesSummary.omittedDeliveredCount !== 1 ? "s" : ""}{" "}
										omitted.
									</Typography>
								)}
								<Box sx={{ flexGrow: 1, position: "relative" }}>
									<Pie data={milesData} options={pieChartOptions} />
								</Box>
							</>
						)}
					</Paper>
				</Grid>
				<Grid item xs={12} md={6} lg={4}>
					<Paper
						sx={{
							p: 2,
							display: "flex",
							flexDirection: "column",
							height: 300,
							backgroundColor: "transparent", // Make Paper transparent
							boxShadow: "none", // Remove shadow for transparent Paper
						}}
					>
						<Typography variant="h6" gutterBottom component="h3">
							Net Revenue by Month
						</Typography>
						<Box sx={{ flexGrow: 1, position: "relative" }}>
							<Bar data={revenueData} options={baseChartOptions} />
						</Box>
					</Paper>
				</Grid>
				<Grid item xs={12} md={6} lg={4}>
					<Paper
						sx={{
							p: 2,
							display: "flex",
							flexDirection: "column",
							height: 300,
							backgroundColor: "transparent",
							boxShadow: "none",
						}}
					>
						<Typography variant="h6" gutterBottom component="h3">
							Net Revenue per Mile
						</Typography>
						<Box sx={{ flexGrow: 1, position: "relative" }}>
							<Line data={netRevenuePerMileData} options={baseChartOptions} />
						</Box>
					</Paper>
				</Grid>
				<Grid item xs={12} md={6} lg={4}>
					<Paper
						sx={{
							p: 2,
							display: "flex",
							flexDirection: "column",
							height: 300,
							backgroundColor: "transparent",
							boxShadow: "none",
						}}
					>
						<Typography variant="h6" gutterBottom component="h3">
							Actual fuel MPG
						</Typography>
						<Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
							Last ~2 months, gallons-weighted from fill-up MPG (odometer-based
							segments). {mpgStats.fillCount} fill-up
							{mpgStats.fillCount !== 1 ? "s" : ""} with MPG; blended{" "}
							<strong>{mpgStats.overallMpg || "—"}</strong> MPG,{" "}
							{mpgStats.totalGallons || "—"} gal.
						</Typography>
						<Box sx={{ flexGrow: 1, position: "relative" }}>
							<Line data={mpgChartData} options={mpgChartOptions} />
						</Box>
					</Paper>
				</Grid>
			</Grid>

			<LoadFormDialog open={activeLoadEditOpen} onClose={handleCloseActiveLoadEdit} />
		</Box>
	);
}

export default Dashboard;
