// src/components/Login.jsx
import { React, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../store/slices/authSlice";
import { useNavigate, Link as RouterLink } from "react-router-dom";
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
} from "@mui/material";

function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const dispatch = useDispatch();
	const { error } = useSelector((state) => state.auth || {});
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		const result = await dispatch(login({ email, password }));
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
							placeholder="Email Address"
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
							placeholder="Password"
							type="password"
							id="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
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
}

export default Login;
