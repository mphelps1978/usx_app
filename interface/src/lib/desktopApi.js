/** Electron preload exposes `window.desktop` — see usx_app/desktop/preload.cjs */

export function isDesktopApp() {
	return (
		typeof window !== "undefined" &&
		window.desktop &&
		window.desktop.isDesktop === true
	);
}

/** Native WIA scanner flow is implemented for Windows only (see desktop/scripts/wia-scan.ps1). */
export function isWindowsDesktop() {
	return isDesktopApp() && window.desktop?.platform === "win32";
}

/**
 * Open native file picker (Electron). Returns { file: File } or null.
 */
function desktopPayloadToFile(result, fallbackName, fallbackMime) {
	if (!result || !result.data) return null;
	const blob = new Blob([result.data], {
		type: result.mimeType || fallbackMime,
	});
	const file = new File([blob], result.fileName || fallbackName, {
		type: blob.type,
	});
	return { file };
}

export async function pickReceiptFileDesktop() {
	if (!window.desktop?.pickReceiptFile) return null;
	const result = await window.desktop.pickReceiptFile();
	return desktopPayloadToFile(result, "receipt.pdf", "application/pdf");
}

/**
 * Opens the Windows Image Acquisition (WIA) scan UI, then returns the scanned image as a File.
 * Windows desktop only; rejects if not supported.
 */
export async function scanReceiptFromScannerDesktop() {
	if (!window.desktop?.scanReceipt) return null;
	const result = await window.desktop.scanReceipt();
	return desktopPayloadToFile(result, "scan.png", "image/png");
}

export async function saveReceiptLocalCopy(dir, fileName, arrayBuffer) {
	if (!window.desktop?.saveLocalCopy) return { ok: false, error: "Not desktop" };
	return window.desktop.saveLocalCopy(dir, fileName, arrayBuffer);
}

export async function selectReceiptsDirectory() {
	if (!window.desktop?.selectReceiptsDirectory) return null;
	return window.desktop.selectReceiptsDirectory();
}
