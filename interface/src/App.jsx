import React, { useState, useEffect } from "react";
import axios from "axios";
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
	Collapse,
	ListSubheader,
	Chip,
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
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
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

	// Menu state for dropdowns
	const [onTheRoadAnchorEl, setOnTheRoadAnchorEl] = useState(null);
	const [inTheOfficeAnchorEl, setInTheOfficeAnchorEl] = useState(null);
	const [isOnTheRoadOpen, setIsOnTheRoadOpen] = useState(false);
	const [isInTheOfficeOpen, setIsInTheOfficeOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);

	// Menu data structure
	const menuItems = {
		"On The Road": [
			{ text: "Loads", path: "/loads", icon: <LocalShippingIcon /> },
			{
				text: "Fuel Stops",
				path: "/fuel-stops",
				icon: <LocalGasStationIcon />,
			},
		],
		"In The Office": [
			{ text: "Expenses", path: "/other-expenses", icon: <AttachMoneyIcon /> },
			{ text: "Maintenance", path: "/maintenance", icon: <BuildIcon /> },
		],
	};

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

	// Redirect to login on 401
	useEffect(() => {
		const interceptor = axios.interceptors.response.use(
			(response) => response,
			(error) => {
				if (error.response?.status === 401) {
					dispatch(logout());
					navigate("/login", { state: { message: "You must be logged in to access this page." } });
				}
				return Promise.reject(error);
			}
		);
		return () => axios.interceptors.response.eject(interceptor);
	}, [dispatch, navigate]);

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

	// Menu handlers
	const handleOnTheRoadClick = (event) => {
		setOnTheRoadAnchorEl(event.currentTarget);
		setIsOnTheRoadOpen(true);
	};

	const handleInTheOfficeClick = (event) => {
		setInTheOfficeAnchorEl(event.currentTarget);
		setIsInTheOfficeOpen(true);
	};

	const handleMenuClose = () => {
		setOnTheRoadAnchorEl(null);
		setInTheOfficeAnchorEl(null);
		setIsOnTheRoadOpen(false);
		setIsInTheOfficeOpen(false);
	};

	const handleMenuItemClick = (path) => {
		navigate(path);
		handleMenuClose();
	};

	// Mobile navigation items
	const mobileNavItems = [
		{ text: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
		{ text: "Loads", path: "/loads", icon: <LocalShippingIcon /> },
		{ text: "Fuel Stops", path: "/fuel-stops", icon: <LocalGasStationIcon /> },
		{ text: "Expenses", path: "/other-expenses", icon: <AttachMoneyIcon /> },
		{ text: "Maintenance", path: "/maintenance", icon: <BuildIcon /> },
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

					{/* Desktop Menu */}
					<Box sx={{ flexGrow: 1, display: { xs: "none", sm: "flex" } }}>
						<Button
							color="inherit"
							onClick={handleOnTheRoadClick}
							endIcon={isOnTheRoadOpen ? <ExpandLess /> : <ExpandMore />}
						>
							On The Road
						</Button>
						<Menu
							anchorEl={onTheRoadAnchorEl}
							open={Boolean(onTheRoadAnchorEl) && isOnTheRoadOpen}
							onClose={handleMenuClose}
						>
							{menuItems["On The Road"].map((item) => (
								<MenuItem
									key={item.text}
									onClick={() => handleMenuItemClick(item.path)}
									sx={{ minWidth: 150 }}
								>
									<ListItemIcon>{item.icon}</ListItemIcon>
									<ListItemText>{item.text}</ListItemText>
								</MenuItem>
							))}
						</Menu>

						<Button
							color="inherit"
							onClick={handleInTheOfficeClick}
							endIcon={isInTheOfficeOpen ? <ExpandLess /> : <ExpandMore />}
						>
							In The Office
						</Button>
						<Menu
							anchorEl={inTheOfficeAnchorEl}
							open={Boolean(inTheOfficeAnchorEl) && isInTheOfficeOpen}
							onClose={handleMenuClose}
						>
							{menuItems["In The Office"].map((item) => (
								<MenuItem
									key={item.text}
									onClick={() => handleMenuItemClick(item.path)}
									sx={{ minWidth: 150 }}
								>
									<ListItemIcon>{item.icon}</ListItemIcon>
									<ListItemText>{item.text}</ListItemText>
								</MenuItem>
							))}
						</Menu>
					</Box>

					<Box sx={{ flexGrow: 1, display: { sm: "none" } }} />
					<Button
						color="inherit"
						onClick={handleDonateClick}
						startIcon={<VolunteerActivismIcon />}
						sx={{ display: { xs: "none", sm: "inline-flex" } }}
					>
						Support App
					</Button>
					<Tooltip title="Settings">
						<IconButton
							color="inherit"
							onClick={() => setIsSettingsOpen(true)}
							sx={{ ml: 1 }}
						>
							<SettingsIcon />
						</IconButton>
					</Tooltip>
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
				<Box sx={{ textAlign: "center", p: 2 }}>
					<Typography variant="h6" sx={{ my: 2 }}>
						Navigation
					</Typography>
					<Divider />
					<List onClick={handleDrawerToggle}>
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
					<Divider />
					<List>
						<ListItem disablePadding>
							<ListItemButton
								onClick={() => { handleDrawerToggle(); setIsSettingsOpen(true); }}
								sx={{ minHeight: 48 }}
							>
								<ListItemIcon><SettingsIcon /></ListItemIcon>
								<ListItemTextMui primary="Settings" />
							</ListItemButton>
						</ListItem>
					</List>
				</Box>
			</Drawer>

			<Box
				component="main"
				sx={{
					flexGrow: 1,
					p: { xs: 1, sm: 3 },
					width: "100%",
					mt: { xs: 8, sm: 8 },
				}}
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
			<Settings open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
		</Box>
	);
}

export default App;
