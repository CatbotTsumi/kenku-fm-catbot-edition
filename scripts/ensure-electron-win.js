/**
 * Ensures castlabs Electron Windows binary is present after yarn install.
 * install.js can leave a macOS path.txt on Windows if a prior install was corrupted.
 * extract-zip may silently skip electron.exe on Windows (AV); tar fallback fixes that.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

if (process.platform !== "win32") {
  process.exit(0);
}

const projectRoot = path.join(__dirname, "..");
const electronDir = path.join(projectRoot, "node_modules", "electron");
const exePath = path.join(electronDir, "dist", "electron.exe");
const pathFile = path.join(electronDir, "path.txt");
const distDir = path.join(electronDir, "dist");

function loadEnvMirror() {
  const envFile = path.join(projectRoot, ".env");
  if (!fs.existsSync(envFile)) {
    return;
  }
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === "ELECTRON_MIRROR" && value && !process.env.ELECTRON_MIRROR) {
      process.env.ELECTRON_MIRROR = value;
    }
  }
}

function writePathTxt() {
  fs.writeFileSync(pathFile, "electron.exe");
}

function isBrokenInstall() {
  if (fs.existsSync(exePath)) {
    return false;
  }
  if (!fs.existsSync(distDir)) {
    return false;
  }
  const entries = fs.readdirSync(distDir);
  if (entries.length === 0) {
    return false;
  }
  const macPath = fs.existsSync(pathFile)
    ? fs.readFileSync(pathFile, "utf8").includes("Electron.app")
    : false;
  return macPath || !fs.existsSync(exePath);
}

function resetBrokenDist() {
  if (!isBrokenInstall()) {
    return;
  }
  console.log("Removing corrupted Electron dist before reinstall...");
  fs.rmSync(distDir, { recursive: true, force: true });
  if (fs.existsSync(pathFile)) {
    fs.unlinkSync(pathFile);
  }
}

async function downloadZip() {
  const { downloadArtifact } = require("@electron/get");
  const { version } = require(path.join(electronDir, "package.json"));
  const mirror =
    process.env.ELECTRON_MIRROR ||
    "https://github.com/castlabs/electron-releases/releases/download/";

  return downloadArtifact({
    version,
    artifactName: "electron",
    mirrorOptions: { mirror },
    platform: "win32",
    arch: process.env.npm_config_arch || process.arch,
    force: true,
  });
}

function extractWithTar(zipPath) {
  fs.mkdirSync(distDir, { recursive: true });
  execSync(`tar -xf "${zipPath}" -C "${distDir}"`, { stdio: "inherit" });
}

function extractWithExtractZip(zipPath) {
  const extract = require("extract-zip");
  fs.mkdirSync(distDir, { recursive: true });
  extract.sync(zipPath, { dir: distDir });
}

async function installFromCache() {
  const zipPath = await downloadZip();
  resetBrokenDist();
  fs.mkdirSync(distDir, { recursive: true });

  try {
    extractWithExtractZip(zipPath);
  } catch (err) {
    console.warn("extract-zip failed, trying tar:", err.message);
  }

  if (!fs.existsSync(exePath)) {
    console.log("extract-zip did not produce electron.exe; extracting with tar...");
    fs.rmSync(distDir, { recursive: true, force: true });
    extractWithTar(zipPath);
  }
}

if (fs.existsSync(exePath)) {
  writePathTxt();
  process.exit(0);
}

loadEnvMirror();
resetBrokenDist();

console.log("Installing Electron Windows binary (castlabs)...");
if (process.env.ELECTRON_MIRROR) {
  console.log(`Using ELECTRON_MIRROR=${process.env.ELECTRON_MIRROR}`);
}

installFromCache()
  .then(() => {
    if (!fs.existsSync(exePath)) {
      throw new Error("electron.exe missing after extract");
    }
    writePathTxt();
  })
  .catch((err) => {
    console.error("Electron install failed:", err.message);
    console.error("Ensure .env has ELECTRON_MIRROR, then run:");
    console.error("  node scripts/ensure-electron-win.js");
    process.exit(1);
  });
