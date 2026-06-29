import { app, autoUpdater, BrowserWindow } from "electron";

import {
  getForkUpdateFeedUrl,
  OFFICIAL_RELEASE_API_URL,
  OFFICIAL_RELEASE_PAGE_URL,
} from "./constants/update";

export type UpdateCheckResult = {
  available: boolean;
  latestVersion?: string;
  releaseUrl: string;
};

let forkUpdatePending = false;

let cachedOfficialResult: UpdateCheckResult = {
  available: false,
  releaseUrl: OFFICIAL_RELEASE_PAGE_URL,
};

function parseVersion(version: string): number[] | null {
  const normalized = version.replace(/^v/i, "");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return [match[1], match[2] ?? "0", match[3] ?? "0"].map(Number);
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) {
      return true;
    }
    if (latestParts[i] < currentParts[i]) {
      return false;
    }
  }
  return false;
}

async function checkForOfficialReleaseUpdate(
  currentVersion: string = app.getVersion(),
): Promise<UpdateCheckResult> {
  try {
    const response = await fetch(OFFICIAL_RELEASE_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Kenku-FM-Catbot-Edition",
      },
    });
    if (!response.ok) {
      return { available: false, releaseUrl: OFFICIAL_RELEASE_PAGE_URL };
    }
    const data = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
    };
    const tagName = data.tag_name?.replace(/^v/i, "") ?? "";
    const releaseUrl = data.html_url ?? OFFICIAL_RELEASE_PAGE_URL;
    const available = tagName
      ? isNewerVersion(tagName, currentVersion)
      : false;
    return {
      available,
      latestVersion: available ? tagName : undefined,
      releaseUrl,
    };
  } catch {
    return { available: false, releaseUrl: OFFICIAL_RELEASE_PAGE_URL };
  }
}

async function checkAndNotifyOfficial(window: BrowserWindow) {
  if (forkUpdatePending) {
    window.webContents.send("UPDATE_OFFICIAL_CLEAR");
    return;
  }

  const result = await checkForOfficialReleaseUpdate();
  cachedOfficialResult = result;

  if (result.available && result.latestVersion) {
    window.webContents.send("UPDATE_AVAILABLE", {
      latestVersion: result.latestVersion,
      releaseUrl: result.releaseUrl,
    });
  } else {
    window.webContents.send("UPDATE_OFFICIAL_CLEAR");
  }
}

function checkForkUpdates() {
  if (process.platform === "win32") {
    const squirrelCommand = process.argv[1];
    if (squirrelCommand === "--squirrel-firstrun") {
      return;
    }
  }

  if (app.isReady()) {
    autoUpdater.checkForUpdates();
  }
}

function runOfficialOnlyChecker(window: BrowserWindow) {
  const runCheck = () => checkAndNotifyOfficial(window);

  runCheck();

  const interval = setInterval(runCheck, 900000);

  window.on("close", () => {
    clearInterval(interval);
  });
}

export function runAutoUpdate(window: BrowserWindow) {
  if (process.platform === "win32" || process.platform === "darwin") {
    autoUpdater.setFeedURL({
      url: getForkUpdateFeedUrl(
        process.platform,
        process.arch,
        app.getVersion(),
      ),
    });

    const handleError = () => {
      forkUpdatePending = false;
      checkAndNotifyOfficial(window);
    };

    const handleUpdateNotAvailable = () => {
      forkUpdatePending = false;
      checkAndNotifyOfficial(window);
    };

    const handleUpdateAvailable = () => {
      forkUpdatePending = true;
      window.webContents.send("UPDATE_OFFICIAL_CLEAR");
    };

    const handleUpdateDownloaded = () => {
      forkUpdatePending = true;
      window.webContents.send(
        "MESSAGE",
        "Update Available. Restart to apply.",
      );
    };

    autoUpdater.on("error", handleError);
    autoUpdater.on("update-not-available", handleUpdateNotAvailable);
    autoUpdater.on("update-available", handleUpdateAvailable);
    autoUpdater.on("update-downloaded", handleUpdateDownloaded);

    checkForkUpdates();

    const interval = setInterval(checkForkUpdates, 900000);

    window.on("close", () => {
      autoUpdater.off("error", handleError);
      autoUpdater.off("update-not-available", handleUpdateNotAvailable);
      autoUpdater.off("update-available", handleUpdateAvailable);
      autoUpdater.off("update-downloaded", handleUpdateDownloaded);
      clearInterval(interval);
    });
  } else {
    runOfficialOnlyChecker(window);
  }
}

export async function checkForReleaseUpdate(): Promise<UpdateCheckResult> {
  if (forkUpdatePending) {
    return { available: false, releaseUrl: cachedOfficialResult.releaseUrl };
  }

  const result = await checkForOfficialReleaseUpdate();
  cachedOfficialResult = result;
  return result;
}

export function getCachedReleaseUrl(): string {
  return cachedOfficialResult.releaseUrl;
}
