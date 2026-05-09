const { contextBridge, ipcRenderer } = require('electron');

function base64ToArrayBuffer(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,

  async scanReceipt() {
    const r = await ipcRenderer.invoke('desktop:scanReceipt');
    if (!r) return null;
    if (r.canceled) return null;
    if (r.ok === false) {
      throw new Error(r.error || 'Scan failed.');
    }
    if (!r.buffer) return null;
    return {
      data: base64ToArrayBuffer(r.buffer),
      fileName: r.fileName || 'scan.png',
      mimeType: r.mimeType || 'image/png',
    };
  },

  async pickReceiptFile() {
    const r = await ipcRenderer.invoke('desktop:pickReceiptFile');
    if (!r || !r.buffer) return null;
    return {
      data: base64ToArrayBuffer(r.buffer),
      fileName: r.fileName || 'receipt.pdf',
      mimeType: r.mimeType || 'application/octet-stream',
    };
  },

  async saveLocalCopy(dir, fileName, arrayBuffer) {
    const base64 = arrayBufferToBase64(arrayBuffer);
    return ipcRenderer.invoke('desktop:saveLocalCopy', { dir, fileName, base64 });
  },

  selectReceiptsDirectory: () =>
    ipcRenderer.invoke('desktop:selectReceiptsDirectory'),
});
