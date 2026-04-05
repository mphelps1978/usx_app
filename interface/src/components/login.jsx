import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../store/slices/authSlice";
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import {
	Container,
	Box,
	Card,
	CardContent,
	Typography,
	TextField,
	Button,
	Link,
	Alert,
	InputAdornment,
	IconButton,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const Login = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const dispatch = useDispatch();
	const { error } = useSelector((state) => state.auth || {});
	const navigate = useNavigate();
	const location = useLocation();
	const redirectMessage = location.state?.message;

	const handleSubmit = async (e) => {
		e.preventDefault();
		const result = await dispatch(
			login({ email: email.trim(), password })
		);
		if (login.fulfilled.match(result)) {
			navigate("/dashboard");
		}
	};

	return (
		<Container
			component="main"
			maxWidth="xs"
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "100vh",
			}}
		>
			<Card sx={{ minWidth: 300, width: "100%", p: 2, boxShadow: 3 }}>
				<CardContent>
					<Typography
						variant="h4"
						component="h1"
						align="center"
						gutterBottom
						sx={{ color: "primary.main" }}
					>
						Trucking Management
					</Typography>
					<Typography
						variant="h6"
						component="h2"
						align="center"
						gutterBottom
						color="text.secondary"
					>
						Sign In
					</Typography>
					{redirectMessage && (
						<Alert severity="warning" sx={{ mb: 2 }}>
							{redirectMessage}
						</Alert>
					)}
					{error && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{error}
						</Alert>
					)}
					<Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
						<TextField
							margin="normal"
							required
							fullWidth
							id="email"
							label="Email Address"
							name="email"
							autoComplete="email"
							autoFocus
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<TextField
							margin="normal"
							required
							fullWidth
							name="password"
							label="Password"
							type={showPassword ? "text" : "password"}
							id="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							InputProps={{
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											aria-label={
												showPassword ? "hide password" : "show password"
											}
											onClick={() => setShowPassword((v) => !v)}
											edge="end"
										>
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								),
							}}
						/>
						<Button
							type="submit"
							fullWidth
							variant="contained"
							sx={{ mt: 3, mb: 2 }}
						>
							Sign In
						</Button>
						<Typography variant="body2" align="center">
							Don&apos;t have an account?{" "}
							<Link component={RouterLink} to="/register" variant="body2">
								Register
							</Link>
						</Typography>
					</Box>
				</CardContent>
			</Card>
		</Container>
	);
};

export default Login;
