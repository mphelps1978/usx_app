import React, {
	useEffect,
	useLayoutEffect,
	useState,
	useMemo,
	useCallback,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { fetchLoads, updateLoad, markLoadPaid, cancelLoad } from "../store/slices/loadsSlice";
import { fetchFuelStops } from "../store/slices/fuelStopsSlice";
import { resetForm, setFormData } from "../store/slices/formSlice";
import { isActiveLoad, countsTowardReconciliation } from "../constants/loadCancelReasons";
import { getLoadRevenueBeforeFuel } from "../utils/loadRevenue";
import { Bar, Line } from "react-chartjs-2";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
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
import { alpha } from "@mui/material/styles";
// import ChartCaptureButton from "./ChartCaptureButton"; // Disabled - kept for debugging
import EditIcon from "@mui/icons-material/Edit";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LoadFormDialog from "./LoadFormDialog";
import CancelLoadDialog from "./CancelLoadDialog";
import OfficeReceiptDialog from "./OfficeReceiptDialog";
import { formatDateForInput, formatTodayForInput } from "./loadFormUtils";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
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

const SETTLEMENT_INCLUDED_STORAGE_PREFIX =
	"usx_dashboard_settlement_included_pros";

/** Returns null if this week has never been initialized in localStorage. */
function readIncludedProsForWeek(closingWedStr) {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(
			`${SETTLEMENT_INCLUDED_STORAGE_PREFIX}:${closingWedStr}`
		);
		if (raw === null) return null;
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return null;
	}
}

function isDeliveredInSettlementPeriod(load, openingDate, closingDate) {
	if (!load.dateDelivered) return false;
	const delivered = new Date(`${load.dateDelivered}T00:00:00Z`);
	return delivered >= openingDate && delivered <= closingDate;
}

