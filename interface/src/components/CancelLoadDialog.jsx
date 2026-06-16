import React, { useEffect, useState } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	RadioGroup,
	FormControlLabel,
	Radio,
	TextField,
	Typography,
	Alert,
	Checkbox,
	Box,
} from "@mui/material";
import { LOAD_CANCEL_REASONS } from "../constants/loadCancelReasons";

function CancelLoadDialog({ open, load, attachedFuelStops = [], onClose, onConfirm }) {
	const [cancelReason, setCancelReason] = useState("");
	const [cancelReasonOther, setCancelReasonOther] = useState("");
	const [unlinkFuelStops, setUnlinkFuelStops] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(null);

	const attachedCount = attachedFuelStops.length;
	const attachedTotal = attachedFuelStops.reduce(
		(sum, stop) => sum + (parseFloat(stop.totalFuelStop) || 0),
		0
	);

	useEffect(() => {
		if (open) {
			setUnlinkFuelStops(true);
		}
	}, [open]);

	const handleClose = () => {
		if (submitting) return;
		setCancelReason("");
		setCancelReasonOther("");
		setUnlinkFuelStops(true);
		setError(null);
		onClose();
	};

	const handleSubmit = async () => {
		setError(null);
		if (!cancelReason) {
			setError("Please select a cancellation reason.");
			return;
		}
		if (cancelReason === "other" && !cancelReasonOther.trim()) {
			setError("Please specify a reason when selecting Other.");
			return;
		}
		setSubmitting(true);
		try {
			await onConfirm({
				cancelReason,
				cancelReasonOther:
					cancelReason === "other" ? cancelReasonOther.trim() : null,
				unlinkFuelStops: attachedCount > 0 ? unlinkFuelStops : false,
			});
			setCancelReason("");
			setCancelReasonOther("");
			setUnlinkFuelStops(true);
			setError(null);
			onClose();
		} catch (err) {
			setError(
				err?.response?.data?.message ||
					err?.message ||
					"Could not cancel load."
			);
		} finally {
			setSubmitting(false);
		}
	};

	if (!load) return null;

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle>Cancel Load</DialogTitle>
			<DialogContent>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					PRO <strong>{load.proNumber}</strong> — {load.originCity},{" "}
					{load.originState} to {load.destinationCity}, {load.destinationState}
				</Typography>
				<Typography variant="body2" sx={{ mb: 2 }}>
					Cancelled loads are kept on record but excluded from settlement and net
					revenue projections.
				</Typography>
				{attachedCount > 0 && (
					<Box
						sx={{
							mb: 2,
							p: 1.5,
							borderRadius: 1,
							bgcolor: "action.hover",
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<Typography variant="body2" sx={{ mb: 1 }}>
							{attachedCount} fuel stop{attachedCount !== 1 ? "s" : ""} (
							${(Math.round(attachedTotal * 100) / 100).toFixed(2)}) linked to
							this load.
						</Typography>
						<FormControlLabel
							control={
								<Checkbox
									size="small"
									checked={unlinkFuelStops}
									onChange={(e) => setUnlinkFuelStops(e.target.checked)}
								/>
							}
							label="Move fuel to general (not tied to any load)"
						/>
					</Box>
				)}
				{error && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{error}
					</Alert>
				)}
				<RadioGroup
					value={cancelReason}
					onChange={(e) => setCancelReason(e.target.value)}
				>
					{LOAD_CANCEL_REASONS.map((reason) => (
						<FormControlLabel
							key={reason.value}
							value={reason.value}
							control={<Radio size="small" />}
							label={reason.label}
						/>
					))}
				</RadioGroup>
				<TextField
					label="Please specify"
					value={cancelReasonOther}
					onChange={(e) => setCancelReasonOther(e.target.value)}
					fullWidth
					margin="dense"
					multiline
					minRows={2}
					disabled={cancelReason !== "other"}
					required={cancelReason === "other"}
					placeholder="Describe the reason for cancellation"
					sx={{ mt: 1 }}
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose} disabled={submitting}>
					Keep Load
				</Button>
				<Button
					onClick={handleSubmit}
					color="error"
					variant="contained"
					disabled={submitting}
				>
					{submitting ? "Cancelling…" : "Cancel Load"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default CancelLoadDialog;
