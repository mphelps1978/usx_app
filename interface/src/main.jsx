import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App.jsx";
import { store } from "./store";
import { setTokenFromStorage } from "./store/slices/authSlice";
import "./index.css";

// QuickBooks Green theme
const theme = createTheme({
	palette: {
		primary: {
			main: "#2CA01C", // QuickBooks Green
		},
		secondary: {
			main: "#1976d2",
		},
		background: {
			default: "#f5f5f5",
		},
	},
	typography: {
		fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
	},
	components: {
		MuiAppBar: {
			styleOverrides: {
				colorPrimary: {
					backgroundColor: "#2CA01C",
				},
			},
		},
	},
});

// Check for token in localStorage on app load
const token = localStorage.getItem("authToken");
if (token) {
	store.dispatch(setTokenFromStorage(token));
}

ReactDOM.createRoot(document.getElementById("root")).render(
	<Provider store={store}>
		<BrowserRouter>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<App />
			</ThemeProvider>
		</BrowserRouter>
	</Provider>
);
