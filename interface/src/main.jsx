import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { store } from "./store";
import { setTokenFromStorage } from "./store/slices/authSlice";
import "./index.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// QuickBooks-inspired theme
const quickBooksTheme = createTheme({
	palette: {
		primary: {
			main: "#2CA02C", // A QuickBooks-like green
		},
		secondary: {
			main: "#0073E6", // A QuickBooks-like blue for secondary actions
		},
		background: {
			default: "#f4f5f8", // Light gray page background
			paper: "#ffffff", // White for card backgrounds
		},
		text: {
			primary: "#1c1e21", // Darker text for readability
			secondary: "#5b6166", // Lighter text for secondary info
		},
	},
	typography: {
		fontFamily: "'Inter', 'Helvetica Neue', 'Arial', sans-serif", // A clean sans-serif font stack
		h4: {
			fontWeight: 600, // Bolder headings
		},
		h6: {
			fontWeight: 500,
		},
		button: {
			textTransform: "none", // Buttons with normal casing
			fontWeight: 600,
		},
	},
	components: {
		MuiCard: {
			styleOverrides: {
				root: {
					borderRadius: 8, // Slightly more rounded cards
					boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)", // Softer shadow
				},
			},
		},
		MuiButton: {
			styleOverrides: {
				root: {
					borderRadius: 6, // Consistent button border radius
				},
			},
		},
		// We can add more component overrides here
	},
});

// Check for token in localStorage on app load
const token = localStorage.getItem("authToken");
if (token) {
	store.dispatch(setTokenFromStorage(token));
}

ReactDOM.createRoot(document.getElementById("root")).render(
	<Provider store={store}>
		<ThemeProvider theme={quickBooksTheme}>
			<CssBaseline />
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ThemeProvider>
	</Provider>
);
