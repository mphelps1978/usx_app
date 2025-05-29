import { React, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { register } from "../store/slices/authSlice";
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

function Register() {
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const dispatch = useDispatch();
	const { error } = useSelector((state) => state.auth || {}); // Ensure auth exists
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		const result = await dispatch(register({ username, email, password }));
		if (register.fulfilled.match(result)) {
			navigate("/login"); // Navigate to login after successful registration
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
						Create Account
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
							id="username"
							label="Username"
							name="username"
							autoComplete="username"
							autoFocus
							value={username}
							onChange={(e) => setUsername(e.target.value)}
						/>
						<TextField
							margin="normal"
							required
							fullWidth
							id="email"
							label="Email Address"
							name="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<TextField
							margin="normal"
							required
							fullWidth
							name="password"
							label="Password"
							type="password"
							id="password"
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
						<Button
							type="submit"
							fullWidth
							variant="contained"
							sx={{ mt: 3, mb: 2 }}
						>
							Register
						</Button>
						<Typography variant="body2" align="center">
							Already have an account?{" "}
							<Link component={RouterLink} to="/login" variant="body2">
								Login
							</Link>
						</Typography>
					</Box>
				</CardContent>
			</Card>
		</Container>
	);
}

export default Register;
