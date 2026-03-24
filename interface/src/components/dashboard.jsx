import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { fetchLoads, updateLoad } from "../store/slices/loadsSlice";
import { fetchFuelStops } from "../store/slices/fuelStopsSlice";
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
	Button, // Import Button
	CircularProgress,
	Alert,
	IconButton,
} from "@mui/material";
// import ChartCaptureButton from "./ChartCaptureButton"; // Disabled - kept for debugging
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

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

	const handleEditLoad = () => {
		if (activeLoad && activeLoad.proNumber) {
			navigate("/loads");
			// The loads component will handle opening the modal with the load data
		}
	};

	const handleCompleteLoad = async () => {
		if (activeLoad && activeLoad.proNumber) {
			const currentDate = new Date();
			const year = currentDate.getFullYear();
			const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
			const day = currentDate.getDate().toString().padStart(2, "0");
			const formattedDate = `${year}-${month}-${day}`;

			const updatedLoadData = {
				...activeLoad,
				dateDelivered: formattedDate,
			};
			await dispatch(
				updateLoad({ proNumber: activeLoad.proNumber, load: updatedLoadData })
			);
		}
	};

	// Calculate total deadhead and loaded miles from actual loads data
	const totalDeadheadMiles = loads.reduce(
		(sum, load) => sum + (parseFloat(load.deadheadMiles) || 0),
		0
	);
	const totalLoadedMiles = loads.reduce(
		(sum, load) => sum + (parseFloat(load.loadedMiles) || 0),
		0
	);

	const milesData = {
		labels: ["Deadhead Miles", "Loaded Miles"],
		datasets: [
			{
				label: "Miles",
				data: [totalDeadheadMiles, totalLoadedMiles], // Using actual data
				backgroundColor: ["rgba(255, 99, 132, 0.2)", "rgba(54, 162, 235, 0.2)"],
				borderColor: ["rgba(255, 99, 132, 1)", "rgba(54, 162, 235, 1)"],
				borderWidth: 1,
			},
		],
	};

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
								const meta = chart.getDatasetMeta(0); // Pie chart usually has one dataset
								const style = meta.controller.getStyle(i);
								const value = data.datasets[0].data[i];
								const percentage = (
									(value / (totalDeadheadMiles + totalLoadedMiles)) *
									100
								).toFixed(1);

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

	// Calculate MPG statistics
	const calculateMPGStats = () => {
		// Calculate total actual miles from completed loads
		const totalActualMiles = loads
			.filter(
				(load) =>
					load.dateDelivered && load.endingOdometer && load.startingOdometer
			)
			.reduce((sum, load) => {
				const actualMiles =
					(load.endingOdometer || 0) - (load.startingOdometer || 0);
				return sum + Math.max(0, actualMiles); // Ensure non-negative
			}, 0);

		// Calculate total gallons from all fuel stops
		const totalGallons = fuelStops.reduce((sum, stop) => {
			return sum + (parseFloat(stop.gallonsDieselPurchased) || 0);
		}, 0);

		// Calculate overall MPG
		const overallMpg = totalGallons > 0 ? totalActualMiles / totalGallons : 0;

		return {
			totalMiles: Math.round(totalActualMiles),
			totalGallons: Math.round(totalGallons * 100) / 100,
			overallMpg: Math.round(overallMpg * 100) / 100,
		};
	};

	const mpgStats = calculateMPGStats();

	// Generate MPG trend chart data - by settlement week, last 2 months
	const generateMPGChartData = () => {
		const sortedStops = [...fuelStops].sort(
			(a, b) => new Date(a.dateOfStop) - new Date(b.dateOfStop)
		);

		if (sortedStops.length === 0) return { labels: [], datasets: [] };

		// Anchor 2-month window to the latest data point, not today,
		// so demo/future-dated data still gets filtered correctly.
		const latestDate = new Date(sortedStops[sortedStops.length - 1].dateOfStop);
		const cutoff = new Date(latestDate);
		cutoff.setMonth(cutoff.getMonth() - 2);

		const recentStops = sortedStops.filter(
			(stop) => new Date(stop.dateOfStop) >= cutoff
		);

		// Group by settlement week (closing Wednesday)
		const weeklyData = {};
		recentStops.forEach((stop) => {
			if (stop.odometerReading && stop.gallonsDieselPurchased) {
				const stopDate = new Date(stop.dateOfStop);
				const weekKey = getSettlementWeekKey(stopDate);

				if (!weeklyData[weekKey]) {
					weeklyData[weekKey] = {
						totalGallons: 0,
						firstOdometer: null,
						lastOdometer: null,
					};
				}

				weeklyData[weekKey].totalGallons +=
					parseFloat(stop.gallonsDieselPurchased) || 0;

				const odometer = parseFloat(stop.odometerReading) || 0;
				if (weeklyData[weekKey].firstOdometer === null) {
					weeklyData[weekKey].firstOdometer = odometer;
				}
				weeklyData[weekKey].lastOdometer = odometer;
			}
		});

		const labels = [];
		const data = [];

		Object.keys(weeklyData)
			.sort()
			.forEach((weekKey) => {
				const weekData = weeklyData[weekKey];
				const totalMiles =
					weekData.firstOdometer !== null && weekData.lastOdometer !== null
						? weekData.lastOdometer - weekData.firstOdometer
						: 0;

				if (weekData.totalGallons > 0 && totalMiles > 0) {
					// Label is MM-DD of the closing Wednesday
					labels.push(weekKey.slice(5));
					data.push(Math.round((totalMiles / weekData.totalGallons) * 100) / 100);
				}
			});

		return {
			labels,
			datasets: [
				{
					label: "Weekly MPG",
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
	};

	const mpgChartData = generateMPGChartData();

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
				text: "Fuel Efficiency Tracking",
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
						return `MPG: ${context.parsed.y}`;
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

	const activeLoad = loads.find((load) => !load.dateDelivered);

	return (
		<Box sx={{ flexGrow: 1 }}>
			<Typography variant="h4" gutterBottom component="h2" sx={{ mb: 2 }}>
				Dashboard
			</Typography>

			{/* <ChartCaptureButton /> */}{/* Disabled - kept for debugging */}

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
						title="Mark as Delivered"
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
							Deadhead vs Loaded Miles
						</Typography>
						<Box sx={{ flexGrow: 1, position: "relative" }}>
							<Pie data={milesData} options={pieChartOptions} />
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
							Fuel Efficiency (MPG)
						</Typography>
						<Box sx={{ flexGrow: 1, position: "relative" }}>
							<Line data={mpgChartData} options={mpgChartOptions} />
						</Box>
					</Paper>
				</Grid>
			</Grid>
		</Box>
	);
}

export default Dashboard;
