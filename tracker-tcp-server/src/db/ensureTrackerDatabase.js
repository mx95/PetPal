const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const MIN_MEANINGFUL_BYTES = 8192;

function fileSizeBytes(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function countPositionsInFile(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) return 0;
  if (fileSizeBytes(dbPath) < MIN_MEANINGFUL_BYTES) return 0;
  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const row = db.prepare("SELECT COUNT(*) AS n FROM positions").get();
    return Number(row?.n) || 0;
  } catch {
    return 0;
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    if (!p) continue;
    const resolved = path.resolve(p);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function listBackupCandidates(serverRoot) {
  const backupDir = path.join(serverRoot, "data", "backups");
  let files = [];
  try {
    files = fs
      .readdirSync(backupDir)
      .filter((name) => /^petpal-.*\.sqlite$/i.test(name))
      .map((name) => path.join(backupDir, name));
  } catch {
    files = [];
  }
  return files.sort((a, b) => fileSizeBytes(b) - fileSizeBytes(a)).slice(0, 20);
}

/**
 * Pick the SQLite file with the most position rows (fallback: largest file).
 */
function findBestDatabaseCandidate(serverRoot, canonicalPath) {
  const legacy = path.join(serverRoot, "data", "petpal.sqlite");
  const libPath = process.env.PETPAL_TRACKER_DB
    ? path.resolve(process.env.PETPAL_TRACKER_DB)
    : "/var/lib/petpal/petpal.sqlite";

  const candidates = uniquePaths([
    canonicalPath,
    libPath,
    legacy,
    ...listBackupCandidates(serverRoot),
  ]);

  let best = { path: canonicalPath, positions: 0, bytes: 0 };
  for (const candidate of candidates) {
    const bytes = fileSizeBytes(candidate);
    if (bytes < MIN_MEANINGFUL_BYTES) continue;
    const positions = countPositionsInFile(candidate);
    if (positions > best.positions || (positions === best.positions && bytes > best.bytes)) {
      best = { path: candidate, positions, bytes };
    }
  }
  return best;
}

function copyDatabaseFile(fromPath, toPath) {
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  fs.copyFileSync(fromPath, toPath);
  for (const suffix of ["-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${toPath}${suffix}`);
    } catch {
      /* ignore */
    }
  }
}

/**
 * If the canonical DB is missing or has fewer rows than another copy on disk, restore from the best copy.
 */
function ensureCanonicalDatabase(serverRoot, requestedPath) {
  const canonicalPath = path.resolve(requestedPath || path.join(serverRoot, "data", "petpal.sqlite"));
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });

  const best = findBestDatabaseCandidate(serverRoot, canonicalPath);
  const currentCount = countPositionsInFile(canonicalPath);
  let restoredFrom = null;

  if (
    best.path !== canonicalPath &&
    best.positions > currentCount &&
    best.positions > 0 &&
    fs.existsSync(best.path)
  ) {
    console.warn(
      `[db] Canonical DB ${canonicalPath} has ${currentCount} positions; restoring ${best.positions} from ${best.path}`
    );
    if (fs.existsSync(canonicalPath) && fileSizeBytes(canonicalPath) >= MIN_MEANINGFUL_BYTES) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const preRestore = path.join(path.dirname(canonicalPath), "backups", `pre-restore-${stamp}.sqlite`);
      fs.mkdirSync(path.dirname(preRestore), { recursive: true });
      fs.copyFileSync(canonicalPath, preRestore);
      console.log(`[db] Pre-restore backup: ${preRestore}`);
    }
    copyDatabaseFile(best.path, canonicalPath);
    restoredFrom = best.path;
  }

  const positionCount = countPositionsInFile(canonicalPath);
  return { path: canonicalPath, restoredFrom, positionCount };
}

/** Online backup via SQLite backup API (runs at startup if last backup is stale). */
function backupDatabaseIfStale(dbPath, { minIntervalMs = 6 * 60 * 60 * 1000 } = {}) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  if (countPositionsInFile(dbPath) <= 0) return null;

  const backupDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  let latestMtime = 0;
  try {
    for (const name of fs.readdirSync(backupDir)) {
      if (!/^petpal-.*\.sqlite$/i.test(name)) continue;
      const mtime = fs.statSync(path.join(backupDir, name)).mtimeMs;
      if (mtime > latestMtime) latestMtime = mtime;
    }
  } catch {
    latestMtime = 0;
  }

  if (Date.now() - latestMtime < minIntervalMs) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(backupDir, `petpal-${stamp}.sqlite`);
  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    db.backup(outPath);
    console.log(`[db] Startup backup: ${outPath}`);
    return outPath;
  } catch (err) {
    console.warn("[db] Startup backup failed:", err.message || err);
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  ensureCanonicalDatabase,
  backupDatabaseIfStale,
  countPositionsInFile,
  findBestDatabaseCandidate,
};
