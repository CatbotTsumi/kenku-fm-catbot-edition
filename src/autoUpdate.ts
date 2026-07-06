import { app, autoUpdater, BrowserWindow } from "electron";

import {
  FORK_RELEASE_PAGE_URL,
  getForkUpdateFeedUrl,
  OFFICIAL_RELEASE_API_URL,
  OFFICIAL_RELEASE_PAGE_URL,
  UPSTREAM_BASELINE_VERSION,
} from "./constants/update";

export type UpdateCheckResult = {
  available: boolean;
  latestVersion?: string;
  releaseUrl: string;
  /** Fork Squirrel update downloaded; restart to apply. */
  restartRequired?: boolean;
};

let forkUpdatePending = false;
let forkUpdateDownloaded = false;

let cachedUpdateResult: UpdateCheckResult = {
  available: false,
  releaseUrl: FORK_RELEASE_PAGE_URL,
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

async function checkForUpstreamReleaseUpdate(): Promise<UpdateCheckResult> {
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
      ? isNewerVersion(tagName, UPSTREAM_BASELINE_VERSION)
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

function notifyUpdateAvailable(window: BrowserWindow, result: UpdateCheckResult) {
  if (result.available) {
    window.webContents.send("UPDATE_AVAILABLE", {
      latestVersion: result.latestVersion,
      releaseUrl: result.releaseUrl,
      restartRequired: result.restartRequired ?? false,
    });
  } else {
    window.webContents.send("UPDATE_OFFICIAL_CLEAR");
  }
}

async function checkAndNotifyUpdates(window: BrowserWindow) {
  if (forkUpdateDownloaded) {
    cachedUpdateResult = {
      available: true,
      releaseUrl: FORK_RELEASE_PAGE_URL,
      restartRequired: true,
    };
    notifyUpdateAvailable(window, cachedUpdateResult);
    return;
  }

  if (forkUpdatePending) {
    window.webContents.send("UPDATE_OFFICIAL_CLEAR");
    return;
  }

  const upstreamResult = await checkForUpstreamReleaseUpdate();
  cachedUpdateResult = upstreamResult;
  notifyUpdateAvailable(window, upstreamResult);
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
  const runCheck = () => checkAndNotifyUpdates(window);

  runCheck();

  const interval = setInterval(runCheck, 900000);

  window.on("close", () => {
    clearInterval(interval);
  });
}

export function runAutoUpdate(window: BrowserWindow) {
  if (process.platform === "win32" || process.platform === "darwin") {
    const feedUrl = getForkUpdateFeedUrl(
      process.platform,
      process.arch,
      app.getVersion(),
    );
    console.log("Fork auto-update feed:", feedUrl);
    autoUpdater.setFeedURL({ url: feedUrl });

    const handleError = (error: Error) => {
      console.error("Fork auto-update error:", error);
      forkUpdatePending = false;
      checkAndNotifyUpdates(window);
    };

    const handleUpdateNotAvailable = () => {
      console.log("Fork auto-update: no update available");
      forkUpdatePending = false;
      checkAndNotifyUpdates(window);
    };

    const handleUpdateAvailable = () => {
      console.log("Fork auto-update: update available, downloading");
      forkUpdatePending = true;
      window.webContents.send("UPDATE_OFFICIAL_CLEAR");
    };

    const handleUpdateDownloaded = () => {
      console.log("Fork auto-update: update downloaded");
      forkUpdatePending = false;
      forkUpdateDownloaded = true;
      cachedUpdateResult = {
        available: true,
        releaseUrl: FORK_RELEASE_PAGE_URL,
        restartRequired: true,
      };
      window.webContents.send(
        "MESSAGE",
        "Update available. Restart Kenku FM to apply.",
      );
      notifyUpdateAvailable(window, cachedUpdateResult);
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
  if (forkUpdateDownloaded) {
    return {
      available: true,
      releaseUrl: FORK_RELEASE_PAGE_URL,
      restartRequired: true,
    };
  }

  if (forkUpdatePending) {
    return { available: false, releaseUrl: cachedUpdateResult.releaseUrl };
  }

  const result = await checkForUpstreamReleaseUpdate();
  cachedUpdateResult = result;
  return result;
}

export function getCachedReleaseUrl(): string {
  return cachedUpdateResult.releaseUrl;
}
