import React, { useState } from "react";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	TextField,
	Box,
	Alert,
} from "@mui/material";
import axios from "axios";
import { useSelector } from "react-redux";
import { version } from "../../package.json";

const API_URL = "http://localhost:3001/api";

function BugReportModal({ open, onClose }) {
	const [description, setDescription] = useState("");
	const [steps, setSteps] = useState("");
	const [contactEmail, setContactEmail] = useState(""); // Optional
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState({ type: "", message: "" }); // 'success' or 'error'

	const auth = useSelector((state) => state.auth || {});
	// You might want to prefill email if available from user profile/auth state
	// useEffect(() => {
	//   if (auth.user && auth.user.email) {
	//     setContactEmail(auth.user.email);
	//   }
	// }, [auth.user, open]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);
		setSubmitStatus({ type: "", message: "" });

		const bugData = {
			description,
			stepsToReproduce: steps,
			contactEmail: contactEmail || null, // Send null if empty
			url: window.location.href,
			userAgent: navigator.userAgent,
			appVersion: version,
			// userId will be added by backend if authenticated
		};

		try {
			const token = localStorage.getItem("authToken");
			const headers = {};
			if (token) {
				headers["Authorization"] = `Bearer ${token}`;
			}
			await axios.post(`${API_URL}/report-bug`, bugData, { headers });
			setSubmitStatus({
				type: "success",
				message: "Bug report submitted successfully. Thank you!",
			});
			setDescription("");
			setSteps("");
			// setContactEmail(''); // Optionally clear email or keep prefill
			// Optionally close modal after a short delay or let user close it
			// setTimeout(onClose, 2000);
		} catch (error) {
			console.error("Failed to submit bug report:", error);
			setSubmitStatus({
				type: "error",
				message:
					error.response?.data?.message ||
					"Failed to submit bug report. Please try again.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleModalClose = () => {
		if (isSubmitting) return; // Prevent closing while submitting
		setDescription("");
		setSteps("");
		// setContactEmail('');
		setSubmitStatus({ type: "", message: "" });
		onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={handleModalClose}
			PaperProps={{ component: "form", onSubmit: handleSubmit }}
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle>Report a Bug</DialogTitle>
			<DialogContent>
				{submitStatus.message && (
					<Alert severity={submitStatus.type} sx={{ mb: 2 }}>
						{submitStatus.message}
					</Alert>
				)}
				{!submitStatus.type || submitStatus.type === "error" ? (
					<>
						<DialogContentText sx={{ mb: 2 }}>
							Please provide as much detail as possible to help us understand
							and fix the issue.
						</DialogContentText>
						<TextField
							autoFocus
							margin="dense"
							id="description"
							label="Bug Description"
							type="text"
							fullWidth
							variant="outlined"
							multiline
							rows={4}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							required
							disabled={isSubmitting}
						/>
						<TextField
							margin="dense"
							id="steps"
							label="Steps to Reproduce"
							type="text"
							fullWidth
							variant="outlined"
							multiline
							rows={4}
							value={steps}
							onChange={(e) => setSteps(e.target.value)}
							required
							disabled={isSubmitting}
						/>
						<TextField
							margin="dense"
							id="contactEmail"
							label="Contact Email (Optional)"
							type="email"
							fullWidth
							variant="outlined"
							value={contactEmail}
							onChange={(e) => setContactEmail(e.target.value)}
							disabled={isSubmitting}
						/>
					</>
				) : null}
			</DialogContent>
			<DialogActions sx={{ p: "16px 24px" }}>
				<Button
					onClick={handleModalClose}
					color="secondary"
					disabled={isSubmitting}
				>
					{submitStatus.type === "success" ? "Close" : "Cancel"}
				</Button>
				{(!submitStatus.type || submitStatus.type === "error") && (
					<Button type="submit" variant="contained" disabled={isSubmitting}>
						{isSubmitting ? "Submitting..." : "Submit Report"}
					</Button>
				)}
			</DialogActions>
		</Dialog>
	);
}

export default BugReportModal;
