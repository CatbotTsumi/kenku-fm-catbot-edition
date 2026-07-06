import os from "os";
import path from "path";
import { app, BrowserWindow, components, shell, ipcMain, powerSaveBlocker, autoUpdater } from "electron";
import "./menu";
import icon from "./assets/icon.png";
import { getMalformedUserAgent, getUserAgent } from "./main/userAgent";
import { SessionManager } from "./main/managers/SessionManager";
import { runAutoUpdate, checkForReleaseUpdate, getCachedReleaseUrl } from "./autoUpdate";
import { getSavedBounds, saveWindowBounds } from "./bounds";
import { APP_DISPLAY_NAME } from "./constants/appName";
import {
  formatAppTitle,
  getBrowserProfileName,
  getBrowserSession,
} from "./main/browserProfile";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
let window: BrowserWindow | null = null;

// Share official Kenku FM profile (bookmarks, token, playlists) unless isolated dev.
// Set KENKU_DEV_ISOLATED=1 for %APPDATA%\kenku-fm. Do not run Catbot + official Kenku FM at once.
if (process.env.KENKU_DEV_ISOLATED !== "1") {
  app.setPath("userData", path.join(app.getPath("appData"), "Kenku FM"));
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): BrowserWindow => {
  const minWidth = 480;
  const minHeight = 360;

  // Create the browser window.
  const { bounds, maximized } = getSavedBounds(minWidth, minHeight);

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: formatAppTitle(APP_DISPLAY_NAME),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 18 },
    icon: icon,
    minWidth,
    minHeight,
    ...bounds,
  });

  if (maximized) {
    mainWindow.maximize();
  }

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  let session = new SessionManager(mainWindow);

  mainWindow.webContents.on("did-start-loading", () => {
    // Restart the session on refresh
    session.destroy();
    session = new SessionManager(mainWindow);
  });

  // Spoof user agent for window.navigator
  mainWindow.webContents.setUserAgent(getUserAgent());

  // Prevent app suspension for Kenku FM to avoid playback issues
  const powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  mainWindow.on("close", () => {
    session.destroy();
    window = null;
    powerSaveBlocker.stop(powerSaveBlockerId);
  });

  saveWindowBounds(mainWindow);

  if (app.isPackaged) {
    runAutoUpdate(mainWindow);
  }

  return mainWindow;
};

const spoofUserAgent = (browserSession: Electron.Session) => {
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Google blocks sign in on CEF so spoof user agent for network requests
    details.requestHeaders["User-Agent"] = details.url.includes("google.com")
      ? getMalformedUserAgent()
      : getUserAgent();
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
};

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  // Workaround to allow for webpack support with widevine
  // https://github.com/castlabs/electron-releases/issues/116
  const widevine = components;

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(async () => {
    app.setName(APP_DISPLAY_NAME);

    let hasWidevineError = false;

    try {
      // Wait for widevine to load
      await widevine.whenReady();
      console.log("components ready:", components.status());
    } catch (e) {
      hasWidevineError = true;
      console.error("components failed to load:", JSON.stringify(e, null, 2));
    }

    window = createWindow();

    spoofUserAgent(getBrowserSession());

    if (hasWidevineError) {
      window.once("ready-to-show", () => {
        window.webContents.send(
          "ERROR",
          "Widevine DRM Error: Licensed music playback is disabled",
        );
      });
    }
  });

  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      window = createWindow();
    }
  });

  ipcMain.on("GET_VERSION", (event) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.on("GET_PLATFORM", (event) => {
    event.returnValue = os.platform();
  });

  ipcMain.on("GET_BROWSER_PROFILE", (event) => {
    event.returnValue = getBrowserProfileName() ?? "";
  });

  ipcMain.handle("CLEAR_CACHE", async () => {
    const browserSession = getBrowserSession();
    await browserSession.clearCache();
    await browserSession.clearStorageData({
      storages: ["cookies", "shadercache", "cachestorage"],
    });
  });

  ipcMain.handle("UPDATE_CHECK", async () => {
    if (!app.isPackaged) {
      return { available: false, releaseUrl: getCachedReleaseUrl() };
    }
    return checkForReleaseUpdate();
  });

  ipcMain.handle("UPDATE_OPEN_RELEASE", async () => {
    await shell.openExternal(getCachedReleaseUrl());
  });

  ipcMain.handle("UPDATE_QUIT_AND_INSTALL", () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall();
    }
  });
}