function isDateInSettlementPeriod(dateStr, openingDate, closingDate) {
	if (!dateStr || String(dateStr).trim() === "") return false;
	const s = String(dateStr).trim();
	const d = new Date(s.includes("T") ? s : `${s}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return false;
	return d >= openingDate && d <= closingDate;
}

function defaultIncludedProsForWeek(unpaidLoads, openingDate, closingDate) {
	return unpaidLoads
		.filter((load) =>
			isDeliveredInSettlementPeriod(load, openingDate, closingDate)
		)
		.map((load) => String(load.proNumber));
}

/** Makes headline averages / totals easy to scan vs surrounding caption text */
function DashboardStatCallout({
	label,
	value,
	detail,
	size = "medium",
	centered = false,
	layout = "default",
}) {
	const isStrip = layout === "strip";
	const valueVariant =
		size === "large" && !isStrip ? "h4" : isStrip ? "h5" : "h5";
	const textAlign = isStrip || centered ? "center" : "left";
	const horizontalPad =
		centered && !isStrip ? 2 : isStrip ? 1.25 : 1.5;
	return (
		<Box
			sx={(theme) => ({
				mb: isStrip ? 0 : centered ? 0 : 1.25,
				width: isStrip ? "100%" : "auto",
				alignSelf: isStrip ? "stretch" : undefined,
				minWidth: 0,
				boxSizing: "border-box",
				py: isStrip ? 1.15 : 1.35,
				px: horizontalPad,
				borderRadius: 2,
				textAlign,
				backgroundColor: alpha(theme.palette.primary.main, 0.1),
				border: "1px solid",
				borderColor: alpha(theme.palette.primary.main, 0.28),
				boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, 0.04)} inset`,
				...(isStrip
					? {
							display: "flex",
							flexDirection: "column",
							justifyContent: "center",
							minHeight: { xs: "8rem", sm: "8.25rem" },
						}
					: {}),
			})}
		>
			<Typography
				variant="overline"
				color="text.secondary"
				sx={{
					display: "block",
					lineHeight: 1.25,
					fontWeight: 700,
					letterSpacing: isStrip ? "0.06em" : "0.09em",
					fontSize: isStrip ? "0.62rem" : "0.65rem",
				}}
			>
				{label}
			</Typography>
			<Typography
				variant={valueVariant}
				component="p"
				sx={{
					fontWeight: 800,
					color: "primary.main",
					letterSpacing: "-0.03em",
					lineHeight: 1.15,
					my: 0.35,
				}}
			>
				{value}
			</Typography>
			{detail ? (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{
						display: "block",
						lineHeight: 1.45,
						maxWidth: "100%",
					}}
				>
					{detail}
				</Typography>
			) : null}
		</Box>
	);
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

	const activeLoad = loads.find((load) => isActiveLoad(load));
	const [activeLoadEditOpen, setActiveLoadEditOpen] = useState(false);
	const [deliverMode, setDeliverMode] = useState(false);
	const [cancelDialogLoad, setCancelDialogLoad] = useState(null);

	const reconciliationLoads = useMemo(
		() => loads.filter((load) => countsTowardReconciliation(load)),
		[loads]
	);

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
		setDeliverMode(false);
		dispatch(resetForm());
	};

	const handleEditLoad = () => {
		if (!activeLoad?.proNumber) return;
		setDeliverMode(false);
		const formattedLoad = {
			...activeLoad,
			dateDispatched: formatDateForInput(activeLoad.dateDispatched),
			dateDelivered: formatDateForInput(activeLoad.dateDelivered),
		};
		dispatch(setFormData(formattedLoad));
		setActiveLoadEditOpen(true);
	};

	const handleDeliverLoad = () => {
		if (!activeLoad?.proNumber) return;
		setDeliverMode(true);
		const formattedLoad = {
			...activeLoad,
			dateDispatched: formatDateForInput(activeLoad.dateDispatched),
			dateDelivered: formatTodayForInput(),
		};
		dispatch(setFormData(formattedLoad));
		setActiveLoadEditOpen(true);
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

	useEffect(() => {
		if (activeLoadEditOpen && !activeLoad) {
			setActiveLoadEditOpen(false);
			dispatch(resetForm());
		}
	}, [activeLoadEditOpen, activeLoad, dispatch]);

	/** Delivered loads with full odometer splits; compare dispatched vs actual per segment. */
	const milesComparisonSummary = useMemo(() => {
		const deliveredLoads = reconciliationLoads.filter((l) => l.dateDelivered);
		const qualifying = deliveredLoads.filter((l) => {
			const dh = l.actualDeadheadMiles;
			const ld = l.actualLoadedMiles;
			if (dh == null || ld == null) return false;
			const dhn = parseFloat(dh);
			const ldn = parseFloat(ld);
			return !Number.isNaN(dhn) && !Number.isNaN(ldn);
		});
		let dispatchedDeadhead = 0;
		let dispatchedLoaded = 0;
		let actualDeadhead = 0;
		let actualLoaded = 0;
		for (const l of qualifying) {
			dispatchedDeadhead += parseFloat(l.deadheadMiles) || 0;
			dispatchedLoaded += parseFloat(l.loadedMiles) || 0;
			actualDeadhead += parseFloat(l.actualDeadheadMiles) || 0;
			actualLoaded += parseFloat(l.actualLoadedMiles) || 0;
		}
		const totalDispatched = dispatchedDeadhead + dispatchedLoaded;
		const totalActual = actualDeadhead + actualLoaded;
		return {
			dispatchedDeadhead,
			dispatchedLoaded,
			actualDeadhead,
			actualLoaded,
			totalDispatched,
			totalActual,
			qualifyingCount: qualifying.length,
			omittedDeliveredCount: deliveredLoads.length - qualifying.length,
			deliveredCount: deliveredLoads.length,
		};
	}, [loads]);

	const milesComparisonData = useMemo(
		() => ({
			labels: ["Deadhead", "Loaded"],
			datasets: [
				{
					label: "Dispatched miles",
					data: [
						milesComparisonSummary.dispatchedDeadhead,
						milesComparisonSummary.dispatchedLoaded,
					],
					backgroundColor: "rgba(54, 162, 235, 0.45)",
					borderColor: "rgba(54, 162, 235, 1)",
					borderWidth: 1,
				},
				{
					label: "Actual miles (odometer)",
					data: [
						milesComparisonSummary.actualDeadhead,
						milesComparisonSummary.actualLoaded,
					],
					backgroundColor: "rgba(255, 99, 132, 0.45)",
					borderColor: "rgba(255, 99, 132, 1)",
					borderWidth: 1,
				},
			],
		}),
		[milesComparisonSummary]
	);

	// Calculate Net Revenue by Month
	const monthlyRevenue = {};
	loads.forEach((load) => {
		if (!countsTowardReconciliation(load)) return;
		if (load.dateDelivered) {
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
					(monthlyRevenue[monthYearKey] || 0) + getLoadRevenueBeforeFuel(load);
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
				label: "Load revenue ($)",
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
		if (!countsTowardReconciliation(load)) return;
		if (load.dateDelivered) {
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
					getLoadRevenueBeforeFuel(load);
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

	let rpmWindowMiles = 0;
	let rpmWindowNet = 0;
	for (const key of sortedWeekKeys) {
		const w = weeklyMilesAndRevenue[key];
		rpmWindowMiles += w.totalMiles;
		rpmWindowNet += w.totalNetRevenue;
	}
	const periodAvgNetRevenuePerMile =
		rpmWindowMiles > 0 ? rpmWindowNet / rpmWindowMiles : null;

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

	const milesComparisonChartOptions = {
		...baseChartOptions,
		plugins: {
			...baseChartOptions.plugins,
			tooltip: {
				...baseChartOptions.plugins.tooltip,
				callbacks: {
					label(ctx) {
						const v = ctx.parsed.y;
						const n =
							typeof v === "number" && !Number.isNaN(v)
								? Math.round(v * 10) / 10
								: v;
						return `${ctx.dataset.label}: ${n} mi`;
					},
				},
			},
		},
		scales: {
			...baseChartOptions.scales,
			y: {
				...baseChartOptions.scales.y,
				beginAtZero: true,
				title: {
					display: true,
					text: "Miles",
					font: { size: 12, weight: "bold" },
				},
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

	// Current settlement period bounds (Thu → Wed closing Wednesday)
	const { periodLabel, closingWedStr, openingDate, closingDate } = useMemo(() => {
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

		return { periodLabel, closingWedStr, openingDate, closingDate };
	}, []);

	const unpaidLoads = useMemo(() => {
		return [...loads]
			.filter((load) => load.dateDelivered && !load.isPaid && !load.isCancelled)
			.sort((a, b) => {
				const da = new Date(`${a.dateDelivered}T00:00:00Z`).getTime();
				const db = new Date(`${b.dateDelivered}T00:00:00Z`).getTime();
				const na = Number.isNaN(da) ? 0 : da;
				const nb = Number.isNaN(db) ? 0 : db;
				if (nb !== na) return nb - na;
				return String(b.proNumber).localeCompare(String(a.proNumber));
			});
	}, [loads]);

	const [includedSettlementPros, setIncludedSettlementPros] = useState([]);

	const persistIncludedSettlementPros = useCallback(
		(nextList) => {
			if (typeof localStorage === "undefined") return;
			const key = `${SETTLEMENT_INCLUDED_STORAGE_PREFIX}:${closingWedStr}`;
			try {
				localStorage.setItem(key, JSON.stringify(nextList));
			} catch {
				// ignore quota / private mode
			}
		},
		[closingWedStr]
	);

	useLayoutEffect(() => {
		const stored = readIncludedProsForWeek(closingWedStr);
		const unpaidSet = new Set(unpaidLoads.map((l) => String(l.proNumber)));

		if (stored !== null) {
			const filtered = stored.filter((p) => unpaidSet.has(p));
			setIncludedSettlementPros(filtered);
			if (filtered.length !== stored.length) {
				persistIncludedSettlementPros(filtered);
			}
			return;
		}

		if (unpaidLoads.length === 0) {
			setIncludedSettlementPros([]);
			return;
		}

		const defaults = defaultIncludedProsForWeek(
			unpaidLoads,
			openingDate,
			closingDate
		);
		setIncludedSettlementPros(defaults);
		persistIncludedSettlementPros(defaults);
	}, [
		closingWedStr,
		unpaidLoads,
		openingDate,
		closingDate,
		persistIncludedSettlementPros,
	]);

	const toggleSettlementProIncluded = useCallback(
		(proNumber) => {
			const key = String(proNumber);
			setIncludedSettlementPros((prev) => {
				const next = prev.includes(key)
					? prev.filter((p) => p !== key)
					: [...prev, key];
				persistIncludedSettlementPros(next);
				return next;
			});
		},
		[persistIncludedSettlementPros]
	);

	const handleMarkLoadPaid = useCallback(
		async (proNumber) => {
			const key = String(proNumber);
			const result = await dispatch(markLoadPaid({ proNumber: key, isPaid: true }));
			if (markLoadPaid.fulfilled.match(result)) {
				setIncludedSettlementPros((prev) => {
					const next = prev.filter((p) => p !== key);
					persistIncludedSettlementPros(next);
					return next;
				});
			}
		},
		[dispatch, persistIncludedSettlementPros]
	);

	const settlementLoadRevenue = useMemo(() => {
		const included = new Set(includedSettlementPros);
		return unpaidLoads.reduce((sum, load) => {
			if (!included.has(String(load.proNumber))) return sum;
			return sum + getLoadRevenueBeforeFuel(load);
		}, 0);
	}, [unpaidLoads, includedSettlementPros]);

	const currentWeekFuelTotal = useMemo(() => {
		return fuelStops
			.filter((stop) =>
				isDateInSettlementPeriod(stop.dateOfStop, openingDate, closingDate)
			)
			.reduce((sum, stop) => sum + (parseFloat(stop.totalFuelStop) || 0), 0);
	}, [fuelStops, openingDate, closingDate]);

	const estimatedSettlementNet = useMemo(
		() =>
			Math.round((settlementLoadRevenue - currentWeekFuelTotal) * 100) / 100,
		[settlementLoadRevenue, currentWeekFuelTotal]
	);

	const settlementIncludedCount = useMemo(() => {
		const included = new Set(includedSettlementPros);
		return unpaidLoads.filter((l) => included.has(String(l.proNumber))).length;
	}, [unpaidLoads, includedSettlementPros]);

	const [settlementProsModalOpen, setSettlementProsModalOpen] = useState(false);
	const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

	useEffect(() => {
		if (unpaidLoads.length === 0) setSettlementProsModalOpen(false);
	}, [unpaidLoads.length]);

	return (
		<Box sx={{ flexGrow: 1 }}>
			<Typography variant="h4" gutterBottom component="h2" sx={{ mb: 1 }}>
				Dashboard
			</Typography>

			<Paper
				variant="outlined"
				component="section"
				aria-label="Key metrics at a glance"
				sx={{
					p: { xs: 1.5, sm: 2 },
					mb: 2,
					borderRadius: 2,
					backgroundColor: "background.paper",
				}}
			>
				<Typography
					variant="subtitle2"
					component="h3"
					sx={{ fontWeight: 700, mb: 1.5, letterSpacing: "0.02em" }}
				>
					At a glance
				</Typography>
				<Grid container spacing={0}>
					<Grid
						item
						xs={12}
						md={4}
						sx={(theme) => ({
							p: { xs: 0, md: 1 },
							px: { xs: 1.5, md: 2 },
							borderRight: { md: `1px solid ${theme.palette.divider}` },
							borderBottom: {
								xs: `1px solid ${theme.palette.divider}`,
								md: "none",
							},
							pb: { xs: 2, md: 0 },
						})}
					>
						<Box
							sx={{
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								width: "100%",
							}}
						>
							<DashboardStatCallout
								layout="strip"
								label="Est. net this period"
								value={`$${estimatedSettlementNet.toFixed(2)}`}
								detail={`${periodLabel} · load revenue − fuel`}
							/>
							<DashboardStatCallout
								layout="strip"
								label="Load revenue (included)"
								value={`$${(Math.round(settlementLoadRevenue * 100) / 100).toFixed(2)}`}
								detail="Unpaid loads you included in the estimate"
							/>
							<DashboardStatCallout
								layout="strip"
								label="Fuel this period"
								value={`$${(Math.round(currentWeekFuelTotal * 100) / 100).toFixed(2)}`}
								detail={`${periodLabel} · all stops, with or without a load`}
							/>
						</Box>
					</Grid>
					<Grid
						item
						xs={12}
						md={4}
						sx={(theme) => ({
							p: { xs: 0, md: 1 },
							px: { xs: 1.5, md: 2 },
							borderRight: { md: `1px solid ${theme.palette.divider}` },
							borderBottom: {
								xs: `1px solid ${theme.palette.divider}`,
								md: "none",
							},
							py: { xs: 2, md: 0 },
						})}
					>
						<Box
							sx={{
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								width: "100%",
							}}
						>
							<DashboardStatCallout
								layout="strip"
								label="Avg net revenue / mi"
								value={
									periodAvgNetRevenuePerMile != null
										? `$${periodAvgNetRevenuePerMile.toFixed(2)}/mi`
										: "—"
								}
								detail="~2 mo. · same weeks as chart · net ÷ dispatched mi"
							/>
						</Box>
					</Grid>
					<Grid
						item
						xs={12}
						md={4}
						sx={{
							p: { xs: 0, md: 1 },
							px: { xs: 1.5, md: 2 },
							pt: { xs: 2, md: 0 },
						}}
					>
						<Box
							sx={{
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								width: "100%",
							}}
						>
							<DashboardStatCallout
								layout="strip"
								label="Blended MPG"
								value={
									mpgStats.overallMpg
										? `${mpgStats.overallMpg} MPG`
										: "—"
								}
								detail={`~2 mo. · gallons-weighted · ${mpgStats.fillCount} fill-up${
									mpgStats.fillCount !== 1 ? "s" : ""
								} · ${mpgStats.totalGallons || "—"} gal`}
							/>
						</Box>
					</Grid>
				</Grid>

				<Box
					sx={(theme) => ({
						borderTop: `1px solid ${theme.palette.divider}`,
						mt: 2,
						pt: 2,
					})}
				>
					<Grid container spacing={0}>
						<Grid
							item
							xs={12}
							md={4}
							sx={{
								p: { xs: 0, md: 1 },
								px: { xs: 1.5, md: 2 },
							}}
						>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 0.75,
									width: "100%",
									textAlign: "center",
								}}
							>
								{unpaidLoads.length > 0 ? (
									<>
										<Typography variant="caption" color="text.secondary">
											{settlementIncludedCount === unpaidLoads.length
												? `${unpaidLoads.length} unpaid load${
														unpaidLoads.length !== 1 ? "s" : ""
													} in estimate`
												: `${settlementIncludedCount} of ${unpaidLoads.length} unpaid load${
														unpaidLoads.length !== 1 ? "s" : ""
													} in estimate`}
										</Typography>
										<Button
											size="small"
											variant="outlined"
											onClick={() => setSettlementProsModalOpen(true)}
										>
											View / edit unpaid PROs
										</Button>
									</>
								) : (
									<Typography variant="caption" color="text.secondary">
										No unpaid delivered loads.
									</Typography>
								)}
							</Box>
						</Grid>
					</Grid>
				</Box>
			</Paper>

			<Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
				<Button
					variant="outlined"
					size="small"
					startIcon={<ReceiptLongIcon />}
					onClick={() => setReceiptDialogOpen(true)}
				>
					Add a new receipt
				</Button>
			</Stack>
			<OfficeReceiptDialog
				open={receiptDialogOpen}
				onClose={() => setReceiptDialogOpen(false)}
			/>

			{/* <ChartCaptureButton /> */}{/* Disabled - kept for debugging */}

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
							Unpaid loads — settlement estimate
						</Typography>
						<Typography variant="caption" color="text.secondary">
							Period {periodLabel}
						</Typography>
					</Stack>
				</DialogTitle>
				<DialogContent dividers>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						Delivery dates are only a guide. Check the loads you expect on this
						settlement, then mark paid once they appear on your check. Amounts are
						load revenue before fuel; weekly fuel is subtracted on the dashboard.
					</Typography>
					{unpaidLoads.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							All delivered loads are marked paid.
						</Typography>
					) : (
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
						{unpaidLoads.map((load) => {
							const pro = String(load.proNumber);
							const revenue = getLoadRevenueBeforeFuel(load);
							const included = includedSettlementPros.includes(pro);
							const inPeriod = isDeliveredInSettlementPeriod(
								load,
								openingDate,
								closingDate
							);
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
									<Box sx={{ minWidth: 0, flex: 1 }}>
										<Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
											PRO {pro}
											{!inPeriod && (
												<Typography
													component="span"
													variant="caption"
													color="warning.main"
													sx={{ ml: 1 }}
												>
													prior period
												</Typography>
											)}
										</Typography>
										<Typography
											variant="caption"
											color="text.secondary"
											display="block"
										>
											Delivered {load.dateDelivered} · ${revenue.toFixed(2)} load revenue
										</Typography>
									</Box>
									<Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
										<FormControlLabel
											control={
												<Checkbox
													size="small"
													checked={included}
													onChange={() => toggleSettlementProIncluded(pro)}
													inputProps={{
														"aria-label": `Include PRO ${pro} in settlement estimate`,
													}}
												/>
											}
											label="Include"
											sx={{ mr: 0 }}
										/>
										<Button
											size="small"
											variant="outlined"
											color="success"
											onClick={() => handleMarkLoadPaid(pro)}
										>
											Mark paid
										</Button>
									</Stack>
								</Stack>
							);
						})}
					</Stack>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSettlementProsModalOpen(false)}>Close</Button>
				</DialogActions>
			</Dialog>

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
						onClick={handleDeliverLoad}
						color="success"
						size="small"
						sx={{ ml: 1 }}
						title="Mark as delivered — enter ending odometer and details"
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
					<IconButton
						onClick={() => setCancelDialogLoad(activeLoad)}
						color="error"
						size="small"
						sx={{ ml: 1 }}
						title="Cancel Load"
					>
						<CancelIcon />
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
							Dispatched vs actual miles
						</Typography>
						{milesComparisonSummary.qualifyingCount === 0 ? (
							<Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
								Enter starting, pickup, and ending odometer on delivered loads
								(Loads page) to compare dispatched deadhead/loaded miles with
								odometer-based actuals.
							</Typography>
						) : (
							<>
								<Box sx={{ mb: 0.5 }}>
									<Typography
										variant="caption"
										color="text.secondary"
										display="block"
										sx={{ mb: 0.25 }}
									>
										<strong>Dispatched</strong> — deadhead:{" "}
										{Math.round(milesComparisonSummary.dispatchedDeadhead * 10) / 10}{" "}
										mi · loaded:{" "}
										{Math.round(milesComparisonSummary.dispatchedLoaded * 10) / 10} mi ·
										total:{" "}
										<strong>
											{Math.round(milesComparisonSummary.totalDispatched * 10) / 10} mi
										</strong>
									</Typography>
									<Typography variant="caption" color="text.secondary" display="block">
										<strong>Actual (odometer)</strong> — deadhead:{" "}
										{Math.round(milesComparisonSummary.actualDeadhead * 10) / 10} mi ·
										loaded:{" "}
										{Math.round(milesComparisonSummary.actualLoaded * 10) / 10} mi ·
										total:{" "}
										<strong>
											{Math.round(milesComparisonSummary.totalActual * 10) / 10} mi
										</strong>
									</Typography>
								</Box>
								{milesComparisonSummary.omittedDeliveredCount > 0 && (
									<Typography
										variant="caption"
										color="text.secondary"
										display="block"
										sx={{ mb: 1 }}
									>
										Based on {milesComparisonSummary.qualifyingCount} load
										{milesComparisonSummary.qualifyingCount !== 1 ? "s" : ""}{" "}
										with full odometer data;{" "}
										{milesComparisonSummary.omittedDeliveredCount} delivered load
										{milesComparisonSummary.omittedDeliveredCount !== 1 ? "s" : ""}{" "}
										omitted.
									</Typography>
								)}
								<Box sx={{ flexGrow: 1, position: "relative" }}>
									<Bar
										data={milesComparisonData}
										options={milesComparisonChartOptions}
									/>
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
						<Typography
							variant="caption"
							color="text.secondary"
							display="block"
							sx={{ mb: 1 }}
						>
							Weekly trend; the figure at the top matches this chart window.
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
						<Typography
							variant="caption"
							color="text.secondary"
							display="block"
							sx={{ mb: 1 }}
						>
							Weekly trend from fill-ups; blended MPG at the top matches this window.
						</Typography>
						<Box sx={{ flexGrow: 1, position: "relative" }}>
							<Line data={mpgChartData} options={mpgChartOptions} />
						</Box>
					</Paper>
				</Grid>
			</Grid>

			<LoadFormDialog
				open={activeLoadEditOpen}
				onClose={handleCloseActiveLoadEdit}
				deliverMode={deliverMode}
			/>
			<CancelLoadDialog
				open={Boolean(cancelDialogLoad)}
				load={cancelDialogLoad}
				attachedFuelStops={fuelStops.filter(
					(s) => s.proNumber === cancelDialogLoad?.proNumber
				)}
				onClose={() => setCancelDialogLoad(null)}
				onConfirm={handleCancelConfirm}
			/>
		</Box>
	);
}

export default Dashboard;
