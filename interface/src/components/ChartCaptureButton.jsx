import React from "react";
import { Button, Box } from "@mui/material";
import { downloadChartImage, captureCharts } from "../utils/chartCapture";

const ChartCaptureButton = () => {
	const handleCaptureCharts = async () => {
		try {
			const result = await captureCharts();
			if (result && result.blob) {
				downloadChartImage(result.blob, "dashboard_charts.png");
			} else {
				console.error("Failed to capture charts");
			}
		} catch (error) {
			console.error("Error capturing charts:", error);
		}
	};

	return (
		<Box sx={{ mb: 3, textAlign: "center" }}>
			<Button
				variant="contained"
				onClick={handleCaptureCharts}
				sx={{
					backgroundColor: "#2563eb",
					color: "white",
					"&:hover": {
						backgroundColor: "#1d4ed8",
					},
					padding: "10px 24px",
					fontSize: "14px",
					fontWeight: "bold",
					borderRadius: "8px",
					boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
				}}
			>
				📸 Capture Charts
			</Button>
		</Box>
	);
};

export default ChartCaptureButton;
