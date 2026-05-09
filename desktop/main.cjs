const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const express = require('express');

function wiaScanScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'wia-scan.ps1');
  }
  return path.join(__dirname, 'scripts', 'wia-scan.ps1');
}

/** Packaged: serve built Vite app from resources; dev: expect `npm run dev` in ../interface */
let staticServer = null;

function getDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'interface-dist');
  }
  return path.join(__dirname, '..', 'interface', 'dist');
}

function startStaticServer(distPath) {
  const ex = express();
  ex.use(express.static(distPath));
  return new Promise((resolve, reject) => {
    try {
      const s = ex.listen(0, '127.0.0.1', () => resolve(s));
      s.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!app.isPackaged) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const distPath = getDistPath();
  if (!fs.existsSync(distPath)) {
    dialog.showErrorBox(
      'USX IC Books',
      `Web bundle not found at:\n${distPath}\n\nRun npm run build in usx_app/interface, then rebuild the desktop app.`,
    );
    app.quit();
    return;
  }

  staticServer = await startStaticServer(distPath);
  const port = staticServer.address().port;
  await win.loadURL(`http://127.0.0.1:${port}`);
}

ipcMain.handle('desktop:scanReceipt', async () => {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Scanner integration is only available on Windows.' };
  }
  const scriptPath = wiaScanScriptPath();
  if (!fs.existsSync(scriptPath)) {
    return { ok: false, error: `Scanner script not found at ${scriptPath}` };
  }
  const tmpName = `usx-wia-${Date.now()}.png`;
  const outPath = path.join(app.getPath('temp'), tmpName);
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-OutputPath', outPath],
    {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: false,
      timeout: 15 * 60 * 1000,
    },
  );
  const code = result.status;
  const stderr = (result.stderr || '').trim();
  if (result.error) {
    return { ok: false, error: result.error.message || String(result.error) };
  }
  if (code === 2) {
    return { canceled: true };
  }
  if (code !== 0 && code != null) {
    return {
      ok: false,
      error: stderr || result.stdout?.trim() || `Scan failed (exit ${code}).`,
    };
  }
  if (code == null) {
    return { ok: false, error: 'Scan was interrupted.' };
  }
  if (!fs.existsSync(outPath)) {
    return { ok: false, error: 'Scan finished but output file was not created.' };
  }
  try {
    const buf = fs.readFileSync(outPath);
    fs.unlinkSync(outPath);
    return {
      ok: true,
      buffer: buf.toString('base64'),
      fileName: tmpName,
      mimeType: 'image/png',
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('desktop:pickReceiptFile', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {
        name: 'Receipts',
        extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'],
      },
    ],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const filePath = r.filePaths[0];
  const buf = fs.readFileSync(filePath);
  return {
    buffer: buf.toString('base64'),
    fileName: path.basename(filePath),
    mimeType: guessMime(filePath),
  };
});

function guessMime(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

ipcMain.handle('desktop:saveLocalCopy', async (_event, { dir, fileName, base64 }) => {
  try {
    const buf = Buffer.from(base64, 'base64');
    const safeName = path.basename(fileName).replace(/[/\\\\]/g, '_');
    const destDir = path.resolve(dir);
    fs.mkdirSync(destDir, { recursive: true });
    const full = path.join(destDir, safeName);
    fs.writeFileSync(full, buf);
    return { ok: true, fullPath: full };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('desktop:selectReceiptsDirectory', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (staticServer) {
    try {
      staticServer.close();
    } catch {
      /* ignore */
    }
    staticServer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
