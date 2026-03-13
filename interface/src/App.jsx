import React, { useState, useEffect } from "react";
import {
	Route,
	Routes,
	Navigate,
	Link as RouterLink,
	useNavigate,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Login from "./components/login";
import Register from "./components/register";
import Dashboard from "./components/dashboard";
import Loads from "./components/loads";
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
	Tooltip,
	ListItemIcon,
	ListItemText,
	Link as MuiLink,
	Drawer,
	List,
	ListItem,
	ListItemButton,
	ListItemText as ListItemTextMui,
	Divider,
	BottomNavigation,
	BottomNavigationAction,
	Container,
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
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import HomeIcon from "@mui/icons-material/Home";
import { version } from "../package.json";
import { logErrorToServer } from "./utils/errorLogger";
import BugReportModal from "./components/BugReportModal";

function App() {
	const auth = useSelector((state) => state.auth || {});
	const { token, userId } = auth;
	const dispatch = useDispatch();
	const navigate = useNavigate();

	const PAYPAL_DONATION_LINK =
		"https://www.paypal.com/donate/?business=RBSRSCUEHL4CU&no_recurring=0&currency_code=USD";
	const [isBugModalOpen, setIsBugModalOpen] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [value, setValue] = useState(0);

	// Fetch user settings when the authenticated app loads
	useEffect(() => {
		if (token) {
			dispatch(fetchUserSettings());
		}
	}, [dispatch, token]);

	// Setup global error handlers
	useEffect(() => {
		const originalOnError = window.onerror;
		const originalOnUnhandledRejection = window.onunhandledrejection;

		window.onerror = (message, source, lineno, colno, error) => {
			logErrorToServer(error || new Error(message), {
				context: "global-onerror",
				additionalInfo: { source, lineno, colno },
			});
			if (originalOnError) {
				return originalOnError(message, source, lineno, colno, error);
			}
			return false;
		};

		window.onunhandledrejection = (event) => {
			logErrorToServer(
				event.reason || new Error("Unhandled promise rejection"),
				{ context: "global-unhandledrejection" }
			);
			if (originalOnUnhandledRejection) {
				return originalOnUnhandledRejection(event);
			}
		};

		return () => {
			window.onerror = originalOnError;
			window.onunhandledrejection = originalOnUnhandledRejection;
		};
	}, []);

	const handleOpenBugModal = () => setIsBugModalOpen(true);
	const handleCloseBugModal = () => setIsBugModalOpen(false);

	const handleDrawerToggle = () => {
		setMobileOpen(!mobileOpen);
	};

	const handleLogout = () => {
		dispatch(logout());
		navigate("/login");
	};

	const handleDonateClick = () => {
		window.open(PAYPAL_DONATION_LINK, "_blank", "noopener,noreferrer");
	};

	// Mobile navigation items
	const mobileNavItems = [
		{ text: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
		{ text: "Loads", path: "/loads", icon: <LocalShippingIcon /> },
		{ text: "Fuel Stops", path: "/fuel-stops", icon: <LocalGasStationIcon /> },
		{ text: "Settings", path: "/settings", icon: <SettingsIcon /> },
	];

	// Bottom navigation for quick access
	const bottomNavItems = [
		{ label: "Home", icon: <HomeIcon />, path: "/dashboard" },
		{ label: "Loads", icon: <LocalShippingIcon />, path: "/loads" },
		{ label: "Fuel", icon: <LocalGasStationIcon />, path: "/fuel-stops" },
	];

	if (!token) {
		return (
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route path="/register" element={<Register />} />
				<Route path="*" element={<Navigate to="/login" />} />
			</Routes>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
			<AppBar
				position="fixed"
				sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
			>
				<Toolbar>
					<IconButton
						color="inherit"
						aria-label="open drawer"
						edge="start"
						onClick={handleDrawerToggle}
						sx={{ mr: 2, display: { sm: "none" } }}
					>
						<MenuIcon />
					</IconButton>
					<Typography
						variant="h6"
						noWrap
						component={RouterLink}
						to="/dashboard"
						sx={{
							color: "inherit",
							textDecoration: "none",
							mr: 2,
							fontSize: { xs: "1.1rem", sm: "1.25rem" },
						}}
					>
						USX IC Books
					</Typography>
					<Box sx={{ flexGrow: 1 }} />
					<Button
						color="inherit"
						onClick={handleDonateClick}
						startIcon={<VolunteerActivismIcon />}
						sx={{ display: { xs: "none", sm: "inline-flex" } }}
					>
						Support App
					</Button>
					<Button
						color="inherit"
						onClick={handleLogout}
						startIcon={<ExitToAppIcon />}
						sx={{ ml: 1 }}
					>
						Logout
					</Button>
				</Toolbar>
			</AppBar>

			{/* Mobile Drawer */}
			<Drawer
				variant="temporary"
				open={mobileOpen}
				onClose={handleDrawerToggle}
				sx={{
					display: { xs: "block", sm: "none" },
					"& .MuiDrawer-paper": { boxSizing: "border-box", width: 240 },
				}}
				ModalProps={{
					keepMounted: true, // Better open performance on mobile.
				}}
			>
				<Box onClick={handleDrawerToggle} sx={{ textAlign: "center", p: 2 }}>
					<Typography variant="h6" sx={{ my: 2 }}>
						Navigation
					</Typography>
					<Divider />
					<List>
						{mobileNavItems.map((item) => (
							<ListItem key={item.text} disablePadding>
								<ListItemButton
									component={RouterLink}
									to={item.path}
									sx={{ minHeight: 48 }}
								>
									<ListItemIcon>{item.icon}</ListItemIcon>
									<ListItemTextMui primary={item.text} />
								</ListItemButton>
							</ListItem>
						))}
					</List>
				</Box>
			</Drawer>

			<Box
				component="main"
				sx={{ flexGrow: 1, p: { xs: 1, sm: 3 }, width: "100%" }}
			>
				<Container maxWidth="xl">
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
				</Container>
			</Box>

			{/* Bottom Navigation for Mobile */}
			<Box sx={{ display: { xs: "block", sm: "none" } }}>
				<BottomNavigation
					showLabels
					value={value}
					onChange={(event, newValue) => {
						setValue(newValue);
						navigate(bottomNavItems[newValue].path);
					}}
					sx={{ position: "fixed", bottom: 0, width: "100%", zIndex: 1000 }}
				>
					{bottomNavItems.map((item) => (
						<BottomNavigationAction
							key={item.label}
							label={item.label}
							icon={item.icon}
						/>
					))}
				</BottomNavigation>
			</Box>

			{/* Footer */}
			<Box
				component="footer"
				sx={{
					py: 1,
					px: 2,
					mt: "auto",
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
				<Typography variant="caption" color="textSecondary" sx={{ mx: 0.5 }}>
					|
				</Typography>
				<MuiLink
					component="button"
					variant="caption"
					onClick={handleOpenBugModal}
					sx={{
						cursor: "pointer",
						color: "text.secondary",
						textDecoration: "underline",
					}}
				>
					Report a Bug
				</MuiLink>
			</Box>
			<BugReportModal open={isBugModalOpen} onClose={handleCloseBugModal} />
		</Box>
	);
}

export default App;
