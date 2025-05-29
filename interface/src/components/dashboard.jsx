import { React, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchLoads } from "../store/slices/loadsSlice";
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
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import {
	Grid,
	Paper,
	Typography,
	Box,
	CircularProgress,
	Alert,
} from "@mui/material";

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
	PointElement
);

// Helper function to get ISO week and year key
function getISOWeekYearKey(date) {
	const d = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
	);
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(
		((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
	);
	return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Helper function to get the date of the Wednesday ending a given ISO week
function getWeekEndingWednesday(year, weekNumber) {
	// Calculate the date of the first day of the given week
	// ISO 8601 weeks start on Monday.
	// The first Thursday of a year is in week 1.
	const jan4 = new Date(Date.UTC(year, 0, 4)); // January 4th of the year
	const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
	const dayOfWeekJan4 = jan4.getUTCDay() || 7; // Sunday is 0, make it 7 for consistency (Mon=1..Sun=7)

	// Calculate the date of the Monday of week 1
	const mondayOfWeek1 = new Date(jan4);
	mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeekJan4 + 1);

	// Calculate the date of the Monday of the target week
	const targetMonday = new Date(mondayOfWeek1);
	targetMonday.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNumber - 1) * 7);

	// Wednesday is 2 days after Monday (Monday is day 0 in this context of a week)
	const targetWednesday = new Date(targetMonday);
	targetWednesday.setUTCDate(targetMonday.getUTCDate() + 2);

	return targetWednesday;
}

function Dashboard() {
	const dispatch = useDispatch();
	const {
		list: loads,
		loading,
		error,
	} = useSelector(
		(state) => state.loads || { list: [], loading: false, error: null }
	);

	useEffect(() => {
		dispatch(fetchLoads());
	}, [dispatch]);

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

	// Calculate Miles per Net Dollar by Week
	const weeklyMilesAndRevenue = {};
	loads.forEach((load) => {
		if (load.dateDelivered && load.projectedNet) {
			try {
				const date = new Date(load.dateDelivered);
				if (isNaN(date.getTime())) return;
				const weekKey = getISOWeekYearKey(date);

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

	const weeklyChartLabels = sortedWeekKeys.map((key) => {
		const [yearStr, weekPart] = key.split("-W");
		const year = parseInt(yearStr, 10);
		const weekNumber = parseInt(weekPart, 10);
		const wednesday = getWeekEndingWednesday(year, weekNumber);
		const month = (wednesday.getUTCMonth() + 1).toString().padStart(2, "0");
		const day = wednesday.getUTCDate().toString().padStart(2, "0");
		return `${month}-${day}`;
	});

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
			datalabels: {
				display: false,
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

	const activeLoad = loads.find((load) => !load.dateDelivered);

	return (
		<Box sx={{ flexGrow: 1 }}>
			<Typography variant="h4" gutterBottom component="h2" sx={{ mb: 2 }}>
				Dashboard
			</Typography>

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
			</Grid>
		</Box>
	);
}

export default Dashboard;
