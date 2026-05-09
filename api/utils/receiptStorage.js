const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getReceiptsRootDir() {
  const raw = process.env.RECEIPTS_DIR;
  const dir = raw && String(raw).trim()
    ? path.resolve(String(raw).trim())
    : path.join(__dirname, '..', 'uploads', 'receipts');
  return dir;
}

function ensureReceiptsRoot() {
  const root = getReceiptsRootDir();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Alphanumeric + hyphen for filesystem safety */
function slugVendor(name) {
  const s = String(name || 'vendor')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'vendor';
}

/** YYYY-MM-DD from Date or ISO string */
function dateStamp(d) {
  if (!d) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return dateStamp(null);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function allowedReceiptMime(mime, filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return true;
  if (mime === 'application/pdf') return true;
  if (mime && mime.startsWith('image/')) return true;
  if (/\.(png|jpe?g|gif|webp)$/i.test(lower)) return true;
  return false;
}

function extensionFromMimeOrName(mime, filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return '.pdf';
  if (mime === 'application/pdf') return '.pdf';
  if (/\.jpe?g$/i.test(lower) || mime === 'image/jpeg') return '.jpg';
  if (/\.png$/i.test(lower) || mime === 'image/png') return '.png';
  if (/\.gif$/i.test(lower)) return '.gif';
  if (/\.webp$/i.test(lower)) return '.webp';
  return '.pdf';
}

/**
 * Writes bytes under RECEIPTS_DIR/user_{userId}/ and returns stored relative key (posix-style for DB).
 */
function saveReceiptBuffer({ userId, transactionDate, vendorName, buffer, mimeType, originalName }) {
  if (!buffer || !buffer.length) {
    const err = new Error('Empty file');
    err.code = 'EMPTY_FILE';
    throw err;
  }
  ensureReceiptsRoot();
  const root = getReceiptsRootDir();
  const userDir = path.join(root, `user_${userId}`);
  fs.mkdirSync(userDir, { recursive: true });

  const stamp = dateStamp(transactionDate);
  const slug = slugVendor(vendorName);
  const ext = extensionFromMimeOrName(mimeType, originalName);
  const base = `${stamp}_${slug}`;
  let relativeKey;
  let attempt = 0;
  for (;;) {
    const suffix = attempt === 0 ? '' : `_${attempt}`;
    const fileName = `${base}${suffix}${ext}`;
    const abs = path.join(userDir, fileName);
    if (!fs.existsSync(abs)) {
      fs.writeFileSync(abs, buffer);
      relativeKey = path.posix.join(`user_${userId}`, fileName);
      break;
    }
    attempt += 1;
    if (attempt > 500) {
      const rand = crypto.randomBytes(4).toString('hex');
      const fileName = `${base}_${rand}${ext}`;
      const abs = path.join(userDir, fileName);
      fs.writeFileSync(abs, buffer);
      relativeKey = path.posix.join(`user_${userId}`, fileName);
      break;
    }
  }
  return relativeKey;
}

function resolveReceiptAbsolutePath(relativeKey) {
  if (!relativeKey || typeof relativeKey !== 'string') return null;
  const normalized = relativeKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const root = getReceiptsRootDir();
  const abs = path.join(root, ...normalized.split('/'));
  if (!abs.startsWith(root)) return null;
  return abs;
}

module.exports = {
  getReceiptsRootDir,
  ensureReceiptsRoot,
  slugVendor,
  dateStamp,
  allowedReceiptMime,
  saveReceiptBuffer,
  resolveReceiptAbsolutePath,
};
