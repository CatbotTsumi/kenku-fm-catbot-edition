/**
 * Copy Kenku FM settings from installed profile → isolated dev profile (%APPDATA%\kenku-fm).
 *
 * Requires a working node_modules/electron/dist/electron.exe (run yarn with .env ELECTRON_MIRROR).
 * If electron.exe is missing, use the default dev profile instead (shares %APPDATA%\Kenku FM).
 *
 * Close Kenku FM and dev Electron before running.
 *
 * Usage: npx yarn copy-settings
 */
import { spawnSync } from "child_process";
import electron from "electron";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function appDataRoot() {
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  return path.join(os.homedir(), ".config");
}

function findInstalledRendererDir() {
  if (process.platform === "win32") {
    const squirrelRoot = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "kenku-fm",
    );
    if (!fs.existsSync(squirrelRoot)) {
      return null;
    }
    const versions = fs
      .readdirSync(squirrelRoot)
      .filter((name) => name.startsWith("app-"))
      .sort()
      .reverse();
    for (const version of versions) {
      const renderer = path.join(
        squirrelRoot,
        version,
        "resources",
        "app",
        ".webpack",
        "renderer",
      );
      if (fs.existsSync(path.join(renderer, "main_window", "index.html"))) {
        return renderer;
      }
    }
  }
  return null;
}

function resolveElectronExecutable() {
  const devExe = path.join(
    __dirname,
    "..",
    "node_modules",
    "electron",
    "dist",
    process.platform === "win32" ? "electron.exe" : "electron",
  );
  if (fs.existsSync(devExe)) {
    return devExe;
  }
  return electron;
}

const installedDir = path.join(appDataRoot(), "Kenku FM");
const devDir = path.join(appDataRoot(), "kenku-fm");
const tmpFile = path.join(os.tmpdir(), `kenku-settings-migrate-${process.pid}.json`);

function copyConfig() {
  const src = path.join(installedDir, "config.json");
  const dst = path.join(devDir, "config.json");
  if (!fs.existsSync(src)) {
    console.warn("No config.json in installed profile — skipped");
    return;
  }
  fs.mkdirSync(devDir, { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("Copied config.json (window bounds)");
}

function runElectron(scriptName, extraArgs = []) {
  const electronPath = resolveElectronExecutable();
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(electronPath, [scriptPath, ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const rendererDir = findInstalledRendererDir();
if (!fs.existsSync(installedDir)) {
  console.error(`Installed profile not found: ${installedDir}`);
  process.exit(1);
}
if (!rendererDir) {
  console.error(
    "Installed Kenku FM app not found under %LOCALAPPDATA%\\kenku-fm\\app-*",
  );
  process.exit(1);
}

const electronPath = resolveElectronExecutable();
if (!fs.existsSync(electronPath) && electronPath === electron) {
  console.error(
    "electron.exe not found. Dev already shares the installed profile by default.",
  );
  console.error(
    "Fix Electron (see .env ELECTRON_MIRROR) to copy into an isolated kenku-fm profile,",
  );
  console.error("or run dev without KENKU_DEV_ISOLATED=1.");
  process.exit(1);
}

console.log(`Installed profile: ${installedDir}`);
console.log(`Installed renderer: ${rendererDir}`);
console.log(`Dev profile: ${devDir}`);
console.log("");

copyConfig();

try {
  runElectron("_copy-settings-read.mjs", [installedDir, rendererDir, tmpFile]);
  runElectron("_copy-settings-write.mjs", [devDir, tmpFile]);
} finally {
  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile);
  }
}

console.log("");
console.log("Done. Start isolated dev with: $env:KENKU_DEV_ISOLATED=1; npx yarn start");
