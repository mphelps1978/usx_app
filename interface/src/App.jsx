import React, { useState, useEffect } from "react";
import {
	Route,
	Routes,
	Navigate,
	Link as RouterLink,
	useNavigate,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Loads from "./components/Loads";
import FuelStops from "./components/FuelStops";
import Maintenance from "./components/Maintenance";
import Repairs from "./components/Repairs";
import OtherExpenses from "./components/OtherExpenses";
import Settlements from "./components/Settlements";
import Taxes from "./components/Taxes";
import Settings from "./components/Settings";
import { logout } from "./store/slices/authSlice";
import { fetchUserSettings } from "./store/slices/userSettingsSlice";
import {
	Box,
	Toolbar,
	Typography,
	AppBar,
	Button,
	Menu,
	MenuItem,
	IconButton,
	Tooltip, // Import Tooltip
	ListItemIcon,
	ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import BuildIcon from "@mui/icons-material/Build";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import DescriptionIcon from "@mui/icons-material/Description";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SettingsIcon from "@mui/icons-material/Settings";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism"; // Icon for donation
import { version } from "../package.json"; // Import version from package.json

function App() {
	const auth = useSelector((state) => state.auth || {});
	const { token } = auth;
	const dispatch = useDispatch();
	const navigate = useNavigate();

	// Placeholder for your PayPal donation link
	const PAYPAL_DONATION_LINK =
		"https://www.paypal.com/donate/?business=RBSRSCUEHL4CU&no_recurring=0&currency_code=USD";

	// Fetch user settings when the authenticated app loads
	useEffect(() => {
		if (token) {
			// Only fetch if authenticated
			dispatch(fetchUserSettings());
		}
	}, [dispatch, token]);

	const [anchorElOnTheRoad, setAnchorElOnTheRoad] = useState(null);
	const [anchorElInTheOffice, setAnchorElInTheOffice] = useState(null);

	const handleMenuOpen = (event, setAnchorEl) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = (setAnchorEl) => {
		setAnchorEl(null);
	};

	const handleNavigate = (path, setAnchorEl) => {
		navigate(path);
		if (setAnchorEl) {
			handleMenuClose(setAnchorEl);
		}
	};

	const handleLogout = () => {
		dispatch(logout());
		navigate("/login");
	};

	const handleDonateClick = () => {
		window.open(PAYPAL_DONATION_LINK, "_blank", "noopener,noreferrer");
	};

	const onTheRoadItems = [
		{
			text: "Loads",
			path: "/loads",
			icon: <LocalShippingIcon />,
			implemented: true,
		},
		{
			text: "Fuel Stops",
			path: "/fuel-stops",
			icon: <LocalGasStationIcon />,
			implemented: true,
		},
		{
			text: "Maintenance",
			path: "/maintenance",
			icon: <BuildIcon />,
			implemented: false,
		},
		{
			text: "Repairs",
			path: "/repairs",
			icon: <BuildIcon />,
			implemented: false,
		},
		{
			text: "Other Expenses",
			path: "/other-expenses",
			icon: <AttachMoneyIcon />,
			implemented: false,
		},
	];

	const inTheOfficeItems = [
		{
			text: "Settlements",
			path: "/settlements",
			icon: <DescriptionIcon />,
			implemented: false,
		},
		{
			text: "Taxes",
			path: "/taxes",
			icon: <AccountBalanceIcon />,
			implemented: false,
		},
	];

	// Helper function to render menu items, with tooltip for non-implemented ones
	const renderMenuItem = (item, setAnchorEl) => {
		const menuItemContent = (
			<MenuItem
				key={item.text}
				onClick={() =>
					item.implemented ? handleNavigate(item.path, setAnchorEl) : null
				}
				disabled={!item.implemented} // Optionally disable non-implemented items
			>
				{item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
				<ListItemText primary={item.text} />
			</MenuItem>
		);

		if (!item.implemented) {
			// For disabled items, wrap them in a span for the Tooltip to work
			return (
				<Tooltip title="Coming Soon" key={`${item.text}-tooltip`}>
					{/* The span wrapper allows Tooltip to show on a disabled MenuItem */}
					<span style={{ display: "block", width: "100%" }}>
						{menuItemContent}
					</span>
				</Tooltip>
			);
		}

		return menuItemContent;
	};

	if (!token) {
		// Render routes for unauthenticated users
		return (
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route path="/register" element={<Register />} />
				<Route path="*" element={<Navigate to="/login" />} />
			</Routes>
		);
	}

	// Render layout for authenticated users
	return (
		<Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
			<AppBar position="static">
				<Toolbar>
					<Typography
						variant="h6"
						noWrap
						component={RouterLink}
						to="/dashboard"
						sx={{
							// flexGrow: 1, // Removed from here
							color: "inherit",
							textDecoration: "none",
							mr: 2,
						}}
					>
						USX IC Books
					</Typography>

					<Button
						color="inherit"
						onClick={handleDonateClick}
						startIcon={<VolunteerActivismIcon />}
						sx={{ mr: 2 }} // Added margin to the right for spacing
						aria-label="donate"
					>
						Support App
					</Button>

					<Button
						color="inherit"
						onClick={() => handleNavigate("/dashboard")}
						startIcon={<DashboardIcon />}
					>
						Dashboard
					</Button>

					{/* This Box will now act as the spacer to push subsequent items to the right */}
					<Box sx={{ flexGrow: 1 }} />

					<Button
						color="inherit"
						onClick={(e) => handleMenuOpen(e, setAnchorElOnTheRoad)}
					>
						On The Road
					</Button>
					<Menu
						anchorEl={anchorElOnTheRoad}
						open={Boolean(anchorElOnTheRoad)}
						onClose={() => handleMenuClose(setAnchorElOnTheRoad)}
					>
						{onTheRoadItems.map((item) =>
							renderMenuItem(item, setAnchorElOnTheRoad)
						)}
					</Menu>

					<Button
						color="inherit"
						onClick={(e) => handleMenuOpen(e, setAnchorElInTheOffice)}
					>
						In The Office
					</Button>
					<Menu
						anchorEl={anchorElInTheOffice}
						open={Boolean(anchorElInTheOffice)}
						onClose={() => handleMenuClose(setAnchorElInTheOffice)}
					>
						{inTheOfficeItems.map((item) =>
							renderMenuItem(item, setAnchorElInTheOffice)
						)}
					</Menu>

					<Button
						color="inherit"
						onClick={() => handleNavigate("/settings")}
						startIcon={<SettingsIcon />}
						sx={{ ml: 1 }}
					>
						Settings
					</Button>

					<Button
						color="inherit"
						onClick={handleLogout}
						startIcon={<ExitToAppIcon />}
						sx={{ ml: 2 }}
					>
						Logout
					</Button>
				</Toolbar>
			</AppBar>

			<Box component="main" sx={{ flexGrow: 1, p: 3, width: "100%" }}>
				<Routes>
					<Route path="/dashboard" element={<Dashboard />} />
					<Route path="/loads" element={<Loads />} />
					<Route path="/fuel-stops" element={<FuelStops />} />
					<Route path="/maintenance" element={<Maintenance />} />
					<Route path="/repairs" element={<Repairs />} />
					<Route path="/other-expenses" element={<OtherExpenses />} />
					<Route path="/settlements" element={<Settlements />} />
					<Route path="/taxes" element={<Taxes />} />
					<Route path="/settings" element={<Settings />} />
					<Route path="/" element={<Navigate to="/dashboard" />} />
					<Route path="*" element={<Navigate to="/dashboard" />} />
				</Routes>
			</Box>

			{/* Footer to display version number */}
			<Box
				component="footer"
				sx={{
					py: 1, // Padding top and bottom
					px: 2, // Padding left and right
					mt: "auto", // Pushes footer to the bottom if content is short
					backgroundColor: (theme) =>
						theme.palette.mode === "light"
							? theme.palette.grey[200]
							: theme.palette.grey[800],
					textAlign: "center",
				}}
			>
				<Typography variant="caption" color="textSecondary">
					App Version: {version}
				</Typography>
			</Box>
		</Box>
	);
}

export default App;
